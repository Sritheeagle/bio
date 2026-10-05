"""
BioCloud Workbench - Local AWS Emulation Initializer
Provisions offline AWS resources (S3, KMS, SQS FIFO, Cognito, Batch)
using moto_server or LocalStack on http://127.0.0.1:5000.
Enables testing full cloud mode (LOCAL_DEV_MODE=false) with zero AWS charges.
"""

import os
import sys
import argparse
import urllib.request
import boto3
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT_DIR / ".env"
BACKEND_ENV = ROOT_DIR / "backend" / ".env"

DEFAULT_ENDPOINT = os.getenv("AWS_ENDPOINT_URL", "http://127.0.0.1:5000")
DEFAULT_REGION = os.getenv("AWS_REGION", "eu-north-1")
DEFAULT_BUCKET = os.getenv("AWS_S3_BUCKET", "biocloud-workbench-211125717128")


def check_endpoint(endpoint_url: str) -> bool:
    try:
        req = urllib.request.Request(endpoint_url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            return True
    except Exception:
        # Many moto/localstack root endpoints return 404 or 403 on root GET, which means the server IS listening!
        try:
            import socket
            from urllib.parse import urlparse
            p = urlparse(endpoint_url)
            host = p.hostname or "127.0.0.1"
            port = p.port or 5000
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except Exception:
            return False


def check_db_connectivity(db_url: str) -> bool:
    """Test if database is reachable before writing to .env."""
    try:
        if db_url.startswith("sqlite"):
            return True
        import socket
        from urllib.parse import urlparse
        p = urlparse(db_url)
        host = p.hostname or "127.0.0.1"
        port = p.port or 5432
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False


def setup_local_aws(endpoint_url: str = DEFAULT_ENDPOINT, region: str = DEFAULT_REGION, db_url: str = None, use_sqlite: bool = False):
    print(f"\n=======================================================")
    print(f"  BioCloud Workbench - Local AWS Cloud Initializer")
    print(f"=======================================================")
    print(f"[*] Target Endpoint: {endpoint_url}")
    print(f"[*] Target Region:   {region}")

    if use_sqlite:
        target_db_url = "sqlite:///data/biocloud.db"
        db_host_port = "SQLite (data/biocloud.db)"
    else:
        target_db_url = db_url or os.getenv("DATABASE_URL") or "postgresql://biocloud:biocloud_dev_password@localhost:5432/biocloud_db"
        if target_db_url.startswith("sqlite"):
            target_db_url = "postgresql://biocloud:biocloud_dev_password@localhost:5432/biocloud_db"
        from urllib.parse import urlparse
        db_parsed = urlparse(target_db_url)
        db_host_port = f"{db_parsed.hostname or 'localhost'}:{db_parsed.port or 5432}"

    print(f"[*] Database Target: {db_host_port}")

    if not check_endpoint(endpoint_url):
        print(f"\n[!] ERROR: Local AWS emulator is not reachable at {endpoint_url}")
        print(f"    Please start the local emulator in a terminal:")
        print(f"    python -m moto.server -H 127.0.0.1 -p 5000")
        sys.exit(1)

    print(f"[+] Emulator connection verified.")

    db_reachable = check_db_connectivity(target_db_url)
    if db_reachable:
        print(f"[+] Database connection verified at {db_host_port}.")
    else:
        print(f"[!] NOTICE: Database at {db_host_port} is not responding (port closed/offline).")
        print(f"    Cloud mode requires PostgreSQL/Aurora. If PostgreSQL is running on another port/host,")
        print(f"    pass --db-url <url>. Use 'python scripts/init_local_aws.py --local' to return to SQLite.")

    # Configure dummy credentials for local emulator
    os.environ["AWS_ACCESS_KEY_ID"] = "test"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "test"
    os.environ["AWS_DEFAULT_REGION"] = region

    # 1. KMS Key
    print(f"[*] Provisioning KMS Customer Managed Key...")
    kms = boto3.client("kms", region_name=region, endpoint_url=endpoint_url)
    key_resp = kms.create_key(
        Description="BioCloud Workbench Customer Managed Key (CMK)",
        KeyUsage="ENCRYPT_DECRYPT",
        CustomerMasterKeySpec="SYMMETRIC_DEFAULT",
    )
    kms_key_id = key_resp["KeyMetadata"]["KeyId"]
    try:
        kms.create_alias(AliasName="alias/biocloud-workbench-key", TargetKeyId=kms_key_id)
    except Exception:
        pass
    print(f"[+] KMS Key created: {kms_key_id}")

    # 2. S3 Bucket
    print(f"[*] Provisioning S3 Storage Bucket ({DEFAULT_BUCKET})...")
    s3 = boto3.client("s3", region_name=region, endpoint_url=endpoint_url)
    bucket_name = DEFAULT_BUCKET
    try:
        if region == "us-east-1":
            s3.create_bucket(Bucket=bucket_name)
        else:
            s3.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": region}
            )
    except Exception:
        pass
    # Put bucket encryption
    try:
        s3.put_bucket_encryption(
            Bucket=bucket_name,
            ServerSideEncryptionConfiguration={
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "aws:kms",
                            "KMSMasterKeyID": kms_key_id,
                        }
                    }
                ]
            },
        )
    except Exception as e:
        print(f"    (Notice: bucket encryption config skipped: {e})")
    print(f"[+] S3 Bucket created: {bucket_name}")

    # 3. SQS FIFO Queues
    print(f"[*] Provisioning SQS FIFO Queues...")
    sqs = boto3.client("sqs", region_name=region, endpoint_url=endpoint_url)
    try:
        ecg_q = sqs.create_queue(
            QueueName="biocloud-ecg-queue.fifo",
            Attributes={
                "FifoQueue": "true",
                "ContentBasedDeduplication": "true",
                "VisibilityTimeout": "300",
            },
        )
        sqs_ecg_url = ecg_q["QueueUrl"]
    except Exception:
        sqs_ecg_url = sqs.get_queue_url(QueueName="biocloud-ecg-queue.fifo")["QueueUrl"]
    print(f"[+] ECG SQS FIFO Queue: {sqs_ecg_url}")

    try:
        prot_q = sqs.create_queue(
            QueueName="biocloud-protein-queue.fifo",
            Attributes={
                "FifoQueue": "true",
                "ContentBasedDeduplication": "true",
                "VisibilityTimeout": "300",
            },
        )
        sqs_prot_url = prot_q["QueueUrl"]
    except Exception:
        sqs_prot_url = sqs.get_queue_url(QueueName="biocloud-protein-queue.fifo")["QueueUrl"]
    print(f"[+] Protein SQS FIFO Queue: {sqs_prot_url}")

    # 4. Cognito User Pool & Client
    print(f"[*] Provisioning Cognito User Pool & App Client...")
    cognito = boto3.client("cognito-idp", region_name=region, endpoint_url=endpoint_url)
    pool_resp = cognito.create_user_pool(
        PoolName="biocloud-user-pool",
        AutoVerifiedAttributes=["email"],
        Policies={
            "PasswordPolicy": {
                "MinimumLength": 8,
                "RequireUppercase": True,
                "RequireLowercase": True,
                "RequireNumbers": True,
                "RequireSymbols": False,
            }
        },
    )
    user_pool_id = pool_resp["UserPool"]["Id"]
    client_resp = cognito.create_user_pool_client(
        UserPoolId=user_pool_id,
        ClientName="biocloud-web-app",
        GenerateSecret=False,
    )
    client_id = client_resp["UserPoolClient"]["ClientId"]
    print(f"[+] Cognito User Pool: {user_pool_id}")
    print(f"[+] Cognito Client ID: {client_id}")

    # 5. AWS Batch
    print(f"[*] Registering AWS Batch Job Definition...")
    batch = boto3.client("batch", region_name=region, endpoint_url=endpoint_url)
    try:
        job_def = batch.register_job_definition(
            jobDefinitionName="biocloud-protein-esmfold",
            type="container",
            containerProperties={
                "image": "ghcr.io/facebookresearch/esm:latest",
                "vcpus": 4,
                "memory": 16384,
                "command": ["python", "-m", "backend.app.workers.protein_worker"],
            },
        )
        batch_job_def = job_def["jobDefinitionName"] + ":1"
    except Exception as e:
        batch_job_def = "biocloud-protein-esmfold:1"
    batch_job_queue = "biocloud-protein-queue"
    print(f"[+] AWS Batch Job Queue: {batch_job_queue}")
    print(f"[+] AWS Batch Job Definition: {batch_job_def}")

    # 6. Write Configuration Files
    env_content = f"""# BioCloud Workbench Environment Configuration
# Generated by scripts/init_local_aws.py

# Mode
LOCAL_DEV_MODE=false
ENVIRONMENT=staging
LOG_LEVEL=INFO

# Local AWS Emulator Endpoint (moto_server / LocalStack)
AWS_ENDPOINT_URL={endpoint_url}
AWS_REGION={region}
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION={region}

# Storage (S3 with KMS customer-managed key)
STORAGE_TYPE=s3
AWS_S3_BUCKET={bucket_name}
AWS_KMS_KEY_ID={kms_key_id}

# Queue (Decoupled SQS FIFO)
QUEUE_TYPE=sqs
SQS_ECG_QUEUE_URL={sqs_ecg_url}
SQS_PROTEIN_QUEUE_URL={sqs_prot_url}

# Authentication (Cognito User Pool)
COGNITO_USER_POOL_ID={user_pool_id}
COGNITO_CLIENT_ID={client_id}
COGNITO_REGION={region}

# Batch Compute (Protein Structure Prediction)
BATCH_PROTEIN_ENABLED=true
BATCH_PROTEIN_JOB_QUEUE={batch_job_queue}
BATCH_PROTEIN_JOB_DEFINITION={batch_job_def}

# Database
DATABASE_URL={target_db_url}
"""

    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write(env_content)
    with open(BACKEND_ENV, "w", encoding="utf-8") as f:
        f.write(env_content)

    print(f"\n[+] Environment successfully written to:")
    print(f"    - {ENV_FILE}")
    print(f"    - {BACKEND_ENV}")
    print(f"\n=======================================================")
    print(f"  AWS Cloud Mode Successfully Configured!")
    print(f"  - S3 Bucket:  {bucket_name}")
    print(f"  - KMS Key:    {kms_key_id}")
    print(f"  - ECG Queue:  {sqs_ecg_url}")
    print(f"  - Prot Queue: {sqs_prot_url}")
    print(f"  - Cognito:    {user_pool_id}")
    print(f"  - Endpoint:   {endpoint_url}")
    print(f"=======================================================\n")


