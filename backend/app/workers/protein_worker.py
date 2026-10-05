import asyncio
import json
import hashlib
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.database import SessionLocal
from backend.app.models.job import Job
from backend.app.models.file import UploadedFile
from backend.app.adapters.storage import get_storage_adapter
from backend.app.adapters.queue.local import protein_queue, get_cancellation_event
from backend.app.pipelines.protein.validator import parse_and_validate_fasta
from backend.app.pipelines.protein.esmfold import ESMFoldAdapter
from backend.app.pipelines.protein.references import get_reference_benchmark


import sys
import json
import logging
import hashlib
import argparse
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.database import SessionLocal
from backend.app.models.job import Job
from backend.app.models.file import UploadedFile
from backend.app.adapters.storage import get_storage_adapter
from backend.app.adapters.queue.local import protein_queue, get_cancellation_event
from backend.app.pipelines.protein.validator import parse_and_validate_fasta
from backend.app.pipelines.protein.esmfold import ESMFoldAdapter
from backend.app.pipelines.protein.references import get_reference_benchmark

logger = logging.getLogger("BioCloud.ProteinWorker")


def process_single_protein_job(job_id: str, db: Optional[Session] = None) -> bool:
    """
    Executes protein structure prediction pipeline for a single job.
    Called by local in-memory worker, SQS consumer, or directly within AWS Batch GPU container.
    Strictly adheres to scientific integrity: custom sequences without GPU/ESMFold weights
    are marked as 'failed' with actionable setup instructions; never emits fake coordinates.
    """
    close_db_on_exit = False
    if db is None:
        db = SessionLocal()
        close_db_on_exit = True

    try:
        job: Optional[Job] = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.warning("Protein job %s not found in database.", job_id)
            return True

        if job.status in ("completed", "cancelled"):
            logger.info("Protein job %s is already in state %s. Skipping.", job_id, job.status)
            return True

        cancel_event = get_cancellation_event(job_id)
        if cancel_event.is_set() or job.status == "cancelled":
            job.status = "cancelled"
            job.stage = "Cancelled before execution"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        job.status = "processing"
        job.started_at = datetime.now(timezone.utc)
        job.progress = 15
        job.stage = "Reading and validating FASTA sequence"
        db.commit()

        # Parse parameters
        params = json.loads(job.parameters_json) if job.parameters_json else {}
        seq_text = params.get("sequence") or params.get("fasta_sequence") or params.get("fasta_raw") or ""
        header = params.get("header") or params.get("sequence_name") or params.get("name") or ""
        benchmark_id = params.get("reference_benchmark") or params.get("benchmark_id") or params.get("benchmark")

        storage = get_storage_adapter()
        fasta_raw = None
        input_checksum = None

        if benchmark_id:
            ref = get_reference_benchmark(benchmark_id)
            if ref:
                fasta_raw = f">{ref['header']}\n{ref['sequence']}"
                input_checksum = hashlib.sha256(fasta_raw.encode("utf-8")).hexdigest()

        if not fasta_raw and job.input_file_id:
            uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == job.input_file_id).first()
            if uploaded_file:
                file_bytes = storage.get_object(uploaded_file.storage_key)
                fasta_raw = file_bytes.decode("utf-8", errors="ignore")
                input_checksum = uploaded_file.sha256_checksum or hashlib.sha256(file_bytes).hexdigest()

        if not fasta_raw and seq_text:
            fasta_raw = seq_text if seq_text.startswith(">") else f">{header or 'target_seq'}\n{seq_text}"
            input_checksum = hashlib.sha256(fasta_raw.encode("utf-8")).hexdigest()

        if not fasta_raw:
            raise ValueError("No protein sequence or reference benchmark specified.")

        # Check cancellation
        db.refresh(job)
        if job.status == "cancelled" or cancel_event.is_set():
            job.status = "cancelled"
            job.stage = "Cancelled by user"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        # Validate FASTA
        sequence, parsed_header, meta = parse_and_validate_fasta(fasta_raw)

        job.progress = 40
        job.stage = "Checking model backend & preparing inference tensor"
        db.commit()

        # Check cancellation
        db.refresh(job)
        if job.status == "cancelled" or cancel_event.is_set():
            job.status = "cancelled"
            job.stage = "Cancelled by user"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        job.progress = 70
        job.stage = "Running protein structure prediction"
        db.commit()

        result = ESMFoldAdapter.predict(
            sequence=sequence,
            header=parsed_header,
            metadata=meta,
            params=params,
        )

        # Check cancellation
        db.refresh(job)
        if job.status == "cancelled" or cancel_event.is_set():
            job.status = "cancelled"
            job.stage = "Cancelled by user"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        # Scientific Integrity Enforcement:
        # If user did NOT explicitly request a reference benchmark, but model backend is unconfigured,
        # fail the job with a clear setup error rather than fabricating output.
        is_user_benchmark_request = bool(benchmark_id)
        if not is_user_benchmark_request and result.get("is_reference_benchmark"):
            job.status = "failed"
            job.progress = 100
            job.stage = "Model Execution Unavailable"
            job.error_message = (
                "Real structure prediction requires PyTorch GPU or configured ESMFold container. "
                "Per research integrity guidelines, reference benchmark samples are not presented for custom sequences."
            )
            job.result_json = json.dumps(result)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        if result.get("model_status") == "model_unavailable":
            job.status = "failed"
            job.progress = 100
            job.stage = "Model Execution Unavailable"
            job.error_message = (
                "Real structure prediction requires PyTorch GPU or configured ESMFold container. "
                "Per research integrity guidelines, simulated outputs are disabled."
            )
            job.result_json = json.dumps(result)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        if result.get("model_status") == "failed":
            job.status = "failed"
            job.progress = 100
            job.stage = "Inference Failed"
            job.error_message = result.get("setup_instructions") or "Prediction execution error"
            job.result_json = json.dumps(result)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        # Store PDB file in storage adapter if available
        pdb_content = result.get("pdb_content")
        output_key = None
        out_filename = "predicted_structure.pdb"
        if pdb_content:
            from backend.app.adapters.storage.s3 import S3StorageAdapter
            output_key = S3StorageAdapter.build_storage_key(
                project_id=job.project_id,
                workflow_type="protein",
                file_id=job.id,
                filename=out_filename,
            )
            storage.put_object(output_key, pdb_content.encode("utf-8"), content_type="chemical/x-pdb")
            job.output_storage_key = output_key
            job.output_filename = out_filename

        # Build provenance
        provenance = {
            "input_sha256": input_checksum,
            "model_name": result["model_name"],
            "model_version": result["model_version"],
            "execution_device": result["execution_device"],
            "is_reference_benchmark": result["is_reference_benchmark"],
            "sequence_length": len(sequence),
            "num_recycles": params.get("num_recycles", 4),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "regulatory_notice": "Research Use Only. Not for clinical or diagnostic use.",
        }

        job.progress = 100
        job.status = "completed"
        job.stage = "Completed"
        job.result_json = json.dumps(result)
        job.provenance_json = json.dumps(provenance)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("Protein job %s completed successfully.", job_id)
        return True

    except Exception as exc:
        logger.error("Protein job %s failed: %s", job_id, exc, exc_info=True)
        db.rollback()
        try:
            failed_job = db.query(Job).filter(Job.id == job_id).first()
            if failed_job and failed_job.status != "cancelled":
                failed_job.status = "failed"
                failed_job.stage = "Pipeline failed"
                failed_job.error_message = str(exc)
                failed_job.completed_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
        return True
    finally:
        if close_db_on_exit:
            db.close()


async def run_protein_worker():
    """Local development in-memory queue consumer loop."""
    logger.info("Starting local in-memory protein worker loop.")
    while True:
        job_id = await protein_queue.get()
        try:
            process_single_protein_job(job_id)
        finally:
            protein_queue.task_done()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BioCloud Protein Worker (AWS Batch / Local)")
    parser.add_argument("--job-id", type=str, help="Process a single job ID (AWS Batch container entrypoint)")
    args = parser.parse_args()

    if args.job_id:
        logger.info("Running AWS Batch / standalone task for job %s", args.job_id)
        success = process_single_protein_job(args.job_id)
        sys.exit(0 if success else 1)
    else:
        logger.info("Running Protein worker daemon...")
        import asyncio
        asyncio.run(run_protein_worker())

