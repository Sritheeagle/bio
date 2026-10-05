from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ECGAnalysisParams(BaseModel):
    sampling_rate_hz: Optional[float] = Field(250.0, ge=50.0, le=10000.0)
    channel_name: Optional[str] = Field(None, max_length=50)
    low_cut_hz: float = Field(0.5, ge=0.05, le=5.0)
    high_cut_hz: float = Field(40.0, ge=15.0, le=200.0)
    apply_arrhythmia_screening: bool = True
    synthetic_pattern: Optional[str] = None  # "normal_sinus", "tachycardia", "bradycardia", "arrhythmia"


class ECGWaveformPoint(BaseModel):
    t: float
    val: float


class ECGAnalysisResult(BaseModel):
    total_samples: int
    duration_seconds: float
    sampling_rate_hz: float
    lead_name: str
    signal_quality: str
    snr_db: float
    detected_beats_count: int
    mean_hr_bpm: float
    min_hr_bpm: float
    max_hr_bpm: float
    mean_rr_ms: float
    sdnn_ms: float
    rmssd_ms: float
    pnn50_percent: float
    arrhythmia_classification: Optional[str] = None
    r_peaks: List[int] = Field(default_factory=list)
    r_peak_times: List[float] = Field(default_factory=list)
    waveform_preview: List[Dict[str, float]] = Field(default_factory=list)
    research_disclaimer: str = "Research Use Only. Not for diagnostic or therapeutic decisions."
