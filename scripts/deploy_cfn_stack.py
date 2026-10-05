#!/usr/bin/env python3
"""
Deploy BioCloud Workbench S3, EC2, PostgreSQL, and Frontend stack via AWS CloudFormation.
Target Region: eu-north-1 (Stockholm)
Target Account: 211125717128
"""

import os
import sys
import time
import boto3
from botocore.exceptions import ClientError

REGION = os.getenv("AWS_REGION", "eu-north-1")
STACK_NAME = os.getenv("CFN_STACK_NAME", "biocloud-workbench-stack")
TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "biocloud-ec2-s3-stack.yaml")

def main():
    print("=" * 70)
    print("  BioCloud Workbench - Automated AWS CloudFormation Deployment")
    print(f"  Region: {REGION}")
    print(f"  Stack Name: {STACK_NAME}")
    print(f"  Template: {TEMPLATE_PATH}")
    print("=" * 70)

    if not os.path.exists(TEMPLATE_PATH):
        print(f"[ERROR] Template not found: {TEMPLATE_PATH}")
        sys.exit(1)

    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template_body = f.read()

    # Session setup
    session = boto3.Session(region_name=REGION)
    credentials = session.get_credentials()
    if not credentials:
        print("\n[!] AWS credentials not found in environment or ~/.aws/credentials.")
        print("    If you have AWS Access Keys, you can set them:")
        print("      $env:AWS_ACCESS_KEY_ID='your-key'")
        print("      $env:AWS_SECRET_ACCESS_KEY='your-secret'")
        print("      $env:AWS_DEFAULT_REGION='eu-north-1'")
        print("\n    Or deploy directly via AWS Console (template is ready):")
        print("    https://eu-north-1.console.aws.amazon.com/cloudformation/home?region=eu-north-1#/stacks/create/template\n")
        return

    cfn = session.client("cloudformation", region_name=REGION)

    print("\n[1/4] Checking existing stack status...")
    try:
        desc = cfn.describe_stacks(StackName=STACK_NAME)
        status = desc["Stacks"][0]["StackStatus"]
        print(f"      Stack '{STACK_NAME}' already exists with status: {status}")
        if status in ["CREATE_COMPLETE", "UPDATE_COMPLETE"]:
            print_stack_outputs(desc["Stacks"][0])
            return
    except ClientError as e:
        if "does not exist" not in str(e):
            print(f"[ERROR] {e}")
            return
        print(f"      Stack '{STACK_NAME}' does not exist yet. Proceeding with creation.")

    print("\n[2/4] Initiating CloudFormation stack creation...")
    try:
        response = cfn.create_stack(
            StackName=STACK_NAME,
            TemplateBody=template_body,
            Capabilities=["CAPABILITY_NAMED_IAM"],
            Tags=[
                {"Key": "Project", "Value": "biocloud-workbench"},
                {"Key": "Environment", "Value": "production"}
            ]
        )
        stack_id = response.get("StackId")
        print(f"      Created Stack ID: {stack_id}")
    except ClientError as e:
        print(f"[ERROR] Failed to create stack: {e}")
        return

    print("\n[3/4] Provisioning AWS Resources (S3 Bucket, EC2 t3.large, IAM Profile, Security Group)...")
    print("      This typically takes 2-4 minutes...")

    while True:
        try:
            desc = cfn.describe_stacks(StackName=STACK_NAME)["Stacks"][0]
            status = desc["StackStatus"]
            print(f"      Current Status: {status}")

            if status == "CREATE_COMPLETE":
                print("\n[4/4] Stack deployment COMPLETED successfully!")
                print_stack_outputs(desc)
                break
            elif "FAILED" in status or "ROLLBACK" in status:
                print(f"\n[ERROR] Stack creation failed with status: {status}")
                if "StackStatusReason" in desc:
                    print(f"Reason: {desc['StackStatusReason']}")
                break
        except Exception as e:
            print(f"      Polling error: {e}")
        time.sleep(15)

def print_stack_outputs(stack):
    print("\n" + "=" * 70)
    print("  BioCloud Workbench - Deployed AWS Endpoints")
    print("=" * 70)
    for out in stack.get("Outputs", []):
        key = out.get("OutputKey")
        val = out.get("OutputValue")
        desc = out.get("Description", "")
        print(f"  * {key:18}: {val}")
        if desc:
            print(f"    ({desc})")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
