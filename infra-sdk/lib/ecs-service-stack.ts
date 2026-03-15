import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class EcsServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. VPC作成
    // コスト削減のためNAT Gatewayを0にし、パブリックサブネットのみを作成します。
    // コンテナをパブリックサブネットに配置し、Public IPを付与することでインターネット通信を可能にします。
    const vpc = new ec2.Vpc(this, 'EcsVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ],
    });

    // 2. ECSクラスター
    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,   // コスト削減のため無効化
    });

    // 3. タスク定義
    // Java 25を使用 (2026年時点)
    // Javaアプリはメモリを消費しやすいため、最小構成の0.25 vCPU / 0.5 GB RAMから始め、必要に応じて調整します。
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'JavaAppTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
      },
    });

    const queryResultBucketName = `athena-results-gekal-${cdk.Stack.of(this).region}`;
    const queryResultBucket = s3.Bucket.fromBucketName(this, 'QueryResultBucketRef', queryResultBucketName);

    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'athena:StartQueryExecution',
        'athena:GetQueryExecution',
        'athena:GetQueryResults',
        'athena:StopQueryExecution',
        'athena:GetWorkGroup',
      ],
      resources: ['*'],
    }));

    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:GetBucketLocation',
        's3:ListBucket',
      ],
      resources: [queryResultBucket.bucketArn],
    }));

    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObject',
        's3:PutObject',
      ],
      resources: [`${queryResultBucket.bucketArn}/*`],
    }));

    // ロググループ (保持期間を1日に設定してコスト削減)
    const logGroup = new logs.LogGroup(this, 'AppLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // コンテナ定義
    const container = taskDefinition.addContainer('AppContainer', {
      // Docker Hubのイメージを使用
      image: ecs.ContainerImage.fromRegistry('gekal/aws-athena-api-demo:0.0.1-SNAPSHOT'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'java-app',
        logGroup: logGroup,
      }),
      environment: {
        'JAVA_OPTS': '',
      },
    });

    container.addPortMappings({
      containerPort: 8080,
    });

    // 4. ECSサービス (Fargate Spotを使用)
    const service = new ecs.FargateService(this, 'JavaAppService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1,
        },
      ],
    });

    // 5. Application Load Balancer (Internal)
    // 内部ALBを作成します。
    const alb = new elbv2.ApplicationLoadBalancer(this, 'AppAlb', {
      vpc,
      internetFacing: false, // 内部ALBに設定
    });

    const albListener = alb.addListener('AlbListener', {
      port: 80,
      open: true,
    });

    albListener.addTargets('EcsTarget', {
      port: 80,
      targets: [service.loadBalancerTarget({
        containerName: 'AppContainer',
        containerPort: 8080,
      })],
      healthCheck: {
        path: '/actuator/health/readiness',
      },
    });

    // 6. Network Load Balancer (Internal)
    // REST APIのVPC LinkはNLBのみをサポートしているため、内部ALBの前にNLBを配置します。
    const nlbSg = new ec2.SecurityGroup(this, 'NlbSg', {
      vpc,
      description: 'Security group for NLB',
      allowAllOutbound: true,
    });

    // APIGW (VPC Link) からのインバウンドトラフィックを許可 (通常、VPC内のプライベート通信として)
    nlbSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(80), 'Allow traffic from VPC (API Gateway)');

    const nlb = new elbv2.NetworkLoadBalancer(this, 'AppNlb', {
      vpc,
      internetFacing: false,
      securityGroups: [nlbSg],
    });

    // ALBへのトラフィックを許可するために、NLBのセキュリティグループからのポート80へのインバウンドルールを追加
    alb.connections.allowFrom(nlbSg, ec2.Port.tcp(80), 'Allow traffic from NLB Security Group');

    const nlbListener = nlb.addListener('NlbListener', {
      port: 80,
    });

    // NLBのターゲットとしてALBを指定
    nlbListener.addTargets('AlbTarget', {
      port: 80,
      targets: [new elbv2_targets.AlbListenerTarget(albListener)],
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        path: '/actuator/health/readiness',
        port: '80',
      },
    });

    // 7. API Gateway (REST API)
    const vpcLink = new apigateway.VpcLink(this, 'VpcLink', {
      targets: [nlb],
    });

    const api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: 'EcsServiceRestApi',
      deployOptions: {
        stageName: 'prod',
      },
    });

    api.root.addProxy({
      defaultIntegration: new apigateway.Integration({
        type: apigateway.IntegrationType.HTTP_PROXY,
        integrationHttpMethod: 'ANY',
        options: {
          connectionType: apigateway.ConnectionType.VPC_LINK,
          vpcLink: vpcLink,
        },
        uri: `http://${nlb.loadBalancerDnsName}/{proxy}`,
      }),
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });
  }
}
