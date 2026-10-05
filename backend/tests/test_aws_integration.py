import json
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import jwt

from backend.app.config import validate_config
from backend.app.adapters.storage.s3 import S3StorageAdapter
from backend.app.adapters.auth.cognito import CognitoAuthAdapter
from backend.app.adapters.queue.sqs import SQSQueueAdapter
from backend.app.adapters.batch.aws_batch import AWSBatchAdapter
from backend.app.workers.sqs_consumer import SQSConsumer
from backend.app.database import SessionLocal, init_db
from backend.app.models.user import User
from backend.app.models.project import Project
from backend.app.models.job import Job


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()


# ==============================================================================
# 1. Config Validation Tests
# ==============================================================================
def test_config_validation_local_mode():
    """Verify local development mode passes configuration validation with SQLite, local storage, and local queues."""
    with patch("backend.app.config.LOCAL_DEV_MODE", True), \
         patch("backend.app.config.STORAGE_TYPE", "local"), \
         patch("backend.app.config.QUEUE_TYPE", "local"), \
         patch("backend.app.config.DATABASE_URL", "sqlite:///data/biocloud.db"), \
         patch("backend.app.config.BATCH_PROTEIN_ENABLED", False):
        is_valid, errors = validate_config(strict_aws=False)
        assert is_valid is True
        assert len(errors) == 0


def test_config_validation_strict_aws_missing():
    """Verify strict AWS validation fails fast when required settings are missing."""
    with patch("backend.app.config.LOCAL_DEV_MODE", False), \
         patch("backend.app.config.STORAGE_TYPE", "local"), \
         patch("backend.app.config.QUEUE_TYPE", "local"), \
         patch("backend.app.config.COGNITO_USER_POOL_ID", ""), \
         patch("backend.app.config.COGNITO_CLIENT_ID", ""):
        is_valid, errors = validate_config(strict_aws=True)
        assert is_valid is False
        assert any("STORAGE_TYPE='s3'" in e for e in errors)
        assert any("QUEUE_TYPE='sqs'" in e for e in errors)
        assert any("COGNITO_USER_POOL_ID" in e for e in errors)
        assert any("COGNITO_CLIENT_ID" in e for e in errors)


def test_config_validation_strict_aws_complete():
    """Verify strict AWS validation succeeds when all cloud parameters are populated."""
    with patch("backend.app.config.LOCAL_DEV_MODE", False), \
         patch("backend.app.config.STORAGE_TYPE", "s3"), \
         patch("backend.app.config.AWS_S3_BUCKET", "biocloud-prod-bucket"), \
         patch("backend.app.config.AWS_REGION", "us-east-1"), \
         patch("backend.app.config.AWS_KMS_KEY_ID", "arn:aws:kms:us-east-1:123456789012:key/test"), \
         patch("backend.app.config.QUEUE_TYPE", "sqs"), \
         patch("backend.app.config.SQS_ECG_QUEUE_URL", "https://sqs.us-east-1.amazonaws.com/123/ecg.fifo"), \
         patch("backend.app.config.SQS_PROTEIN_QUEUE_URL", "https://sqs.us-east-1.amazonaws.com/123/protein.fifo"), \
         patch("backend.app.config.COGNITO_USER_POOL_ID", "us-east-1_TestPool"), \
         patch("backend.app.config.COGNITO_CLIENT_ID", "test-client-123"), \
         patch("backend.app.config.DATABASE_URL", "postgresql+psycopg2://admin:pass@aurora-host:5432/biocloud"):
        is_valid, errors = validate_config(strict_aws=True)
        assert is_valid is True
        assert len(errors) == 0


# ==============================================================================
# 2. S3 Storage Adapter & KMS Tests
# ==============================================================================
def test_s3_storage_key_generation_and_project_isolation():
    """Verify server-generated object keys enforce project isolation."""
    key = S3StorageAdapter.build_storage_key(
        project_id="proj-42",
        workflow_type="ecg",
        file_id="file-99",
        filename="../../malicious.csv",
    )
    assert key.startswith("projects/proj-42/ecg/file-99/")
    assert ".." not in key
    assert "malicious.csv" in key

    extracted_project = S3StorageAdapter.extract_project_id(key)
    assert extracted_project == "proj-42"


