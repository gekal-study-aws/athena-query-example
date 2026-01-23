import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';

export class EcsServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. VPC作成
    // コスト削減のためNAT Gatewayを0にし、パブリックサブネットのみを作成します。
    // コンテナをパブリックサブネットに配置し、Public IPを付与することでインターネット通信を可能にします。
    const vpc = new ec2.Vpc(this, 'EcsVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // 2. ECSクラスター
    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: vpc,
      containerInsights: false, // コスト削減のため無効化
    });

    // 3. タスク定義
    // Java 25を使用 (2026年時点)
    // Javaアプリはメモリを消費しやすいため、最小構成の0.25 vCPU / 0.5 GB RAMから始め、必要に応じて調整します。
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'JavaAppTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
      },
    });

    // ロググループ (保持期間を1日に設定してコスト削減)
    const logGroup = new logs.LogGroup(this, 'AppLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // コンテナ定義
    const container = taskDefinition.addContainer('AppContainer', {
      // 指定されたJava 25イメージを使用
      image: ecs.ContainerImage.fromRegistry('amazoncorretto:25-alpine'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'java-app',
        logGroup: logGroup,
      }),
      environment: {
        'JAVA_OPTS': '-Xmx384m', // メモリ制限に合わせたJavaオプション
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
      assignPublicIp: true, // パブリックサブネット配置のため必須
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1,
        },
      ],
    });

    // 5. REST API用のNetwork Load Balancer
    // REST APIのVPC LinkにはNLBが必要です。ALBよりは安いですがコストが発生します。
    const nlb = new elbv2.NetworkLoadBalancer(this, 'AppNlb', {
      vpc,
      internetFacing: false, // API Gatewayからの接続用なので内部向け
    });

    const listener = nlb.addListener('Listener', {
      port: 80,
    });

    listener.addTargets('EcsTarget', {
      port: 80,
      targets: [service.loadBalancerTarget({
        containerName: 'AppContainer',
        containerPort: 8080,
      })],
    });

    // 6. API Gateway (REST API)
    // REST APIへの変更リクエストに対応。
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
