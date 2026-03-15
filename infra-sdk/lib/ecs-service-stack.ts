import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
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
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
    });

    // 3. タスク定義
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'JavaAppTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
      },
    });

    // ---------------------------------------------------------
    // IAM権限の設定 (Athena実行に必要な全権限を追加)
    // ---------------------------------------------------------

    // ① Athena自体の実行権限
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

    // ② AWS Glue データカタログの読み取り権限 (audit_log_db のメタデータ取得用)
    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'glue:GetDatabase',
        'glue:GetDatabases',
        'glue:GetTable',
        'glue:GetTables',
        'glue:GetPartition',
        'glue:GetPartitions',
      ],
      resources: ['*'], // ※実運用では特定のカタログに絞るのが望ましいです
    }));

    // ③ 検索対象となる「元データ」のS3バケットへの読み取り権限
    const sourceDataBucketName = `audit-log-gekal-${cdk.Stack.of(this).region}`;
    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:GetBucketLocation',
        's3:ListBucket',
        's3:GetObject',
      ],
      resources: [
        `arn:aws:s3:::${sourceDataBucketName}`,
        `arn:aws:s3:::${sourceDataBucketName}/*`
      ],
    }));

    // ④ クエリ結果の「出力先」S3バケットへの読み書き権限
    const queryResultBucketName = `athena-results-gekal-${cdk.Stack.of(this).region}`;
    const queryResultBucket = s3.Bucket.fromBucketName(this, 'QueryResultBucketRef', queryResultBucketName);

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

    // ---------------------------------------------------------

    const logGroup = new logs.LogGroup(this, 'AppLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const container = taskDefinition.addContainer('AppContainer', {
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

    // 4. ECSサービス
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
    const alb = new elbv2.ApplicationLoadBalancer(this, 'AppAlb', {
      vpc,
      internetFacing: false,
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
    const nlbSg = new ec2.SecurityGroup(this, 'NlbSg', {
      vpc,
      description: 'Security group for NLB',
      allowAllOutbound: true,
    });

    // REST API (VPC Link V1) からのアクセスを許可するため anyIpv4 を指定
    nlbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow traffic from API Gateway REST API (VPC Link)');

    const nlb = new elbv2.NetworkLoadBalancer(this, 'AppNlb', {
      vpc,
      internetFacing: false,
      securityGroups: [nlbSg],
    });

    alb.connections.allowFrom(nlbSg, ec2.Port.tcp(80), 'Allow traffic from NLB Security Group');

    const nlbListener = nlb.addListener('NlbListener', {
      port: 80,
    });

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

    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: 'EcsServiceRestApi',
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      cloudWatchRole: true,
      deployOptions: {
        stageName: 'prod',
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    const integrationOptions: apigateway.IntegrationOptions = {
      connectionType: apigateway.ConnectionType.VPC_LINK,
      vpcLink: vpcLink,
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
    };

    const corsMockIntegration = new apigateway.MockIntegration({
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Api-Key'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });

    const corsMethodOptions: apigateway.MethodOptions = {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    };

    const apiRes = api.root.addResource('api');
    const athenaRes = apiRes.addResource('athena');

    // /api/athena/query
    const queryRes = athenaRes.addResource('query');
    queryRes.addMethod('POST', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'POST',
      uri: `http://${nlb.loadBalancerDnsName}/api/athena/query`,
      options: integrationOptions,
    }));
    queryRes.addMethod('OPTIONS', corsMockIntegration, corsMethodOptions);

    // 動的パスパラメータ {queryExecutionId} のマッピング定義
    const dynamicIntegrationOptions = {
      ...integrationOptions,
      requestParameters: {
        'integration.request.path.queryExecutionId': 'method.request.path.queryExecutionId'
      }
    };
    const dynamicMethodOptions = {
      requestParameters: {
        'method.request.path.queryExecutionId': true
      }
    };

    // /api/athena/status/{queryExecutionId}
    const statusRes = athenaRes.addResource('status');
    const statusIdRes = statusRes.addResource('{queryExecutionId}');
    statusIdRes.addMethod('GET', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      uri: `http://${nlb.loadBalancerDnsName}/api/athena/status/{queryExecutionId}`,
      options: dynamicIntegrationOptions,
    }), dynamicMethodOptions);
    statusIdRes.addMethod('OPTIONS', corsMockIntegration, corsMethodOptions);

    // /api/athena/results/{queryExecutionId}
    const resultsRes = athenaRes.addResource('results');
    const resultsIdRes = resultsRes.addResource('{queryExecutionId}');
    resultsIdRes.addMethod('GET', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      uri: `http://${nlb.loadBalancerDnsName}/api/athena/results/{queryExecutionId}`,
      options: dynamicIntegrationOptions,
    }), dynamicMethodOptions);
    resultsIdRes.addMethod('OPTIONS', corsMockIntegration, corsMethodOptions);

    // /api/athena/download/{queryExecutionId}
    const downloadRes = athenaRes.addResource('download');
    const downloadIdRes = downloadRes.addResource('{queryExecutionId}');
    downloadIdRes.addMethod('GET', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      uri: `http://${nlb.loadBalancerDnsName}/api/athena/download/{queryExecutionId}`,
      options: dynamicIntegrationOptions,
    }), dynamicMethodOptions);
    downloadIdRes.addMethod('OPTIONS', corsMockIntegration, corsMethodOptions);

    // /api/athena/download/{queryExecutionId}/url
    const downloadUrlRes = downloadIdRes.addResource('url');
    downloadUrlRes.addMethod('GET', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      uri: `http://${nlb.loadBalancerDnsName}/api/athena/download/{queryExecutionId}/url`,
      options: dynamicIntegrationOptions,
    }), dynamicMethodOptions);
    downloadUrlRes.addMethod('OPTIONS', corsMockIntegration, corsMethodOptions);

    // Actuatorエントポイント
    const actuatorRes = api.root.addResource('actuator');
    actuatorRes.addMethod('GET', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      uri: `http://${nlb.loadBalancerDnsName}/actuator`,
      options: integrationOptions,
    }));
    actuatorRes.addMethod('OPTIONS', corsMockIntegration, corsMethodOptions);

    const healthRes = actuatorRes.addResource('health');
    healthRes.addMethod('GET', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      uri: `http://${nlb.loadBalancerDnsName}/actuator/health`,
      options: integrationOptions,
    }));
    healthRes.addMethod('OPTIONS', corsMockIntegration, corsMethodOptions);

    const pingRes = healthRes.addResource('ping');
    pingRes.addMethod('GET', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      uri: `http://${nlb.loadBalancerDnsName}/actuator/health/ping`,
      options: integrationOptions,
    }));
    pingRes.addMethod('OPTIONS', corsMockIntegration, corsMethodOptions);

    // 全体のプロキシ (フォールバック) での {proxy} パラメータマッピング
    api.root.addProxy({
      defaultIntegration: new apigateway.Integration({
        type: apigateway.IntegrationType.HTTP_PROXY,
        integrationHttpMethod: 'ANY',
        options: {
          connectionType: apigateway.ConnectionType.VPC_LINK,
          vpcLink: vpcLink,
          requestParameters: {
            'integration.request.path.proxy': 'method.request.path.proxy'
          }
        },
        uri: `http://${nlb.loadBalancerDnsName}/{proxy}`,
      }),
      defaultMethodOptions: {
        requestParameters: {
          'method.request.path.proxy': true
        }
      }
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });
  }
}