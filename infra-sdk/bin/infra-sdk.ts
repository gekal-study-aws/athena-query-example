#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraSdkStack } from '../lib/infra-sdk-stack';
import { EcsServiceStack } from '../lib/ecs-service-stack';

const app = new cdk.App();
new InfraSdkStack(app, 'InfraSdkStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new EcsServiceStack(app, 'EcsServiceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