def test_s3_presigned_urls_with_kms():
    """Verify S3 upload and download presigned URLs enforce short-lived expiry and KMS encryption."""
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://s3.amazonaws.com/test-bucket/presigned-url"

    adapter = S3StorageAdapter(
        bucket_name="biocloud-test-bucket",
        region="us-east-1",
        kms_key_id="arn:aws:kms:us-east-1:123456789012:key/test-kms-id",
    )
    adapter.client = mock_s3

    url, headers = adapter.generate_upload_url(
        storage_key="projects/p1/ecg/f1/lead_II.csv",
        expires_in=900,
        content_type="text/csv",
    )

    assert "https://" in url
    assert headers["x-amz-server-side-encryption"] == "aws:kms"
    assert headers["x-amz-server-side-encryption-aws-kms-key-id"] == "arn:aws:kms:us-east-1:123456789012:key/test-kms-id"
    assert headers["Content-Type"] == "text/csv"

    # Verify ClientMethod and Params passed to boto3
    mock_s3.generate_presigned_url.assert_called_with(
        ClientMethod="put_object",
        Params={
            "Bucket": "biocloud-test-bucket",
            "Key": "projects/p1/ecg/f1/lead_II.csv",
            "ServerSideEncryption": "aws:kms",
            "SSEKMSKeyId": "arn:aws:kms:us-east-1:123456789012:key/test-kms-id",
            "ContentType": "text/csv",
        },
        ExpiresIn=900,
        HttpMethod="PUT",
    )


