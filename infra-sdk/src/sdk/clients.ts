import { S3Client } from "@aws-sdk/client-s3";
import { GlueClient } from "@aws-sdk/client-glue";
import { AthenaClient } from "@aws-sdk/client-athena";

const region = process.env.AWS_REGION || "ap-northeast-1";

export const s3Client = new S3Client({ region });
export const glueClient = new GlueClient({ region });
export const athenaClient = new AthenaClient({ region });
