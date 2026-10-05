import pytest
import numpy as np
from backend.app.pipelines.ecg.synthetic import generate_synthetic_ecg
from backend.app.pipelines.ecg.validator import validate_and_parse_ecg, ECGValidationError
from backend.app.pipelines.ecg.processor import process_ecg_signal
from backend.app.pipelines.ecg.plugins import ECGArrhythmiaClassifierPlugin


def test_synthetic_ecg_generation():
    csv_str = generate_synthetic_ecg(pattern="normal_sinus", duration_sec=5.0, fs=250.0)
    assert "BioCloud Workbench SYNTHETIC" in csv_str
    assert "time_s,lead_II" in csv_str
    lines = csv_str.strip().splitlines()
    # 4 header lines + 1250 sample rows
    assert len(lines) == 1254


def test_ecg_validation_and_parsing():
    csv_str = generate_synthetic_ecg(pattern="normal_sinus", duration_sec=6.0, fs=250.0)
    raw_signal, fs, channel, available_channels = validate_and_parse_ecg(csv_str.encode("utf-8"))
    assert fs == 250.0
    assert channel == "lead_II"
    assert len(raw_signal) == 1500
    assert "lead_II" in available_channels


def test_ecg_validation_failures():
    with pytest.raises(ECGValidationError):
        validate_and_parse_ecg(b"")

    with pytest.raises(ECGValidationError):
        validate_and_parse_ecg(b"not,enough,data\n1,2,3")


def test_ecg_signal_processing():
    csv_str = generate_synthetic_ecg(pattern="normal_sinus", duration_sec=10.0, fs=250.0)
    raw_signal, fs, channel, _ = validate_and_parse_ecg(csv_str.encode("utf-8"))
    result = process_ecg_signal(raw_signal, fs=fs, lead_name=channel)

    assert result["total_samples"] == 2500
    assert result["duration_seconds"] == 10.0
    assert result["detected_beats_count"] >= 10  # ~12 beats in 10s at 72 bpm
    assert 60.0 <= result["mean_hr_bpm"] <= 85.0
    assert result["signal_quality"] in ("High", "Moderate")
    assert result["snr_db"] > 5.0
    assert len(result["waveform_preview"]) > 0


def test_arrhythmia_screening_plugin():
    metrics_normal = {"mean_hr_bpm": 72.0, "detected_beats_count": 12, "mean_rr_ms": 833.0, "sdnn_ms": 30.0}
    res_normal = ECGArrhythmiaClassifierPlugin.classify(metrics_normal)
    assert "Normal Sinus Rhythm" in res_normal["classification"]

    metrics_tachy = {"mean_hr_bpm": 125.0, "detected_beats_count": 20, "mean_rr_ms": 480.0, "sdnn_ms": 20.0}
    res_tachy = ECGArrhythmiaClassifierPlugin.classify(metrics_tachy)
    assert "Tachycardia" in res_tachy["classification"]

    metrics_brady = {"mean_hr_bpm": 48.0, "detected_beats_count": 8, "mean_rr_ms": 1250.0, "sdnn_ms": 25.0}
    res_brady = ECGArrhythmiaClassifierPlugin.classify(metrics_brady)
    assert "Bradycardia" in res_brady["classification"]


def test_synthetic_12_lead_ecg_and_multi_channel_processing():
    csv_str = generate_synthetic_ecg(pattern="normal_sinus", duration_sec=5.0, fs=250.0, multi_lead=True)
    assert "time_s,I,II,III,aVR,aVL,aVF,V1,V2,V3,V4,V5,V6" in csv_str

    raw_signal, fs, channel, available_channels, all_channels = validate_and_parse_ecg(
        csv_str.encode("utf-8"), return_all_channels=True
    )
    assert fs == 250.0
    assert len(available_channels) == 12
    assert "aVR" in available_channels
    assert "V1" in available_channels
    assert len(all_channels) == 12

    result = process_ecg_signal(raw_signal, fs=fs, lead_name=channel, all_channels=all_channels)
    assert "lead_previews" in result
    assert len(result["lead_previews"]) == 12
    assert "V6" in result["lead_previews"]
    assert len(result["lead_previews"]["II"]) > 0
    assert len(result["available_leads"]) == 12


def test_frequency_domain_hrv():
    from backend.app.pipelines.ecg.processor import compute_frequency_hrv
    # Simulate 15 beats with realistic RR ~ 800ms
    r_peaks = np.cumsum([0.5] + [0.8 + 0.05 * np.sin(i * 0.4) for i in range(14)])
    freq_metrics = compute_frequency_hrv(r_peaks)

    assert "lf_power_ms2" in freq_metrics
    assert "hf_power_ms2" in freq_metrics
    assert "lf_hf_ratio" in freq_metrics
    assert freq_metrics["lf_hf_ratio"] > 0
    assert "psd_curve" in freq_metrics
    assert len(freq_metrics["psd_curve"]) > 5
    assert freq_metrics["autonomic_balance"] in (
        "Balanced Autonomic Modulation",
        "Sympathetic Dominance",
        "Parasympathetic / Vagal Dominance",
    )


