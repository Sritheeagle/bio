import sys
import time
import json
import logging
import argparse
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import boto3
from sqlalchemy.orm import Session

from backend.app.config import (
    AWS_REGION,
    SQS_ECG_QUEUE_URL,
    SQS_PROTEIN_QUEUE_URL,
    BATCH_PROTEIN_JOB_QUEUE,
    BATCH_PROTEIN_JOB_DEFINITION,
    AWS_ENDPOINT_URL,
)
from backend.app.database import SessionLocal
from backend.app.models.job import Job
from backend.app.adapters.batch import get_batch_adapter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("BioCloud.SQSConsumer")


class SQSConsumer:
    """
    Production AWS SQS Consumer for BioCloud Workbench.
    - Long-polls dedicated SQS FIFO/Standard queue
    - Validates message schema
    - Enforces idempotency against durable PostgreSQL job records
    - Dispatches to processing engines or AWS Batch
    - Handles visibility timeouts, acknowledgments, and dead-letter queues
    """

    def __init__(
        self,
        workflow_type: str,
        queue_url: str,
        region: str = AWS_REGION,
        endpoint_url: Optional[str] = None,
    ):
        self.workflow_type = workflow_type.lower()
        self.queue_url = queue_url
        self.region = region
        self.endpoint_url = endpoint_url or (AWS_ENDPOINT_URL if AWS_ENDPOINT_URL else None)
        self.client = boto3.client("sqs", region_name=self.region, endpoint_url=self.endpoint_url)
        self.running = True

    def process_message(self, message: Dict[str, Any]) -> bool:
        """
        Processes a single SQS message with idempotency and durable state updates.
        Returns True if message should be acknowledged (deleted from queue), False to retry.
        """
        receipt_handle = message.get("ReceiptHandle")
        message_id = message.get("MessageId")
        body_raw = message.get("Body", "{}")

        # 1. Validate JSON schema
        try:
            body = json.loads(body_raw)
            job_id = body.get("job_id")
        except Exception as exc:
            logger.error("Corrupted message %s rejected (invalid JSON): %s", message_id, exc)
            return True  # Acknowledge corrupted message to prevent poison pill loops

        if not job_id:
            logger.error("Message %s missing job_id. Acknowledging to purge.", message_id)
            return True

        db: Session = SessionLocal()
        try:
            # 2. Idempotency Check in PostgreSQL
            job: Optional[Job] = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                logger.warning("Job %s referenced in SQS not found in DB. Purging message.", job_id)
                return True

            # If job is already in a terminal state, delete SQS message (idempotent no-op)
            if job.status in ("completed", "cancelled"):
                logger.info("Job %s is already %s. Acknowledging duplicate SQS message.", job_id, job.status)
                return True

            # Check if job was cancelled while waiting in SQS
            if job.status == "cancelled":
                logger.info("Job %s was cancelled by user. Acknowledging message.", job_id)
                return True

            logger.info("Processing %s job %s from SQS (Current DB status: %s)", self.workflow_type, job_id, job.status)

            # 3. Handle Workflow Dispatch
            if self.workflow_type == "protein" and BATCH_PROTEIN_JOB_QUEUE and BATCH_PROTEIN_JOB_DEFINITION:
                # Dispatch to AWS Batch GPU compute environment
                batch_adapter = get_batch_adapter()
                batch_resp = batch_adapter.submit_protein_job(
                    job_id=job.id,
                    project_id=job.project_id,
                    workflow_type="protein",
                )
                batch_job_id = batch_resp.get("jobId")

                job.status = "processing"
                job.stage = f"Dispatched to AWS Batch GPU queue (BatchJobId: {batch_job_id})"
                job.started_at = datetime.now(timezone.utc)
                db.commit()
                logger.info("Job %s dispatched to AWS Batch successfully (BatchJobId=%s)", job_id, batch_job_id)
                return True

            elif self.workflow_type == "ecg":
                # Run synchronous ECG processing pipeline
                from backend.app.workers.ecg_worker import process_single_ecg_job
                success = process_single_ecg_job(job_id=job_id, db=db)
                return success

            elif self.workflow_type == "protein":
                # Run local container protein pipeline
                from backend.app.workers.protein_worker import process_single_protein_job
                success = process_single_protein_job(job_id=job_id, db=db)
                return success

            else:
                logger.error("Unknown workflow type %s", self.workflow_type)
                return True

        except Exception as exc:
            logger.error("Failed processing SQS message for job %s: %s", job_id, exc, exc_info=True)
            db.rollback()
            try:
                failed_job = db.query(Job).filter(Job.id == job_id).first()
                if failed_job and failed_job.status != "cancelled":
                    failed_job.status = "failed"
                    failed_job.stage = "Execution failed"
                    failed_job.error_message = str(exc)
                    failed_job.completed_at = datetime.now(timezone.utc)
                    db.commit()
            except Exception:
                pass
            # Return True to acknowledge and avoid infinite loop if terminal,
            # or allow SQS redrive policy to handle DLQ
            return True
        finally:
            db.close()

    def run_loop(self):
        """Main polling loop with long polling and visibility timeout."""
        logger.info(
            "Starting BioCloud SQS consumer for '%s' queue: %s (Region: %s)",
            self.workflow_type,
            self.queue_url,
            self.region,
        )

        while self.running:
            try:
                response = self.client.receive_message(
                    QueueUrl=self.queue_url,
                    MaxNumberOfMessages=1,
                    WaitTimeSeconds=20,  # AWS SQS Long Polling
                    VisibilityTimeout=300,  # 5 minutes visibility timeout
                    AttributeNames=["All"],
                    MessageAttributeNames=["All"],
                )

                messages = response.get("Messages", [])
                if not messages:
                    continue

                for msg in messages:
                    should_ack = self.process_message(msg)
                    if should_ack:
                        try:
                            self.client.delete_message(
                                QueueUrl=self.queue_url,
                                ReceiptHandle=msg["ReceiptHandle"],
                            )
                            logger.info("SQS message acknowledged and deleted for job.")
                        except Exception as del_exc:
                            logger.warning("Failed to delete SQS message: %s", del_exc)

            except KeyboardInterrupt:
                logger.info("Consumer shutdown requested.")
                self.running = False
                break
            except Exception as loop_exc:
                logger.error("Error in SQS receive loop: %s", loop_exc)
                time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description="BioCloud SQS Queue Consumer Daemon")
    parser.add_argument(
        "--workflow",
        choices=["ecg", "protein"],
        required=True,
        help="Workflow type to consume: 'ecg' or 'protein'",
    )
    parser.add_argument(
        "--queue-url",
        required=False,
        help="Target SQS queue URL. Defaults to env config.",
    )
    args = parser.parse_args()

    if args.workflow == "ecg":
        queue_url = args.queue_url or SQS_ECG_QUEUE_URL
    else:
        queue_url = args.queue_url or SQS_PROTEIN_QUEUE_URL

    if not queue_url:
        logger.error("No queue URL configured for workflow '%s'. Aborting.", args.workflow)
        sys.exit(1)

    consumer = SQSConsumer(workflow_type=args.workflow, queue_url=queue_url)
    consumer.run_loop()


if __name__ == "__main__":
    main()
