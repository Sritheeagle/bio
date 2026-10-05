from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.file import UploadedFile
from backend.app.models.model_version import ModelVersion
from backend.app.adapters.storage import get_storage_adapter
from backend.app.pipelines.ecg.validator import validate_and_parse_ecg
from backend.app.pipelines.ecg.processor import downsample_waveform_for_display
from backend.app.api.deps import get_current_user, verify_project_access

router = APIRouter(prefix="/ecg", tags=["ECG Analysis"])


@router.get("/synthetic-patterns")
def list_synthetic_patterns():
    return [
        {
            "id": "normal_sinus",
            "name": "Synthetic Normal Sinus Rhythm",
            "heart_rate_bpm": 72,
            "duration_s": 12,
            "sampling_rate_hz": 250,
            "description": "Standard resting cardiac signal with typical P-Q-R-S-T wave intervals and normal heart rate (~72 bpm).",
            "label": "SYNTHETIC SAMPLE",
        },
        {
            "id": "tachycardia",
            "name": "Synthetic Sinus Tachycardia",
            "heart_rate_bpm": 125,
            "duration_s": 12,
            "sampling_rate_hz": 250,
            "description": "Elevated cardiac frequency with shortened P-R and T-P segments (~125 bpm).",
            "label": "SYNTHETIC SAMPLE",
        },
        {
            "id": "bradycardia",
            "name": "Synthetic Sinus Bradycardia",
            "heart_rate_bpm": 48,
            "duration_s": 12,
            "sampling_rate_hz": 250,
            "description": "Slow resting cardiac frequency with prolonged diastolic intervals (~48 bpm).",
            "label": "SYNTHETIC SAMPLE",
        },
        {
            "id": "arrhythmia",
            "name": "Synthetic Irregular Cardiac Rhythm",
            "heart_rate_bpm": 75,
            "duration_s": 12,
            "sampling_rate_hz": 250,
            "description": "Variable RR interval pacing with simulated premature ectopic beats for testing detection sensitivity.",
            "label": "SYNTHETIC SAMPLE",
        },
    ]


@router.post("/validate-preview")
def validate_and_preview_ecg(
    file_id: str,
    channel_name: Optional[str] = None,
    sampling_rate_hz: Optional[float] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not uploaded_file:
        raise HTTPException(status_code=404, detail="Uploaded file not found")
    verify_project_access(uploaded_file.project_id, current_user, db)

    storage = get_storage_adapter()
    file_bytes = storage.get_object(uploaded_file.storage_key)

    try:
        raw_signal, fs, detected_channel, available_channels, all_channels = validate_and_parse_ecg(
            file_bytes, preferred_channel=channel_name, user_sampling_rate=sampling_rate_hz, return_all_channels=True
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"ECG validation error: {str(exc)}")

    n_samples = len(raw_signal)
    duration_s = n_samples / fs
    import numpy as np

    t = np.linspace(0, duration_s, n_samples, endpoint=False)
    preview = downsample_waveform_for_display(t, raw_signal, max_points=600)

    # Previews for available channels
    lead_previews = {
        ch: downsample_waveform_for_display(t, sig, max_points=600)
        for ch, sig in all_channels.items()
    }

    # Mark as validated
    uploaded_file.is_validated = True
    db.commit()

    return {
        "file_id": file_id,
        "filename": uploaded_file.original_name,
        "sampling_rate_hz": fs,
        "selected_channel": detected_channel,
        "available_channels": available_channels,
        "total_samples": n_samples,
        "duration_seconds": round(duration_s, 2),
        "preview_points": preview,
        "lead_previews": lead_previews,
    }


@router.get("/models")
def list_ecg_models(db: Session = Depends(get_db)):
    models = (
        db.query(ModelVersion)
        .filter(ModelVersion.workflow_type == "ecg")
        .all()
    )
    return [
        {
            "id": m.id,
            "name": m.name,
            "version": m.version,
            "status": m.status,
            "description": m.description,
            "is_enabled": m.is_enabled,
        }
        for m in models
    ]
