import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import boto3
from backend.app.config import (
    AWS_REGION,
    SQS_ECG_QUEUE_URL,
    SQS_PROTEIN_QUEUE_URL,
    AWS_ENDPOINT_URL,
)
from backend.app.adapters.queue.base import QueueAdapter

logger = logging.getLogger(__name__)


class SQSQueueAdapter(QueueAdapter):
    """
    AWS SQS Queue Adapter with separate ECG and Protein FIFO/Standard queues,
    automatic deduplication, message group routing, and retry/DLQ support.
    """

    def __init__(
        self,
        ecg_queue_url: str = SQS_ECG_QUEUE_URL,
        protein_queue_url: str = SQS_PROTEIN_QUEUE_URL,
        region: str = AWS_REGION,
        endpoint_url: Optional[str] = None,
    ):
        self.ecg_queue_url = ecg_queue_url
        self.protein_queue_url = protein_queue_url
        self.region = region
        self.endpoint_url = endpoint_url or (AWS_ENDPOINT_URL if AWS_ENDPOINT_URL else None)
        self.client = boto3.client("sqs", region_name=self.region, endpoint_url=self.endpoint_url)

    def get_queue_url(self, workflow_type: str) -> str:
        """Route job to corresponding SQS queue based on workflow type."""
        if workflow_type == "ecg":
            if not self.ecg_queue_url:
                raise ValueError("SQS_ECG_QUEUE_URL is not configured.")
            return self.ecg_queue_url
        elif workflow_type == "protein":
            if not self.protein_queue_url:
                raise ValueError("SQS_PROTEIN_QUEUE_URL is not configured.")
            return self.protein_queue_url
        else:
            raise ValueError(f"Unknown workflow type '{workflow_type}'. Supported: 'ecg', 'protein'.")

    async def enqueue_job(
        self, job_id: str, workflow_type: str, project_id: Optional[str] = None
    ) -> None:
        """
        Enqueues job reference to corresponding SQS queue.
        Supports FIFO queue deduplication and message group grouping by project.
        """
        target_queue_url = self.get_queue_url(workflow_type)
        payload = {
            "job_id": job_id,
            "workflow_type": workflow_type,
            "project_id": project_id,
            "enqueued_at": datetime.now(timezone.utc).isoformat(),
        }

        send_params: Dict[str, Any] = {
            "QueueUrl": target_queue_url,
            "MessageBody": json.dumps(payload),
            "MessageAttributes": {
                "WorkflowType": {"DataType": "String", "StringValue": workflow_type},
                "JobId": {"DataType": "String", "StringValue": job_id},
            },
        }

        # Apply FIFO specific requirements if queue is FIFO
        if target_queue_url.endswith(".fifo"):
            # Group by project to preserve per-project ordering while enabling cross-project concurrency
            send_params["MessageGroupId"] = f"project-{project_id or 'default'}"
            # Deduplicate by job_id to guarantee exactly-once enqueue
            send_params["MessageDeduplicationId"] = job_id

        logger.info("Dispatching %s job %s to SQS queue %s", workflow_type, job_id, target_queue_url)
        self.client.send_message(**send_params)

    def cancel_job(self, job_id: str) -> bool:
        """
        Signal cancellation for a job.
        In the SQS/PostgreSQL architecture, job cancellation is persisted durably in PostgreSQL.
        The SQS consumer verifies job.status prior to each execution phase and halts immediately
        if status is 'cancelled'.
        """
        logger.info("Cancellation requested for SQS job %s", job_id)
        return True

