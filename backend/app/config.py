import os
from pathlib import Path
from typing import List, Tuple
from dotenv import load_dotenv

# Base paths
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

# Load environment configuration from .env files if present
if (ROOT_DIR / ".env").exists():
    load_dotenv(ROOT_DIR / ".env")
elif (BACKEND_DIR / ".env").exists():
    load_dotenv(BACKEND_DIR / ".env")

DATA_DIR = Path(os.getenv("APP_DATA_DIR", ROOT_DIR / "data"))
STORAGE_DIR = Path(os.getenv("LOCAL_STORAGE_DIR", DATA_DIR / "storage"))

DATA_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# App configuration
PROJECT_NAME = "BioCloud Workbench"
API_V1_STR = "/api/v1"
VERSION = "1.0.0"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

# Development / Cloud mode flag
# When LOCAL_DEV_MODE=True: local disk storage, local async worker queue, local JWT auth, SQLite default
# When LOCAL_DEV_MODE=False: strict AWS validation (S3 KMS, SQS FIFO, Cognito, PostgreSQL/Aurora)
LOCAL_DEV_MODE = os.getenv("LOCAL_DEV_MODE", "true").lower() in ("true", "1", "yes")

# Security & Local Auth
SECRET_KEY = os.getenv("SECRET_KEY", os.getenv("LOCAL_AUTH_SECRET", "biocloud-dev-secret-key-change-in-production-2026"))
ALGORITHM = os.getenv("LOCAL_AUTH_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours in dev

# AWS Cognito settings (used when LOCAL_DEV_MODE=False or AUTH_PROVIDER=cognito)
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", os.getenv("COGNITO_APP_CLIENT_ID", ""))
COGNITO_REGION = os.getenv("COGNITO_REGION", os.getenv("AWS_REGION", "us-east-1"))

# Database
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'biocloud.db'}")

# Storage adapter settings ('local' or 's3')
STORAGE_TYPE = os.getenv("STORAGE_TYPE", os.getenv("STORAGE_BACKEND", "local" if not os.getenv("AWS_S3_BUCKET") else "s3")).lower()
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_KMS_KEY_ID = os.getenv("AWS_KMS_KEY_ID", "")
AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL", "")
UPLOAD_EXPIRATION_SECONDS = int(os.getenv("UPLOAD_EXPIRATION_SECONDS", "3600"))

# Queue adapter settings ('local' or 'sqs')
QUEUE_TYPE = os.getenv("QUEUE_TYPE", os.getenv("QUEUE_BACKEND", "local")).lower()
# Separate ECG and Protein SQS FIFO Queues
SQS_ECG_QUEUE_URL = os.getenv("SQS_ECG_QUEUE_URL", os.getenv("AWS_SQS_QUEUE_URL", ""))
SQS_PROTEIN_QUEUE_URL = os.getenv("SQS_PROTEIN_QUEUE_URL", os.getenv("AWS_SQS_QUEUE_URL", ""))

# AWS Batch for Protein Prediction
BATCH_PROTEIN_JOB_QUEUE = os.getenv("BATCH_PROTEIN_JOB_QUEUE", "")
BATCH_PROTEIN_JOB_DEFINITION = os.getenv("BATCH_PROTEIN_JOB_DEFINITION", "")
BATCH_PROTEIN_ENABLED = os.getenv("BATCH_PROTEIN_ENABLED", "false").lower() in ("true", "1", "yes")

# ECG Workflow Settings
ECG_MAX_FILE_SIZE_MB = int(os.getenv("ECG_MAX_FILE_SIZE_MB", "50"))
ECG_ALLOWED_EXTENSIONS = {".csv", ".txt", ".dat"}

# Protein Workflow Settings
PROTEIN_MAX_SEQUENCE_LENGTH = int(os.getenv("PROTEIN_MAX_SEQUENCE_LENGTH", "1500"))
PROTEIN_MIN_SEQUENCE_LENGTH = int(os.getenv("PROTEIN_MIN_SEQUENCE_LENGTH", "15"))
PROTEIN_MAX_FILE_SIZE_MB = int(os.getenv("PROTEIN_MAX_FILE_SIZE_MB", "10"))
PROTEIN_ALLOWED_EXTENSIONS = {".fasta", ".fa", ".fna", ".txt"}

# Protein Model backend configuration
PROTEIN_MODEL_NAME = os.getenv("PROTEIN_MODEL_NAME", "esmfold_v1")
PROTEIN_MODEL_VERSION = os.getenv("PROTEIN_MODEL_VERSION", "1.0.0")
ESMFOLD_MODEL_ENABLED = os.getenv("ESMFOLD_MODEL_ENABLED", "false").lower() in ("true", "1", "yes")
ESMFOLD_IMAGE = os.getenv("ESMFOLD_IMAGE", "ghcr.io/facebookresearch/esm:latest")
ESMFOLD_WEIGHTS_PATH = os.getenv("ESMFOLD_WEIGHTS_PATH", os.getenv("ESMFOLD_WEIGHTS_DIR", ""))
ESMFOLD_DEVICE = os.getenv("ESMFOLD_DEVICE", "cuda:0")
ESMFOLD_MAX_RESIDUES = int(os.getenv("ESMFOLD_MAX_RESIDUES", "400"))
ESMFOLD_API_ENDPOINT = os.getenv("ESMFOLD_API_ENDPOINT", "")

