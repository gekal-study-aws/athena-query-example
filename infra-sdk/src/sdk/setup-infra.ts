import { CreateBucketCommand, PutPublicAccessBlockCommand } from '@aws-sdk/client-s3';
import { CreateDatabaseCommand, CreateTableCommand } from '@aws-sdk/client-glue';
import { CreateWorkGroupCommand } from '@aws-sdk/client-athena';
import { s3Client, glueClient, athenaClient } from './clients';

export async function setupInfra(accountId: string) {
  const auditLogBucketName = `audit-log-${accountId}-${process.env.AWS_REGION || 'ap-northeast-1'}`;
  const queryResultBucketName = `athena-results-${accountId}-${process.env.AWS_REGION || 'ap-northeast-1'}`;
  const databaseName = 'audit_log_db_sdk';
  const tableName = 'audit_logs';

  console.log('Creating S3 buckets...');
  try {
    await s3Client.send(new CreateBucketCommand({ Bucket: auditLogBucketName }));
    await s3Client.send(
      new PutPublicAccessBlockCommand({
        Bucket: auditLogBucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      }),
    );

    await s3Client.send(new CreateBucketCommand({ Bucket: queryResultBucketName }));
    await s3Client.send(
      new PutPublicAccessBlockCommand({
        Bucket: queryResultBucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      }),
    );
  } catch (e: any) {
    if (e.name !== 'BucketAlreadyOwnedByYou') {
      console.error('Error creating buckets:', e);
    }
  }

  console.log('Creating Glue database...');
  try {
    await glueClient.send(
      new CreateDatabaseCommand({
        DatabaseInput: {
          Name: databaseName,
          Description: 'Database for audit logs (created via SDK)',
        },
      }),
    );
  } catch (e: any) {
    if (e.name !== 'AlreadyExistsException') {
      console.error('Error creating database:', e);
    }
  }

  console.log('Creating Glue table with partitions...');
  try {
    await glueClient.send(
      new CreateTableCommand({
        DatabaseName: databaseName,
        TableInput: {
          Name: tableName,
          Description: 'Table for audit logs (created via SDK)',
          TableType: 'EXTERNAL_TABLE',
          Parameters: {
            has_encrypted_data: 'false',
            classification: 'json',
            typeOfData: 'file',
          },
          StorageDescriptor: {
            Columns: [
              { Name: 'timestamp', Type: 'string' },
              { Name: 'user_id', Type: 'string' },
              { Name: 'event_name', Type: 'string' },
              { Name: 'resource_id', Type: 'string' },
              { Name: 'status', Type: 'string' },
              { Name: 'ip_address', Type: 'string' },
            ],
            Location: `s3://${auditLogBucketName}/logs/`,
            InputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
            OutputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
            SerdeInfo: {
              SerializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
            },
          },
          PartitionKeys: [
            { Name: 'year', Type: 'string' },
            { Name: 'month', Type: 'string' },
            { Name: 'day', Type: 'string' },
          ],
        },
      }),
    );
  } catch (e: any) {
    if (e.name !== 'AlreadyExistsException') {
      console.error('Error creating table:', e);
    }
  }

  console.log('Creating Athena workgroup...');
  try {
    await athenaClient.send(
      new CreateWorkGroupCommand({
        Name: 'AuditLogWorkGroupSDK',
        Configuration: {
          ResultConfiguration: {
            OutputLocation: `s3://${queryResultBucketName}/`,
          },
        },
      }),
    );
  } catch (e: any) {
    if (e.name !== 'AlreadyExistsException') {
      console.error('Error creating workgroup:', e);
    }
  }

  return {
    auditLogBucketName,
    queryResultBucketName,
    databaseName,
    tableName,
  };
}
