import asyncio
import json
import hashlib
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.database import SessionLocal
from backend.app.models.job import Job
from backend.app.models.file import UploadedFile
from backend.app.adapters.storage import get_storage_adapter
from backend.app.adapters.queue.local import ecg_queue, get_cancellation_event
from backend.app.pipelines.ecg.validator import validate_and_parse_ecg
from backend.app.pipelines.ecg.processor import process_ecg_signal
from backend.app.pipelines.ecg.plugins import ECGArrhythmiaClassifierPlugin
from backend.app.pipelines.ecg.synthetic import generate_synthetic_ecg


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
from backend.app.adapters.queue.local import ecg_queue, get_cancellation_event
from backend.app.pipelines.ecg.validator import validate_and_parse_ecg
from backend.app.pipelines.ecg.processor import process_ecg_signal
from backend.app.pipelines.ecg.plugins import ECGArrhythmiaClassifierPlugin
from backend.app.pipelines.ecg.synthetic import generate_synthetic_ecg

logger = logging.getLogger("BioCloud.ECGWorker")


def process_single_ecg_job(job_id: str, db: Optional[Session] = None) -> bool:
    """
    Executes end-to-end ECG signal processing pipeline for a single job.
    Durable PostgreSQL state transitions: queued -> processing -> completed / failed / cancelled.
    Returns True if job reached terminal state successfully, False on retryable error.
    """
    close_db_on_exit = False
    if db is None:
        db = SessionLocal()
        close_db_on_exit = True

    try:
        job: Optional[Job] = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.warning("Job %s not found in database.", job_id)
            return True

        if job.status in ("completed", "cancelled"):
            logger.info("Job %s is already in state %s. Skipping.", job_id, job.status)
            return True

        # Check cancellation before starting
        cancel_event = get_cancellation_event(job_id)
        if cancel_event.is_set() or job.status == "cancelled":
            job.status = "cancelled"
            job.stage = "Cancelled before execution"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        job.status = "processing"
        job.started_at = datetime.now(timezone.utc)
        job.progress = 10
        job.stage = "Validating ECG input and reading file"
        db.commit()

        # Parse parameters
        params = json.loads(job.parameters_json) if job.parameters_json else {}
        preferred_channel = params.get("channel_name")
        user_fs = params.get("sampling_rate_hz")
        lowcut = params.get("low_cut_hz", 0.5)
        highcut = params.get("high_cut_hz", 40.0)
        synthetic_pattern = params.get("synthetic_pattern")

        # Obtain file bytes
        storage = get_storage_adapter()
        file_bytes = None
        input_checksum = None
        if synthetic_pattern:
            csv_text = generate_synthetic_ecg(pattern=synthetic_pattern, duration_sec=12.0, multi_lead=True)
            file_bytes = csv_text.encode("utf-8")
            input_checksum = hashlib.sha256(file_bytes).hexdigest()
        elif job.input_file_id:
            uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == job.input_file_id).first()
            if uploaded_file:
                file_bytes = storage.get_object(uploaded_file.storage_key)
                input_checksum = uploaded_file.sha256_checksum or hashlib.sha256(file_bytes).hexdigest()

        if not file_bytes:
            raise ValueError("No ECG data file or synthetic pattern provided for analysis.")

        # Stage 2: Parse and validate signal
        db.refresh(job)
        if job.status == "cancelled" or cancel_event.is_set():
            job.status = "cancelled"
            job.stage = "Cancelled by user"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        job.progress = 30
        job.stage = "Validating format and lead extraction"
        db.commit()

        raw_signal, fs, detected_channel, available_channels, all_channels = validate_and_parse_ecg(
            file_bytes, preferred_channel=preferred_channel, user_sampling_rate=user_fs, return_all_channels=True
        )

        # Stage 3: Digital signal processing
        db.refresh(job)
        if job.status == "cancelled" or cancel_event.is_set():
            job.status = "cancelled"
            job.stage = "Cancelled by user"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        job.progress = 60
        job.stage = "Butterworth filtering (0.5-40Hz) and Pan-Tompkins peak detection"
        db.commit()

        analysis_result = process_ecg_signal(
            raw_signal=raw_signal,
            fs=fs,
            lead_name=detected_channel,
            lowcut=lowcut,
            highcut=highcut,
            all_channels=all_channels,
        )

        # Stage 4: Arrhythmia plugin screening
        db.refresh(job)
        if job.status == "cancelled" or cancel_event.is_set():
            job.status = "cancelled"
            job.stage = "Cancelled by user"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return True

        job.progress = 85
        job.stage = "Computing HRV statistics and running arrhythmia screening plugin"
        db.commit()

        plugin_result = ECGArrhythmiaClassifierPlugin.classify(analysis_result)
        analysis_result["arrhythmia_classification"] = plugin_result["classification"]
        analysis_result["arrhythmia_details"] = plugin_result
        analysis_result["available_channels"] = available_channels

        # Build provenance record
        provenance = {
            "input_sha256": input_checksum,
            "pipeline_version": "scipy-dsp-v2.1.0",
            "plugin_version": ECGArrhythmiaClassifierPlugin.plugin_version,
            "parameters_applied": {
                "sampling_rate_hz": fs,
                "channel_used": detected_channel,
                "bandpass_hz": [lowcut, highcut],
            },
            "total_samples_processed": len(raw_signal),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "regulatory_notice": "Research Use Only. Not for clinical diagnosis.",
        }

        job.progress = 100
        job.status = "completed"
        job.stage = "Completed"
        job.result_json = json.dumps(analysis_result)
        job.provenance_json = json.dumps(provenance)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("ECG job %s completed successfully.", job_id)
        return True

    except Exception as exc:
        logger.error("ECG job %s failed: %s", job_id, exc, exc_info=True)
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


async def run_ecg_worker():
    """Local development in-memory queue consumer loop."""
    logger.info("Starting local in-memory ECG worker loop.")
    while True:
        job_id = await ecg_queue.get()
        try:
            process_single_ecg_job(job_id)
        finally:
            ecg_queue.task_done()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BioCloud ECG Worker")
    parser.add_argument("--job-id", type=str, help="Process a single job ID and exit")
    args = parser.parse_args()

    if args.job_id:
        success = process_single_ecg_job(args.job_id)
        sys.exit(0 if success else 1)
    else:
        logger.info("Running ECG worker daemon...")
        import asyncio
        asyncio.run(run_ecg_worker())