def reset_to_local():
    env_content = """# BioCloud Workbench Local Dev Environment
LOCAL_DEV_MODE=true
ENVIRONMENT=development
LOG_LEVEL=INFO
DEBUG=false

# Database
DATABASE_URL=sqlite:///data/biocloud.db

# Storage & Queue
STORAGE_TYPE=local
LOCAL_STORAGE_DIR=./data/storage
QUEUE_TYPE=local

# Security
SECRET_KEY=biocloud-dev-secret-key-change-in-production-2026
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Models
BATCH_PROTEIN_ENABLED=false
ESMFOLD_MODEL_ENABLED=false
"""
    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write(env_content)
    with open(BACKEND_ENV, "w", encoding="utf-8") as f:
        f.write(env_content)
    print("\n[+] Reset environment to LOCAL_DEV_MODE=true (SQLite, local disk, in-memory queue).\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initialize local AWS offline emulation.")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="AWS endpoint URL")
    parser.add_argument("--region", default=DEFAULT_REGION, help="AWS Region")
    parser.add_argument("--db-url", default=None, help="Database URL for cloud mode (e.g. postgresql://user:pass@host:5432/dbname)")
    parser.add_argument("--sqlite", action="store_true", help="Keep SQLite database while enabling AWS S3/SQS/KMS emulator")
    parser.add_argument("--local", action="store_true", help="Reset to local dev mode")
    args = parser.parse_args()

    if args.local:
        reset_to_local()
    else:
        setup_local_aws(args.endpoint, args.region, args.db_url, args.sqlite)
