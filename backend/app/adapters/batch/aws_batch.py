import logging
from typing import Dict, Any, Optional
import boto3
from backend.app.config import (
    AWS_REGION,
    BATCH_PROTEIN_JOB_QUEUE,
    BATCH_PROTEIN_JOB_DEFINITION,
    AWS_ENDPOINT_URL,
)

logger = logging.getLogger(__name__)


class AWSBatchAdapter:
    """
    AWS Batch client for submitting and managing asynchronous GPU compute jobs
    for ESMFold protein structure prediction.
    """

    def __init__(
        self,
        job_queue: str = BATCH_PROTEIN_JOB_QUEUE,
        job_definition: str = BATCH_PROTEIN_JOB_DEFINITION,
        region: str = AWS_REGION,
        endpoint_url: Optional[str] = None,
    ):
        self.job_queue = job_queue
        self.job_definition = job_definition
        self.region = region
        self.endpoint_url = endpoint_url or (AWS_ENDPOINT_URL if AWS_ENDPOINT_URL else None)
        self.client = boto3.client("batch", region_name=self.region, endpoint_url=self.endpoint_url)

    def is_configured(self) -> bool:
        """Checks if AWS Batch queue and job definition are configured."""
        return bool(self.job_queue and self.job_definition)

    def submit_protein_job(
        self,
        job_id: str,
        project_id: str,
        workflow_type: str = "protein",
    ) -> Dict[str, Any]:
        """
        Submits an asynchronous protein prediction job to AWS Batch GPU queue.
        Passes strictly job ID and essential metadata references;
        the worker container fetches inputs securely from database/S3 and writes outputs.
        """
        if not self.is_configured():
            raise RuntimeError(
                "AWS Batch is not configured. Required: BATCH_PROTEIN_JOB_QUEUE and BATCH_PROTEIN_JOB_DEFINITION."
            )

        job_name = f"biocloud-protein-{job_id[:8]}"
        container_overrides = {
            "command": ["python", "-m", "backend.app.workers.protein_worker", "--job-id", job_id],
            "environment": [
                {"name": "JOB_ID", "value": job_id},
                {"name": "PROJECT_ID", "value": str(project_id)},
                {"name": "WORKFLOW_TYPE", "value": workflow_type},
            ],
            "resourceRequirements": [
                {"type": "GPU", "value": "1"},
                {"type": "VCPU", "value": "4"},
                {"type": "MEMORY", "value": "16384"},
            ],
        }

        tags = {
            "BioCloudWorkflow": workflow_type,
            "BioCloudJobId": job_id,
            "BioCloudProjectId": str(project_id),
            "ManagedBy": "BioCloudWorkbench",
        }

        logger.info(
            "Submitting Batch job %s to queue %s with definition %s",
            job_name,
            self.job_queue,
            self.job_definition,
        )

        try:
            response = self.client.submit_job(
                jobName=job_name,
                jobQueue=self.job_queue,
                jobDefinition=self.job_definition,
                containerOverrides=container_overrides,
                tags=tags,
            )
            logger.info("Batch job submitted successfully. BatchJobId=%s", response.get("jobId"))
            return response
        except Exception as exc:
            logger.error("Failed to submit AWS Batch job %s: %s", job_name, exc)
            raise RuntimeError(f"Failed to submit AWS Batch job: {exc}") from exc

    def cancel_batch_job(self, batch_job_id: str, reason: str = "Cancelled by user") -> bool:
        """Terminates or cancels a running/queued AWS Batch job."""
        try:
            self.client.terminate_job(jobId=batch_job_id, reason=reason)
            logger.info("Batch job %s terminated with reason: %s", batch_job_id, reason)
            return True
        except Exception as exc:
            logger.warning("Failed to terminate Batch job %s: %s", batch_job_id, exc)
            return False

    def get_job_status(self, batch_job_id: str) -> Optional[str]:
        """Retrieves AWS Batch job execution status."""
        try:
            response = self.client.describe_jobs(jobs=[batch_job_id])
            jobs = response.get("jobs", [])
            if jobs:
                return jobs[0].get("status")
            return None
        except Exception as exc:
            logger.error("Failed to describe Batch job %s: %s", batch_job_id, exc)
            return None