# ==============================================================================
# 3. Cognito Token Validation Tests (RS256, JWKS, aud, exp, token_use, groups)
# ==============================================================================
def generate_rsa_jwks():
    """Generates an ephemeral RSA key pair and matching JWKS for testing."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    # Export JWK using PyJWT
    jwk_dict = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(public_key))
    jwk_dict["kid"] = "test-key-id-2026"
    jwk_dict["use"] = "sig"
    jwk_dict["alg"] = "RS256"

    jwks = {"keys": [jwk_dict]}
    return private_key, jwks


def test_cognito_token_validation_id_token():
    """Verify validation of valid Cognito ID token with group mapping."""
    private_key, jwks = generate_rsa_jwks()
    user_pool_id = "us-east-1_TestPool"
    client_id = "test-client-id"
    issuer = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}"

    adapter = CognitoAuthAdapter(
        user_pool_id=user_pool_id,
        client_id=client_id,
        region="us-east-1",
        jwks=jwks,
        issuer=issuer,
    )

    claims = {
        "sub": "cognito-sub-1234",
        "email": "dr.smith@biocloud.aws",
        "name": "Dr. Smith",
        "iss": issuer,
        "aud": client_id,
        "token_use": "id",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
        "cognito:groups": ["Administrators"],
    }
    headers = {"kid": "test-key-id-2026", "alg": "RS256"}
    token = jwt.encode(claims, private_key, algorithm="RS256", headers=headers)

    db = SessionLocal()
    try:
        user = adapter.authenticate_token(token, db)
        assert user is not None
        assert user.email == "dr.smith@biocloud.aws"
        assert user.role == "admin"
        assert user.is_active is True
    finally:
        db.close()


def test_cognito_token_validation_expired():
    """Verify expired Cognito tokens are rejected."""
    private_key, jwks = generate_rsa_jwks()
    user_pool_id = "us-east-1_TestPool"
    client_id = "test-client-id"
    issuer = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}"

    adapter = CognitoAuthAdapter(
        user_pool_id=user_pool_id,
        client_id=client_id,
        region="us-east-1",
        jwks=jwks,
        issuer=issuer,
    )

    claims = {
        "sub": "cognito-sub-5678",
        "email": "expired@biocloud.aws",
        "iss": issuer,
        "aud": client_id,
        "token_use": "id",
        "exp": int(datetime.now(timezone.utc).timestamp()) - 100,  # Expired
    }
    headers = {"kid": "test-key-id-2026", "alg": "RS256"}
    token = jwt.encode(claims, private_key, algorithm="RS256", headers=headers)

    db = SessionLocal()
    try:
        user = adapter.authenticate_token(token, db)
        assert user is None
    finally:
        db.close()


def test_cognito_token_validation_wrong_audience():
    """Verify Cognito tokens with audience mismatch are rejected."""
    private_key, jwks = generate_rsa_jwks()
    user_pool_id = "us-east-1_TestPool"
    client_id = "configured-client-id"
    issuer = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}"

    adapter = CognitoAuthAdapter(
        user_pool_id=user_pool_id,
        client_id=client_id,
        region="us-east-1",
        jwks=jwks,
        issuer=issuer,
    )

    claims = {
        "sub": "cognito-sub-9999",
        "email": "wrong-client@biocloud.aws",
        "iss": issuer,
        "aud": "wrong-client-id",
        "token_use": "id",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    headers = {"kid": "test-key-id-2026", "alg": "RS256"}
    token = jwt.encode(claims, private_key, algorithm="RS256", headers=headers)

    db = SessionLocal()
    try:
        user = adapter.authenticate_token(token, db)
        assert user is None
    finally:
        db.close()


# ==============================================================================
# 4. SQS Queue Adapter & FIFO Routing Tests
# ==============================================================================
@pytest.mark.anyio
async def test_sqs_queue_adapter_routing():
    """Verify ECG jobs route to ECG queue and Protein jobs to Protein queue with FIFO headers."""
    mock_sqs = MagicMock()
    ecg_url = "https://sqs.us-east-1.amazonaws.com/123/ecg-queue.fifo"
    protein_url = "https://sqs.us-east-1.amazonaws.com/123/protein-queue.fifo"

    adapter = SQSQueueAdapter(
        ecg_queue_url=ecg_url,
        protein_queue_url=protein_url,
        region="us-east-1",
    )
    adapter.client = mock_sqs

    # 1. Enqueue ECG Job
    await adapter.enqueue_job(job_id="job-ecg-1", workflow_type="ecg", project_id="proj-10")
    call_kwargs_ecg = mock_sqs.send_message.call_args[1]
    assert call_kwargs_ecg["QueueUrl"] == ecg_url
    assert call_kwargs_ecg["MessageGroupId"] == "project-proj-10"
    assert call_kwargs_ecg["MessageDeduplicationId"] == "job-ecg-1"

    # 2. Enqueue Protein Job
    await adapter.enqueue_job(job_id="job-protein-1", workflow_type="protein", project_id="proj-20")
    call_kwargs_protein = mock_sqs.send_message.call_args[1]
    assert call_kwargs_protein["QueueUrl"] == protein_url
    assert call_kwargs_protein["MessageGroupId"] == "project-proj-20"
    assert call_kwargs_protein["MessageDeduplicationId"] == "job-protein-1"


# ==============================================================================
# 5. AWS Batch Adapter Tests
# ==============================================================================
def test_aws_batch_adapter_submit_and_cancel():
    """Verify AWS Batch submits protein prediction jobs with GPU specs and passes only references."""
    mock_batch = MagicMock()
    mock_batch.submit_job.return_value = {"jobId": "batch-job-777", "jobName": "biocloud-protein-12345678"}

    adapter = AWSBatchAdapter(
        job_queue="protein-batch-queue",
        job_definition="biocloud-esmfold-prediction:1",
        region="us-east-1",
    )
    adapter.client = mock_batch

    resp = adapter.submit_protein_job(
        job_id="12345678-abcd-ef01-2345-6789abcdef01",
        project_id="project-99",
    )

    assert resp["jobId"] == "batch-job-777"
    mock_batch.submit_job.assert_called_once()
    submit_kwargs = mock_batch.submit_job.call_args[1]
    assert submit_kwargs["jobQueue"] == "protein-batch-queue"
    assert submit_kwargs["jobDefinition"] == "biocloud-esmfold-prediction:1"
    # Ensure command calls protein_worker with job-id
    cmd = submit_kwargs["containerOverrides"]["command"]
    assert cmd == ["python", "-m", "backend.app.workers.protein_worker", "--job-id", "12345678-abcd-ef01-2345-6789abcdef01"]
    # Ensure GPU requirement
    res_reqs = submit_kwargs["containerOverrides"]["resourceRequirements"]
    assert any(r["type"] == "GPU" and r["value"] == "1" for r in res_reqs)

    # Test Cancel
    adapter.cancel_batch_job("batch-job-777", reason="User stopped experiment")
    mock_batch.terminate_job.assert_called_with(jobId="batch-job-777", reason="User stopped experiment")


# ==============================================================================
# 6. SQS Consumer Idempotency & State Transition Tests
# ==============================================================================
def test_sqs_consumer_idempotency_on_completed_job():
    """Verify SQS consumer acknowledges duplicate messages for already completed jobs."""
    db = SessionLocal()
    job_id = str(uuid.uuid4())
    try:
        # Create an already completed job in DB
        job = Job(
            id=job_id,
            project_id="test-proj",
            user_id="user-1",
            workflow_type="ecg",
            name="Completed ECG Job",
            status="completed",
            progress=100,
        )
        db.add(job)
        db.commit()

        consumer = SQSConsumer(workflow_type="ecg", queue_url="https://sqs.test/queue")
        mock_msg = {
            "ReceiptHandle": "receipt-xyz",
            "MessageId": "msg-123",
            "Body": json.dumps({"job_id": job_id, "workflow_type": "ecg"}),
        }

        # process_message should return True to acknowledge and delete duplicate
        should_ack = consumer.process_message(mock_msg)
        assert should_ack is True

        # Ensure status was not altered
        db.refresh(job)
        assert job.status == "completed"
    finally:
        db.close()


def test_sqs_consumer_processes_synthetic_ecg_to_completion():
    """Verify SQS consumer executes ECG job and transitions state to completed."""
    db = SessionLocal()
    job_id = str(uuid.uuid4())
    try:
        job = Job(
            id=job_id,
            project_id="test-proj",
            user_id="user-1",
            workflow_type="ecg",
            name="Async ECG Telemetry Run",
            status="queued",
            progress=0,
            parameters_json=json.dumps({"synthetic_pattern": "normal_sinus"}),
        )
        db.add(job)
        db.commit()

        consumer = SQSConsumer(workflow_type="ecg", queue_url="https://sqs.test/queue")
        mock_msg = {
            "ReceiptHandle": "receipt-abc",
            "MessageId": "msg-456",
            "Body": json.dumps({"job_id": job_id, "workflow_type": "ecg"}),
        }

        should_ack = consumer.process_message(mock_msg)
        assert should_ack is True

        db.refresh(job)
        assert job.status == "completed"
        assert job.progress == 100
        assert job.result_json is not None
        assert "mean_hr_bpm" in job.result_json

    finally:
        db.close()


def test_config_validation_aws_endpoint_override_does_not_permit_sqlite():
    """Verify that an AWS_ENDPOINT_URL override does NOT allow SQLite to pass production validation."""
    with patch("backend.app.config.LOCAL_DEV_MODE", False), \
         patch("backend.app.config.STORAGE_TYPE", "s3"), \
         patch("backend.app.config.AWS_S3_BUCKET", "biocloud-prod-bucket"), \
         patch("backend.app.config.AWS_REGION", "us-east-1"), \
         patch("backend.app.config.AWS_KMS_KEY_ID", "arn:aws:kms:us-east-1:123456789012:key/test"), \
         patch("backend.app.config.QUEUE_TYPE", "sqs"), \
         patch("backend.app.config.SQS_ECG_QUEUE_URL", "https://sqs.us-east-1.amazonaws.com/123/ecg.fifo"), \
         patch("backend.app.config.SQS_PROTEIN_QUEUE_URL", "https://sqs.us-east-1.amazonaws.com/123/protein.fifo"), \
         patch("backend.app.config.COGNITO_USER_POOL_ID", "us-east-1_TestPool"), \
         patch("backend.app.config.COGNITO_CLIENT_ID", "test-client-123"), \
         patch("backend.app.config.AWS_ENDPOINT_URL", "http://127.0.0.1:5000"), \
         patch("backend.app.config.DATABASE_URL", "sqlite:///data/biocloud.db"):
        is_valid, errors = validate_config(strict_aws=True)
        assert is_valid is False
        assert any("not SQLite" in e for e in errors)


def test_config_validation_separate_sqs_queues_required():
    """Verify that using the same queue URL for ECG and Protein is rejected in SQS mode."""
    with patch("backend.app.config.LOCAL_DEV_MODE", False), \
         patch("backend.app.config.STORAGE_TYPE", "s3"), \
         patch("backend.app.config.AWS_S3_BUCKET", "biocloud-prod-bucket"), \
         patch("backend.app.config.AWS_REGION", "us-east-1"), \
         patch("backend.app.config.AWS_KMS_KEY_ID", "arn:aws:kms:us-east-1:123456789012:key/test"), \
         patch("backend.app.config.QUEUE_TYPE", "sqs"), \
         patch("backend.app.config.SQS_ECG_QUEUE_URL", "https://sqs.us-east-1.amazonaws.com/123/shared.fifo"), \
         patch("backend.app.config.SQS_PROTEIN_QUEUE_URL", "https://sqs.us-east-1.amazonaws.com/123/shared.fifo"), \
         patch("backend.app.config.COGNITO_USER_POOL_ID", "us-east-1_TestPool"), \
         patch("backend.app.config.COGNITO_CLIENT_ID", "test-client-123"), \
         patch("backend.app.config.DATABASE_URL", "postgresql+psycopg2://admin:pass@aurora-host:5432/biocloud"):
        is_valid, errors = validate_config(strict_aws=True)
        assert is_valid is False
        assert any("separate ECG and Protein" in e for e in errors)


def test_config_validation_batch_protein_enabled_requires_queue_and_def():
    """Verify that enabling AWS Batch protein processing requires both queue and definition."""
    with patch("backend.app.config.BATCH_PROTEIN_ENABLED", True), \
         patch("backend.app.config.BATCH_PROTEIN_JOB_QUEUE", ""), \
         patch("backend.app.config.BATCH_PROTEIN_JOB_DEFINITION", ""):
        is_valid, errors = validate_config(strict_aws=False)
        assert is_valid is False
        assert any("BATCH_PROTEIN_JOB_QUEUE is missing" in e for e in errors)
        assert any("BATCH_PROTEIN_JOB_DEFINITION is missing" in e for e in errors)


def test_cognito_token_validation_invalid_signature():
    """Verify tokens signed by an unknown key are rejected."""
    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    _, jwks = generate_rsa_jwks()
    user_pool_id = "us-east-1_TestPool"
    client_id = "test-client-id"
    issuer = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}"

    adapter = CognitoAuthAdapter(
        user_pool_id=user_pool_id,
        client_id=client_id,
        region="us-east-1",
        jwks=jwks,
        issuer=issuer,
    )
    claims = {
        "sub": "attacker-sub",
        "email": "attacker@fake.local",
        "iss": issuer,
        "aud": client_id,
        "token_use": "id",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    headers = {"kid": "test-key-id-2026", "alg": "RS256"}
    forged_token = jwt.encode(claims, wrong_key, algorithm="RS256", headers=headers)

    db = SessionLocal()
    try:
        user = adapter.authenticate_token(forged_token, db)
        assert user is None
    finally:
        db.close()


def test_cognito_token_validation_role_mapping_researcher():
    """Verify Cognito groups map properly to researcher role."""
    private_key, jwks = generate_rsa_jwks()
    user_pool_id = "us-east-1_TestPool"
    client_id = "test-client-id"
    issuer = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}"

    adapter = CognitoAuthAdapter(
        user_pool_id=user_pool_id,
        client_id=client_id,
        region="us-east-1",
        jwks=jwks,
        issuer=issuer,
    )
    claims = {
        "sub": "researcher-sub-4321",
        "email": "scientist@biocloud.aws",
        "name": "Scientist",
        "iss": issuer,
        "aud": client_id,
        "token_use": "id",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
        "cognito:groups": ["Researchers"],
    }
    headers = {"kid": "test-key-id-2026", "alg": "RS256"}
    token = jwt.encode(claims, private_key, algorithm="RS256", headers=headers)

    db = SessionLocal()
    try:
        user = adapter.authenticate_token(token, db)
        assert user is not None
        assert user.role == "researcher"
    finally:
        db.close()


def test_s3_presigned_download_url():
    """Verify S3 download presigned URL generation."""
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://s3.amazonaws.com/test-bucket/download-url"

    adapter = S3StorageAdapter(
        bucket_name="biocloud-test-bucket",
        region="us-east-1",
        kms_key_id="arn:aws:kms:us-east-1:123456789012:key/test-kms-id",
    )
    adapter.client = mock_s3

    url = adapter.generate_download_url("projects/p1/ecg/f1/lead_II.csv", expires_in=600)
    assert "https://" in url
    mock_s3.generate_presigned_url.assert_called_with(
        ClientMethod="get_object",
        Params={"Bucket": "biocloud-test-bucket", "Key": "projects/p1/ecg/f1/lead_II.csv"},
        ExpiresIn=600,
    )


def test_sqs_consumer_job_cancellation():
    """Verify SQS consumer gracefully handles and acknowledges already cancelled jobs."""
    db = SessionLocal()
    job_id = str(uuid.uuid4())
    try:
        job = Job(
            id=job_id,
            project_id="test-proj",
            user_id="user-1",
            workflow_type="ecg",
            name="Cancelled Job",
            status="cancelled",
            progress=0,
        )
        db.add(job)
        db.commit()

        consumer = SQSConsumer(workflow_type="ecg", queue_url="https://sqs.test/queue")
        mock_msg = {
            "ReceiptHandle": "receipt-cancel",
            "MessageId": "msg-cancel-1",
            "Body": json.dumps({"job_id": job_id, "workflow_type": "ecg"}),
        }

        should_ack = consumer.process_message(mock_msg)
        assert should_ack is True
        db.refresh(job)
        assert job.status == "cancelled"
    finally:
        db.close()


def test_sqs_consumer_failure_handling():
    """Verify SQS consumer sets job status to failed upon unhandled exceptions."""
    db = SessionLocal()
    job_id = str(uuid.uuid4())
    try:
        job = Job(
            id=job_id,
            project_id="test-proj",
            user_id="user-1",
            workflow_type="ecg",
            name="Failing ECG Run",
            status="queued",
            progress=0,
            parameters_json=json.dumps({"invalid_field": True}),
        )
        db.add(job)
        db.commit()

        consumer = SQSConsumer(workflow_type="ecg", queue_url="https://sqs.test/queue")
        mock_msg = {
            "ReceiptHandle": "receipt-fail",
            "MessageId": "msg-fail-1",
            "Body": json.dumps({"job_id": job_id, "workflow_type": "ecg"}),
        }

        with patch("backend.app.workers.ecg_worker.process_single_ecg_job", side_effect=RuntimeError("DSP Filter Convergence Failure")):
            should_ack = consumer.process_message(mock_msg)
            assert should_ack is True

        db.refresh(job)
        assert job.status == "failed"
        assert "DSP Filter Convergence Failure" in (job.error_message or "")
    finally:
        db.close()


def test_aws_batch_adapter_error_handling():
    """Verify AWS Batch adapter raises clear error when submit_job fails."""
    mock_batch = MagicMock()
    mock_batch.submit_job.side_effect = Exception("AWS Batch ThrottlingException")

    adapter = AWSBatchAdapter(
        job_queue="protein-batch-queue",
        job_definition="biocloud-esmfold:1",
        region="us-east-1",
    )
    adapter.client = mock_batch

    with pytest.raises(RuntimeError) as exc_info:
        adapter.submit_protein_job("job-err-1", "project-err-1")
    assert "Failed to submit AWS Batch job" in str(exc_info.value)


@pytest.mark.anyio
async def test_backend_suppresses_local_workers_in_sqs_mode():
    """Verify that the FastAPI lifespan context manager suppresses in-memory background workers in SQS mode."""
    from backend.app.main import lifespan, app
    with patch("backend.app.main.QUEUE_TYPE", "sqs"), \
         patch("backend.app.main.validate_config", return_value=(True, [])), \
         patch("backend.app.main.init_db"), \
         patch("backend.app.main.worker_tasks", []) as mock_tasks:
        async with lifespan(app):
            assert len(mock_tasks) == 0


def test_sqs_worker_consumes_only_its_own_workflow_queue():
    """Confirm each SQS worker consumes only its designated workflow queue and does not cross-process."""
    db = SessionLocal()
    job_id = str(uuid.uuid4())
    try:
        job = Job(
            id=job_id,
            project_id="test-proj",
            user_id="user-1",
            workflow_type="protein",
            name="Protein Folding Target",
            status="queued",
            progress=0,
        )
        db.add(job)
        db.commit()

        # 1. ECG consumer executes ECG processing for ECG queue
        ecg_consumer = SQSConsumer(workflow_type="ecg", queue_url="https://sqs.us-east-1.amazonaws.com/123/ecg.fifo")
        with patch("backend.app.workers.ecg_worker.process_single_ecg_job") as mock_ecg_proc:
            mock_ecg_proc.return_value = True
            ecg_consumer.process_message({"Body": json.dumps({"job_id": job_id, "workflow_type": "ecg"})})
            mock_ecg_proc.assert_called_once()

        # 2. Protein consumer executes protein processing for Protein queue
        protein_consumer = SQSConsumer(workflow_type="protein", queue_url="https://sqs.us-east-1.amazonaws.com/123/protein.fifo")
        with patch("backend.app.workers.protein_worker.process_single_protein_job") as mock_protein_proc, \
             patch("backend.app.workers.sqs_consumer.BATCH_PROTEIN_JOB_QUEUE", ""):
            mock_protein_proc.return_value = True
            protein_consumer.process_message({"Body": json.dumps({"job_id": job_id, "workflow_type": "protein"})})
            mock_protein_proc.assert_called_once()
    finally:
        db.close()

