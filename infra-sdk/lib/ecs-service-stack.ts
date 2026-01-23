import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
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
      // 実際にはビルドしたイメージを指定
      image: ecs.ContainerImage.fromRegistry('amazoncorretto:17-alpine'),
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

    // Cloud Map (Service Discovery) の設定
    // ALBを使わずにコストを抑えるため、Cloud Mapを使用してECSサービスに直接統合します。
    const namespace = cluster.addDefaultCloudMapNamespace({
      name: 'local',
    });

    // 4. ECSサービス (Fargate Spotを使用)
    const service = new ecs.FargateService(this, 'JavaAppService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true, // パブリックサブネット配置のため必須
      cloudMapOptions: {
        name: 'app-service',
      },
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1,
        },
      ],
    });

    // 5. API Gateway (HTTP API)
    // REST APIよりも安価なHTTP APIを使用します。
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'EcsServiceApi',
    });

    // VPC Link (HTTP APIからプライベート/パブリックリソースへの接続用)
    const vpcLink = new apigwv2.VpcLink(this, 'VpcLink', {
      vpc,
    });

    const cloudMapService = service.cloudMapService!;

    const serviceDiscoveryIntegration = new apigwv2_integrations.HttpServiceDiscoveryIntegration('ServiceDiscoveryIntegration', cloudMapService, {
      vpcLink,
    });

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: serviceDiscoveryIntegration,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
    });
  }
}
