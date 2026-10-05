"""
BioCloud Workbench - AWS Cloud Deployment & ECR Push CLI
Region: eu-north-1 (Stockholm)

Automates:
1. Verification of AWS credentials and target region (eu-north-1)
2. ECR Repository Creation (backend, frontend, worker-ecg, worker-protein)
3. Docker authentication with Amazon ECR
4. Docker container build and tagging
5. Docker container push to Amazon ECR in eu-north-1
6. Optional Terraform plan / apply execution for full infrastructure deployment
"""

import os
import sys
import base64
import argparse
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
TERRAFORM_DIR = ROOT_DIR / "infra" / "terraform"
DEFAULT_REGION = "eu-north-1"
DEFAULT_PROJECT = "biocloud-workbench"

DOCKER_BIN = "docker"

IMAGES_TO_BUILD = [
    {
        "name": "backend",
        "repo_name": f"{DEFAULT_PROJECT}-backend",
        "dockerfile": "Dockerfile.backend",
        "context": "."
    },
    {
        "name": "frontend",
        "repo_name": f"{DEFAULT_PROJECT}-frontend",
        "dockerfile": "Dockerfile.frontend",
        "context": "."
    },
    {
        "name": "worker-ecg",
        "repo_name": f"{DEFAULT_PROJECT}-worker-ecg",
        "dockerfile": "Dockerfile.worker-ecg",
        "context": "."
    },
    {
        "name": "worker-protein",
        "repo_name": f"{DEFAULT_PROJECT}-worker-protein",
        "dockerfile": "Dockerfile.worker-protein",
        "context": "."
    },
]


def check_docker_running() -> bool:
    """Check if the Docker daemon is accessible."""
    try:
        res = subprocess.run([DOCKER_BIN, "info"], capture_output=True, text=True, timeout=10)
        return res.returncode == 0
    except Exception:
        return False


def get_aws_session(region: str):
    """Obtain boto3 session and verify credentials."""
    try:
        import boto3
        session = boto3.Session(region_name=region)
        sts = session.client("sts")
        identity = sts.get_caller_identity()
        return session, identity
    except Exception as e:
        return None, str(e)


def ensure_ecr_repositories(session, account_id: str, region: str) -> Dict[str, str]:
    """Create ECR repositories in the specified region if they don't exist."""
    ecr = session.client("ecr", region_name=region)
    repo_urls = {}

    for item in IMAGES_TO_BUILD:
        repo_name = item["repo_name"]
        try:
            resp = ecr.describe_repositories(repositoryNames=[repo_name])
            repo_urls[repo_name] = resp["repositories"][0]["repositoryUri"]
            print(f"    [EXISTS] ECR Repository: {repo_name} -> {repo_urls[repo_name]}")
        except ecr.exceptions.RepositoryNotFoundException:
            print(f"    [CREATING] ECR Repository: {repo_name}...")
            resp = ecr.create_repository(
                repositoryName=repo_name,
                imageScanningConfiguration={"scanOnPush": True},
                imageTagMutability="MUTABLE",
                tags=[
                    {"Key": "Project", "Value": DEFAULT_PROJECT},
                    {"Key": "Environment", "Value": "production"}
                ]
            )
            repo_urls[repo_name] = resp["repository"]["repositoryUri"]
            print(f"    [CREATED] ECR Repository: {repo_name} -> {repo_urls[repo_name]}")
        except Exception as e:
            print(f"    [ERROR] Could not inspect/create {repo_name}: {e}")
            raise

    return repo_urls


def docker_login_ecr(session, account_id: str, region: str) -> bool:
    """Log in local Docker client to Amazon ECR registry."""
    ecr = session.client("ecr", region_name=region)
    try:
        auth_data = ecr.get_authorization_token()
        token = auth_data["authorizationData"][0]["authorizationToken"]
        endpoint = auth_data["authorizationData"][0]["proxyEndpoint"]
        user, password = base64.b64decode(token).decode("utf-8").split(":")

        login_proc = subprocess.run(
            [DOCKER_BIN, "login", "--username", user, "--password-stdin", endpoint],
            input=password,
            text=True,
            capture_output=True,
            timeout=30
        )
        if login_proc.returncode == 0:
            print(f"    [SUCCESS] Docker authenticated to Amazon ECR: {endpoint}")
            return True
        else:
            print(f"    [FAILED] Docker login returned non-zero: {login_proc.stderr}")
            return False
    except Exception as e:
        print(f"    [ERROR] Failed to authenticate Docker with ECR: {e}")
        return False


def build_and_push_images(account_id: str, region: str, dry_run: bool = False):
    """Build, tag, and push all container images to ECR."""
    registry_host = f"{account_id}.dkr.ecr.{region}.amazonaws.com"

    for item in IMAGES_TO_BUILD:
        name = item["name"]
        repo_name = item["repo_name"]
        dockerfile = ROOT_DIR / item["dockerfile"]
        remote_tag = f"{registry_host}/{repo_name}:latest"

        print(f"\n[*] Building container: {name} (using {item['dockerfile']})...")
        if dry_run:
            print(f"    [DRY RUN] Would execute: docker build -t {remote_tag} -f {dockerfile} {ROOT_DIR}")
            print(f"    [DRY RUN] Would execute: docker push {remote_tag}")
            continue

        # Docker build
        build_cmd = [DOCKER_BIN, "build", "-t", remote_tag, "-f", str(dockerfile), str(ROOT_DIR)]
        build_res = subprocess.run(build_cmd)
        if build_res.returncode != 0:
            print(f"[ERROR] Failed to build {name}. Exiting.")
            sys.exit(1)

        # Docker push
        print(f"[*] Pushing {name} to {remote_tag}...")
        push_cmd = [DOCKER_BIN, "push", remote_tag]
        push_res = subprocess.run(push_cmd)
        if push_res.returncode != 0:
            print(f"[ERROR] Failed to push {name} to ECR. Exiting.")
            sys.exit(1)
        print(f"    [PASS] Successfully pushed: {remote_tag}")


