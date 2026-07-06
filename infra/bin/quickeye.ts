#!/usr/bin/env node
/**
 * CDK app entry point.
 *
 * A "CDK app" is just a program that describes AWS infrastructure as code.
 * Running `cdk deploy` executes this, turns the stack below into a
 * CloudFormation template, and provisions the real AWS resources.
 */
import * as cdk from "aws-cdk-lib";
import { QuickeyeStack } from "../lib/quickeye-stack";

const app = new cdk.App();

new QuickeyeStack(app, "QuickeyeStack", {
  // Uses the AWS account/region from your CLI credentials when deploying.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "Quickeye real-time multiplayer backend (WebSocket + Lambda + DynamoDB)",
});
