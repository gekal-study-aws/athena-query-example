import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as athena from 'aws-cdk-lib/aws-athena';

export class InfraSdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. 監査ログ保存用のS3バケット
    const auditLogBucket = new s3.Bucket(this, 'AuditLogBucket', {
      bucketName: `audit-log-gekal-${cdk.Stack.of(this).region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // 2. Athenaのクエリ結果保存用のS3バケット
    const queryResultBucket = new s3.Bucket(this, 'QueryResultBucket', {
      bucketName: `athena-results-gekal-${cdk.Stack.of(this).region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // 3. Glue Database
    const databaseName = 'audit_log_db';
    new glue.CfnDatabase(this, 'AuditLogDatabase', {
      catalogId: cdk.Stack.of(this).account,
      databaseInput: {
        name: databaseName,
        description: 'Database for audit logs',
      },
    });

    // 4. Glue Table (監査ログのスキーマ定義)
    const tableName = 'audit_logs';
    new glue.CfnTable(this, 'AuditLogTable', {
      catalogId: cdk.Stack.of(this).account,
      databaseName: databaseName,
      tableInput: {
        name: tableName,
        description: 'Table for audit logs',
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          'has_encrypted_data': 'false',
          'classification': 'json',
          'typeOfData': 'file',
          'projection.enabled': 'true',
          'projection.year.type': 'integer',
          'projection.year.range': '2024,2030',
          'projection.month.type': 'integer',
          'projection.month.range': '1,12',
          'projection.month.digits': '2',
          'projection.day.type': 'integer',
          'projection.day.range': '1,31',
          'projection.day.digits': '2',
          'storage.location.template': auditLogBucket.s3UrlForObject('logs/year=${year}/month=${month}/day=${day}'),
        },
        storageDescriptor: {
          columns: [
            {name: 'timestamp', type: 'string'},
            {name: 'user_id', type: 'string'},
            {name: 'event_name', type: 'string'},
            {name: 'resource_id', type: 'string'},
            {name: 'status', type: 'string'},
            {name: 'ip_address', type: 'string'},
          ],
          location: auditLogBucket.s3UrlForObject('logs/'),
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
          },
        },
        partitionKeys: [
          {name: 'year', type: 'string'},
          {name: 'month', type: 'string'},
          {name: 'day', type: 'string'},
        ],
      },
    });

    // 5. Athena Workgroup
    new athena.CfnWorkGroup(this, 'AuditLogWorkGroup', {
      name: 'AuditLogWorkGroup',
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: queryResultBucket.s3UrlForObject(),
        },
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'AuditLogBucketName', {
      value: auditLogBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'QueryResultBucketName', {
      value: queryResultBucket.bucketName,
    });
  }
}
