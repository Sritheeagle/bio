from fastapi import APIRouter
from backend.app.config import (
    ENVIRONMENT,
    STORAGE_TYPE,
    AWS_S3_BUCKET,
    AWS_REGION,
    AWS_KMS_KEY_ID,
    LOCAL_DEV_MODE,
    QUEUE_TYPE,
    SQS_ECG_QUEUE_URL,
    SQS_PROTEIN_QUEUE_URL,
    BATCH_PROTEIN_JOB_QUEUE,
    BATCH_PROTEIN_JOB_DEFINITION,
    COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID,
    DATABASE_URL,
    AWS_ENDPOINT_URL,
    VERSION,
    validate_config,
)
from backend.app.pipelines.protein.esmfold import ESMFoldAdapter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    esm_available, esm_msg, _ = ESMFoldAdapter.check_availability()
    is_valid, validation_errors = validate_config(strict_aws=not LOCAL_DEV_MODE)
    is_valid_prod, _ = validate_config(strict_aws=True)

    # AWS mode requires strict production validation (PostgreSQL, KMS S3, SQS FIFO, Cognito)
    is_aws_configured = not LOCAL_DEV_MODE and is_valid_prod and not DATABASE_URL.startswith("sqlite")

    return {
        "status": "healthy",
        "service": "BioCloud Workbench API",
        "version": VERSION,
        "environment": ENVIRONMENT,
        "local_dev_mode": LOCAL_DEV_MODE,
        "aws_connected": is_aws_configured,
        "aws_emulator_mode": bool(AWS_ENDPOINT_URL),
        "config_valid": is_valid,
        "config_errors": validation_errors,
        "auth_provider": "local_jwt" if LOCAL_DEV_MODE else "cognito",
        "storage": {
            "type": STORAGE_TYPE,
            "bucket": AWS_S3_BUCKET if STORAGE_TYPE == "s3" else "local_disk",
            "region": AWS_REGION if STORAGE_TYPE == "s3" else None,
            "kms_encrypted": bool(AWS_KMS_KEY_ID),
        },
        "queue": {
            "type": QUEUE_TYPE,
            "ecg_queue_configured": bool(SQS_ECG_QUEUE_URL),
            "protein_queue_configured": bool(SQS_PROTEIN_QUEUE_URL),
            "batch_configured": bool(BATCH_PROTEIN_JOB_QUEUE and BATCH_PROTEIN_JOB_DEFINITION),
        },
        "database": {
            "engine": "sqlite" if DATABASE_URL.startswith("sqlite") else "postgresql",
        },
        "workers": {
            "ecg_dsp_worker": "active",
            "protein_structure_worker": "active",
            "esmfold_runtime": esm_msg,
        },
    }