# CORS Origins
CORS_ORIGINS: List[str] = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]


def validate_config(strict_aws: bool = False) -> Tuple[bool, List[str]]:
    """
    Validates application configuration.
    If strict_aws is True or LOCAL_DEV_MODE is False, enforces that all required AWS production
    settings are properly configured:
    - PostgreSQL/Aurora, never SQLite (even with AWS_ENDPOINT_URL set)
    - S3 storage with KMS Customer Managed Key
    - Separate ECG and Protein SQS FIFO queues
    - Cognito User Pool and Client IDs
    - AWS Batch queue and job definition when protein Batch processing is enabled
    Never prints secrets or passwords.
    Returns (is_valid, list_of_errors).
    """
    errors: List[str] = []

    # 1. Validate Storage Configuration
    if STORAGE_TYPE == "s3":
        if not AWS_S3_BUCKET:
            errors.append("STORAGE_TYPE is set to 's3' but AWS_S3_BUCKET is empty.")
        if not AWS_REGION:
            errors.append("STORAGE_TYPE is set to 's3' but AWS_REGION is empty.")
        if (not LOCAL_DEV_MODE or strict_aws) and not AWS_KMS_KEY_ID:
            errors.append("Production S3 storage requires AWS_KMS_KEY_ID for customer-managed encryption.")
    elif STORAGE_TYPE != "local":
        errors.append(f"Invalid STORAGE_TYPE '{STORAGE_TYPE}'. Must be 'local' or 's3'.")

    # 2. Validate Queue Configuration
    if QUEUE_TYPE == "sqs":
        if not SQS_ECG_QUEUE_URL:
            errors.append("QUEUE_TYPE is set to 'sqs' but SQS_ECG_QUEUE_URL is empty.")
        if not SQS_PROTEIN_QUEUE_URL:
            errors.append("QUEUE_TYPE is set to 'sqs' but SQS_PROTEIN_QUEUE_URL is empty.")
        if SQS_ECG_QUEUE_URL and SQS_PROTEIN_QUEUE_URL and SQS_ECG_QUEUE_URL == SQS_PROTEIN_QUEUE_URL:
            errors.append("QUEUE_TYPE is set to 'sqs' but requires separate ECG and Protein queues.")
    elif QUEUE_TYPE != "local":
        errors.append(f"Invalid QUEUE_TYPE '{QUEUE_TYPE}'. Must be 'local' or 'sqs'.")

    # 3. Validate Production AWS Mode (LOCAL_DEV_MODE == False or strict_aws)
    if not LOCAL_DEV_MODE or strict_aws:
        if STORAGE_TYPE != "s3":
            errors.append("Production AWS mode requires STORAGE_TYPE='s3'.")
        if not AWS_S3_BUCKET:
            errors.append("Production AWS mode requires AWS_S3_BUCKET.")
        if not AWS_KMS_KEY_ID:
            errors.append("Production AWS mode requires AWS_KMS_KEY_ID.")
        if QUEUE_TYPE != "sqs":
            errors.append("Production AWS mode requires QUEUE_TYPE='sqs'.")
        if not SQS_ECG_QUEUE_URL:
            errors.append("Production AWS mode requires SQS_ECG_QUEUE_URL.")
        if not SQS_PROTEIN_QUEUE_URL:
            errors.append("Production AWS mode requires SQS_PROTEIN_QUEUE_URL.")
        if SQS_ECG_QUEUE_URL and SQS_PROTEIN_QUEUE_URL and SQS_ECG_QUEUE_URL == SQS_PROTEIN_QUEUE_URL:
            errors.append("Production AWS mode requires separate ECG and Protein SQS queues.")
        if not COGNITO_USER_POOL_ID:
            errors.append("Production AWS mode requires COGNITO_USER_POOL_ID.")
        if not COGNITO_CLIENT_ID:
            errors.append("Production AWS mode requires COGNITO_CLIENT_ID.")
        # SQLite is strictly forbidden in AWS production mode, even when AWS_ENDPOINT_URL is set
        if DATABASE_URL.startswith("sqlite"):
            errors.append("Production AWS mode requires a managed database (PostgreSQL/Aurora), not SQLite.")
        elif not (DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres")):
            errors.append("Production AWS mode requires a managed PostgreSQL/Aurora database URL.")

    # 4. Validate AWS Batch configuration when protein Batch processing is enabled
    if BATCH_PROTEIN_ENABLED:
        if not BATCH_PROTEIN_JOB_QUEUE:
            errors.append("AWS Batch protein processing is enabled but BATCH_PROTEIN_JOB_QUEUE is missing.")
        if not BATCH_PROTEIN_JOB_DEFINITION:
            errors.append("AWS Batch protein processing is enabled but BATCH_PROTEIN_JOB_DEFINITION is missing.")
    elif BATCH_PROTEIN_JOB_QUEUE and not BATCH_PROTEIN_JOB_DEFINITION:
        errors.append("BATCH_PROTEIN_JOB_QUEUE was provided but BATCH_PROTEIN_JOB_DEFINITION is missing.")
    elif BATCH_PROTEIN_JOB_DEFINITION and not BATCH_PROTEIN_JOB_QUEUE:
        errors.append("BATCH_PROTEIN_JOB_DEFINITION was provided but BATCH_PROTEIN_JOB_QUEUE is missing.")

    return len(errors) == 0, errors