def run_terraform(action: str = "plan"):
    """Execute Terraform commands in infra/terraform."""
    terraform_bin = "terraform"
    print(f"\n[*] Running Terraform ({action}) in {TERRAFORM_DIR}...")
    
    # 1. terraform init
    subprocess.run([terraform_bin, "init"], cwd=TERRAFORM_DIR, check=True)
    
    if action == "plan":
        subprocess.run([terraform_bin, "plan"], cwd=TERRAFORM_DIR, check=True)
    elif action == "apply":
        subprocess.run([terraform_bin, "apply", "-auto-approve"], cwd=TERRAFORM_DIR, check=True)


def main():
    parser = argparse.ArgumentParser(description="BioCloud Workbench - AWS Create & Push Tool")
    parser.add_argument("--region", default=DEFAULT_REGION, help=f"Target AWS region (default: {DEFAULT_REGION})")
    parser.add_argument("--dry-run", action="store_true", help="Print commands without executing Docker builds or pushes")
    parser.add_argument("--build-push-only", action="store_true", help="Build and push ECR images without invoking Terraform")
    parser.add_argument("--terraform-plan", action="store_true", help="Run terraform plan after pushing images")
    parser.add_argument("--terraform-apply", action="store_true", help="Run terraform apply to provision AWS infrastructure")
    args = parser.parse_args()

    print("=======================================================")
    print(f"  BioCloud Workbench: AWS Create & Push")
    print(f"  Target AWS Region: {args.region} (Stockholm)")
    print("=======================================================\n")

    # 1. Check Docker
    print("[*] 1. Checking Docker Engine availability...")
    if not args.dry_run and not check_docker_running():
        print("    [WARN] Docker daemon does not appear to be running or 'docker' is not in PATH.")
        print("    Please ensure Docker Desktop is started.\n")
    else:
        print("    [PASS] Docker Engine is accessible.\n")

    # 2. Check AWS Credentials & Identity
    print(f"[*] 2. Checking AWS credentials for region: {args.region}...")
    session, identity_or_err = get_aws_session(args.region)
    if not session:
        print(f"    [NOTICE] AWS credentials not found or invalid: {identity_or_err}\n")
        print("----------------------------------------------------------------------")
        print("  HOW TO CONFIGURE AWS CREDENTIALS SAFELY:")
        print("----------------------------------------------------------------------")
        print("  1. In your AWS Console (eu-north-1):")
        print("     Navigate to: IAM -> Users -> Security credentials -> Create access key")
        print("  2. In your PowerShell terminal, configure environment variables:")
        print("     $env:AWS_ACCESS_KEY_ID = 'YOUR_KEY_ID'")
        print("     $env:AWS_SECRET_ACCESS_KEY = 'YOUR_SECRET_KEY'")
        print("     $env:AWS_DEFAULT_REGION = 'eu-north-1'")
        print("  3. Then re-run: python scripts/aws_create_push.py")
        print("----------------------------------------------------------------------\n")
        return

    account_id = identity_or_err.get("Account")
    arn = identity_or_err.get("Arn")
    print(f"    [AUTHENTICATED] Account ID: {account_id}")
    print(f"    [AUTHENTICATED] IAM Identity: {arn}\n")

    # 3. Create ECR Repositories
    print(f"[*] 3. Ensuring ECR repositories exist in {args.region}...")
    repo_urls = ensure_ecr_repositories(session, account_id, args.region)
    print("    [PASS] All 4 ECR repositories verified.\n")

    # 4. Authenticate Docker with ECR
    print(f"[*] 4. Authenticating Docker client with Amazon ECR ({args.region})...")
    if not args.dry_run:
        if not docker_login_ecr(session, account_id, args.region):
            print("[ERROR] Could not log in to ECR. Exiting.")
            return
    else:
        print(f"    [DRY RUN] Would execute: aws ecr get-login-password | docker login")

    # 5. Build and Push Images
    print(f"\n[*] 5. Building and Pushing Container Images to ECR...")
    build_and_push_images(account_id, args.region, dry_run=args.dry_run)

    # 6. Optional Terraform Orchestration
    if args.terraform_plan:
        run_terraform(action="plan")
    elif args.terraform_apply:
        run_terraform(action="apply")

    print("\n=======================================================")
    print("  BioCloud Workbench: AWS Create & Push Completed")
    print("=======================================================\n")
    print("Your container images are pushed and available in Amazon ECR:")
    for k, v in repo_urls.items():
        print(f"  • {k}: {v}:latest")
    print(f"\nAWS Console Direct ECR Link:")
    print(f"  https://{args.region}.console.aws.amazon.com/ecr/repositories?region={args.region}\n")


if __name__ == "__main__":
    main()
