import { setupInfra } from "../src/sdk/setup-infra";

async function main() {
  const accountId = process.env.AWS_ACCOUNT_ID;
  if (!accountId) {
    console.error("Please set AWS_ACCOUNT_ID environment variable.");
    process.exit(1);
  }

  console.log(`Starting SDK-based infrastructure setup for account: ${accountId}`);
  
  try {
    const results = await setupInfra(accountId);
    
    console.log("\nSetup completed successfully!");
    console.log("-------------------------------------------");
    console.log(`Audit Log Bucket: ${results.auditLogBucketName}`);
    console.log(`Athena Results Bucket: ${results.queryResultBucketName}`);
    console.log(`Glue Database: ${results.databaseName}`);
    console.log(`Glue Table: ${results.tableName}`);
    console.log("-------------------------------------------");
    console.log("\nYou can now upload logs using:");
    console.log(`./scripts/upload_logs.sh ${results.auditLogBucketName}`);
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  }
}

main();
