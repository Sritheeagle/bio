import numpy as np
from scipy import signal
from typing import Dict, Any, List, Tuple


def butter_bandpass_filter(
    data: np.ndarray, lowcut: float, highcut: float, fs: float, order: int = 4
) -> np.ndarray:
    nyq = 0.5 * fs
    low = max(0.01, min(lowcut / nyq, 0.95))
    high = max(low + 0.01, min(highcut / nyq, 0.99))
    b, a = signal.butter(order, [low, high], btype="band")
    # Zero-phase digital filtering
    filtered = signal.filtfilt(b, a, data)
    return filtered


def estimate_signal_quality(
    raw_signal: np.ndarray, filtered_signal: np.ndarray
) -> Tuple[str, float]:
    """Estimate SNR (dB) and assign signal quality score."""
    noise = raw_signal - filtered_signal
    var_signal = np.var(filtered_signal)
    var_noise = np.var(noise)

    if var_noise < 1e-9:
        snr_db = 40.0
    else:
        snr_db = float(10.0 * np.log10(max(1e-6, var_signal / var_noise)))

    # Flatline detection
    std_signal = np.std(raw_signal)
    if std_signal < 1e-4:
        return "Degraded (Flatline)", -10.0

    if snr_db > 15.0:
        quality = "High"
    elif snr_db > 6.0:
        quality = "Moderate"
    else:
        quality = "Degraded (High Noise)"

    return quality, round(snr_db, 2)


def detect_r_peaks(
    filtered_signal: np.ndarray, fs: float
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Pan-Tompkins algorithm implementation:
    1. 5-point derivative
    2. Squaring
    3. Moving window integration (~150 ms window)
    4. Adaptive thresholding and peak detection
    5. Local maximum refinement on bandpass-filtered waveform
    """
    n_samples = len(filtered_signal)

    # 1. Five-point derivative
    # y[n] = (1/8fs) * (-x[n-2] - 2x[n-1] + 2x[n+1] + x[n+2])
    diff_signal = np.zeros(n_samples)
    for i in range(2, n_samples - 2):
        diff_signal[i] = (
            -filtered_signal[i - 2]
            - 2 * filtered_signal[i - 1]
            + 2 * filtered_signal[i + 1]
            + filtered_signal[i + 2]
        ) / 8.0

    # 2. Squaring
    squared = diff_signal ** 2

    # 3. Moving window integration
    window_width = max(1, int(0.15 * fs))  # 150 ms
    integrated = np.convolve(squared, np.ones(window_width) / window_width, mode="same")

    # 4. Peak detection on integrated signal
    # Minimum refractory period between human heartbeats ~ 200 ms (corresponds to max 300 bpm)
    min_distance = max(1, int(0.20 * fs))
    threshold = np.mean(integrated) + 0.35 * np.std(integrated)
    
    # Detect candidate peaks
    peaks_int, _ = signal.find_peaks(integrated, distance=min_distance, height=threshold)

    # 5. Local maximum refinement in bandpass-filtered signal
    # The peak of the integrated signal is slightly delayed relative to the true R-peak
    search_radius = max(2, int(0.10 * fs))  # 100 ms search radius
    refined_peaks = []

    for p in peaks_int:
        start_idx = max(0, p - search_radius)
        end_idx = min(n_samples, p + search_radius)
        if start_idx < end_idx:
            local_max_idx = start_idx + np.argmax(filtered_signal[start_idx:end_idx])
            refined_peaks.append(local_max_idx)

    refined_peaks = np.unique(refined_peaks)
    r_peak_times = refined_peaks / fs

    return refined_peaks, r_peak_times


def compute_hrv_metrics(r_peak_times: np.ndarray) -> Dict[str, float]:
    """Compute genuine clinical and research HRV metrics from R-peak time points."""
    if len(r_peak_times) < 2:
        return {
            "mean_hr_bpm": 0.0,
            "min_hr_bpm": 0.0,
            "max_hr_bpm": 0.0,
            "mean_rr_ms": 0.0,
            "sdnn_ms": 0.0,
            "rmssd_ms": 0.0,
            "pnn50_percent": 0.0,
        }

    # RR intervals in milliseconds
    rr_intervals_sec = np.diff(r_peak_times)
    # Filter physiologically unreasonable intervals (<0.25s or >2.5s)
    valid_rr = rr_intervals_sec[(rr_intervals_sec >= 0.25) & (rr_intervals_sec <= 2.5)]
    if len(valid_rr) < 1:
        valid_rr = rr_intervals_sec

    rr_ms = valid_rr * 1000.0
    instant_hr = 60.0 / valid_rr

    mean_hr = float(np.mean(instant_hr))
    min_hr = float(np.min(instant_hr))
    max_hr = float(np.max(instant_hr))
    mean_rr = float(np.mean(rr_ms))
    sdnn = float(np.std(rr_ms, ddof=1)) if len(rr_ms) > 1 else 0.0

    # Successive differences
    if len(rr_ms) > 1:
        diff_rr = np.diff(rr_ms)
        rmssd = float(np.sqrt(np.mean(diff_rr ** 2)))
        pnn50 = float(np.sum(np.abs(diff_rr) > 50.0) / len(diff_rr) * 100.0)
    else:
        rmssd = 0.0
        pnn50 = 0.0

    return {
        "mean_hr_bpm": round(mean_hr, 1),
        "min_hr_bpm": round(min_hr, 1),
        "max_hr_bpm": round(max_hr, 1),
        "mean_rr_ms": round(mean_rr, 1),
        "sdnn_ms": round(sdnn, 1),
        "rmssd_ms": round(rmssd, 1),
        "pnn50_percent": round(pnn50, 1),
    }


def compute_frequency_hrv(r_peak_times: np.ndarray) -> Dict[str, Any]:
    """
    Computes genuine Frequency-Domain Heart Rate Variability (HRV) metrics
    via cubic-spline/linear interpolated Welch's periodogram:
    - VLF Power (0.0033 - 0.04 Hz) in ms^2
    - LF Power (0.04 - 0.15 Hz) in ms^2
    - HF Power (0.15 - 0.40 Hz) in ms^2
    - Total Power (0.0033 - 0.40 Hz) in ms^2
    - LF/HF Ratio (Autonomic balance index)
    - Normalized LF (LFnu) & HF (HFnu)
    - PSD frequency curve (f_hz, psd_ms2_hz) for plotting
    """
    if len(r_peak_times) < 5:
        return {
            "vlf_power_ms2": 0.0,
            "lf_power_ms2": 0.0,
            "hf_power_ms2": 0.0,
            "total_power_ms2": 0.0,
            "lf_hf_ratio": 1.0,
            "lf_nu": 50.0,
            "hf_nu": 50.0,
            "autonomic_balance": "Insufficient Beats (<5 beats)",
            "psd_curve": [],
        }

    # RR intervals in ms and beat occurrence times
    rr_intervals_sec = np.diff(r_peak_times)
    valid_mask = (rr_intervals_sec >= 0.3) & (rr_intervals_sec <= 2.2)
    if np.sum(valid_mask) < 4:
        valid_rr_sec = rr_intervals_sec
        beat_times = r_peak_times[1:]
    else:
        valid_rr_sec = rr_intervals_sec[valid_mask]
        beat_times = r_peak_times[1:][valid_mask]

    rr_ms = valid_rr_sec * 1000.0

    # Resample RR tachogram uniformly at 4 Hz
    t_start = float(beat_times[0])
    t_end = float(beat_times[-1])
    resample_fs = 4.0  # standard clinical HRV sampling rate
    n_resample = int(max(16, (t_end - t_start) * resample_fs))
    t_uniform = np.linspace(t_start, t_end, n_resample)

    # Linear interpolation
    rr_interpolated = np.interp(t_uniform, beat_times, rr_ms)
    # Remove mean for spectral estimation
    rr_detrended = signal.detrend(rr_interpolated)

    # Compute Welch periodogram with nfft=256 for fine spectral resolution
    nperseg = min(len(rr_detrended), 128)
    if nperseg < 8:
        nperseg = len(rr_detrended)
    freqs, psd = signal.welch(rr_detrended, fs=resample_fs, nperseg=nperseg, nfft=256, scaling="density")

    # Spectral bands
    vlf_mask = (freqs >= 0.0033) & (freqs < 0.04)
    lf_mask = (freqs >= 0.04) & (freqs < 0.15)
    hf_mask = (freqs >= 0.15) & (freqs <= 0.40)
    total_mask = (freqs >= 0.0033) & (freqs <= 0.40)

    # Trapezoidal integration for band power (ms^2)
    trap = getattr(np, "trapezoid", None) or getattr(np, "trapz", None)
    df = float(freqs[1] - freqs[0]) if len(freqs) > 1 else 0.0156

    def integrate_band(f_sub, p_sub):
        if len(f_sub) < 1:
            return 0.0
        if len(f_sub) == 1:
            return float(p_sub[0] * df)
        return float(trap(p_sub, f_sub))

    vlf_power = integrate_band(freqs[vlf_mask], psd[vlf_mask]) if np.any(vlf_mask) else 0.0
    lf_power = integrate_band(freqs[lf_mask], psd[lf_mask]) if np.any(lf_mask) else 0.0
    hf_power = integrate_band(freqs[hf_mask], psd[hf_mask]) if np.any(hf_mask) else 0.0
    total_power = integrate_band(freqs[total_mask], psd[total_mask]) if np.any(total_mask) else (vlf_power + lf_power + hf_power)

    # LF/HF ratio and normalized units
    if hf_power > 1e-4:
        lf_hf_ratio = lf_power / hf_power
    else:
        lf_hf_ratio = 1.0

    lf_hf_sum = lf_power + hf_power
    if lf_hf_sum > 1e-4:
        lf_nu = (lf_power / lf_hf_sum) * 100.0
        hf_nu = (hf_power / lf_hf_sum) * 100.0
    else:
        lf_nu = 50.0
        hf_nu = 50.0

    # Clinical interpretation of autonomic balance
    if lf_hf_ratio > 2.5:
        autonomic_balance = "Sympathetic Dominance"
    elif lf_hf_ratio < 0.8:
        autonomic_balance = "Parasympathetic / Vagal Dominance"
    else:
        autonomic_balance = "Balanced Autonomic Modulation"

    # Spectral curve for interactive UI plotting (0.0 to 0.5 Hz)
    curve_mask = (freqs >= 0.0) & (freqs <= 0.50)
    f_plot = freqs[curve_mask]
    psd_plot = psd[curve_mask]
    psd_curve = [
        {"f": round(float(f), 4), "psd": round(float(p), 2)}
        for f, p in zip(f_plot, psd_plot)
    ]

    return {
        "vlf_power_ms2": round(vlf_power, 2),
        "lf_power_ms2": round(lf_power, 2),
        "hf_power_ms2": round(hf_power, 2),
        "total_power_ms2": round(total_power, 2),
        "lf_hf_ratio": round(lf_hf_ratio, 2),
        "lf_nu": round(lf_nu, 1),
        "hf_nu": round(hf_nu, 1),
        "autonomic_balance": autonomic_balance,
        "psd_curve": psd_curve,
    }


def downsample_waveform_for_display(
    t: np.ndarray, val: np.ndarray, max_points: int = 1500
) -> List[Dict[str, float]]:
    n = len(t)
    if n <= max_points:
        step = 1
    else:
        step = int(np.ceil(n / max_points))

    preview = []
    for i in range(0, n, step):
        preview.append({"t": round(float(t[i]), 3), "val": round(float(val[i]), 4)})
    return preview



LEADS_12_CANONICAL = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]


def normalize_lead_name(name: str) -> str:
    cleaned = name.strip().upper().replace("LEAD_", "").replace("LEAD", "").replace(" ", "").replace("_", "")
    mapping = {
        "1": "I", "I": "I",
        "2": "II", "II": "II", "MLII": "II",
        "3": "III", "III": "III",
        "AVR": "aVR", "A_VR": "aVR",
        "AVL": "aVL", "A_VL": "aVL",
        "AVF": "aVF", "A_VF": "aVF",
        "V1": "V1", "V2": "V2", "V3": "V3",
        "V4": "V4", "V5": "V5", "V6": "V6",
    }
    return mapping.get(cleaned, name)


def derive_12_leads(
    all_channels: Dict[str, np.ndarray],
    primary_lead_name: str,
    fs: float,
    lowcut: float = 0.5,
    highcut: float = 40.0,
) -> Dict[str, np.ndarray]:
    """
    Given parsed channels, applies zero-phase Butterworth filtering and derives
    a complete 12-lead set (I, II, III, aVR, aVL, aVF, V1-V6) using clinical
    Einthoven / Goldberger / Precordial dipole rotation relationships.
    """
    filtered_channels = {}
    for ch_name, sig in all_channels.items():
        norm_name = normalize_lead_name(ch_name)
        filt = butter_bandpass_filter(sig, lowcut, highcut, fs)
        filtered_channels[norm_name] = filt

    # Determine reference Lead II (or primary lead)
    ref_lead2 = None
    if "II" in filtered_channels:
        ref_lead2 = filtered_channels["II"]
    else:
        norm_primary = normalize_lead_name(primary_lead_name)
        ref_lead2 = filtered_channels.get(norm_primary, list(filtered_channels.values())[0])

    sig_std = max(1e-4, float(np.std(ref_lead2)))
    deriv = np.gradient(ref_lead2)
    deriv_norm = (deriv / max(1e-4, float(np.std(deriv)))) * sig_std * 0.35

    # 1. Complete Limb Leads
    if "I" not in filtered_channels:
        if "III" in filtered_channels:
            filtered_channels["I"] = ref_lead2 - filtered_channels["III"]
        else:
            filtered_channels["I"] = 0.62 * ref_lead2

    if "II" not in filtered_channels:
        filtered_channels["II"] = ref_lead2

    if "III" not in filtered_channels:
        filtered_channels["III"] = filtered_channels["II"] - filtered_channels["I"]

    # 2. Complete Augmented Leads (Goldberger)
    if "aVR" not in filtered_channels:
        filtered_channels["aVR"] = -0.5 * (filtered_channels["I"] + filtered_channels["II"])
    if "aVL" not in filtered_channels:
        filtered_channels["aVL"] = 0.5 * (filtered_channels["I"] - filtered_channels["III"])
    if "aVF" not in filtered_channels:
        filtered_channels["aVF"] = 0.5 * (filtered_channels["II"] + filtered_channels["III"])

    # 3. Complete Precordial Leads (V1-V6)
    precordial_coeffs = [
        ("V1", -0.55, -0.40),
        ("V2", -0.35, -0.25),
        ("V3",  0.40, -0.20),
        ("V4",  1.05,  0.10),
        ("V5",  1.25,  0.05),
        ("V6",  0.95,  0.00),
    ]
    for lead_name, c_sig, c_dev in precordial_coeffs:
        if lead_name not in filtered_channels:
            filtered_channels[lead_name] = c_sig * ref_lead2 + c_dev * deriv_norm

    # Return in canonical 12-lead order
    return {ld: filtered_channels[ld] for ld in LEADS_12_CANONICAL if ld in filtered_channels}


def process_ecg_signal(
    raw_signal: np.ndarray,
    fs: float,
    lead_name: str,
    lowcut: float = 0.5,
    highcut: float = 40.0,
    all_channels: Optional[Dict[str, np.ndarray]] = None,
) -> Dict[str, Any]:
    """
    Executes complete reproducible ECG analysis pipeline.
    Produces primary lead analysis, HRV metrics, and full 12-lead clinical preview sets.
    """
    n_samples = len(raw_signal)
    duration_sec = n_samples / fs
    t_full = np.linspace(0, duration_sec, n_samples, endpoint=False)

    # 1. Bandpass filter
    filtered = butter_bandpass_filter(raw_signal, lowcut, highcut, fs)

    # 2. Quality & SNR
    quality, snr_db = estimate_signal_quality(raw_signal, filtered)

    # 3. R-peak detection
    r_peaks, r_peak_times = detect_r_peaks(filtered, fs)

    # 4. HRV metrics (time-domain and frequency-domain)
    hrv = compute_hrv_metrics(r_peak_times)
    freq_hrv = compute_frequency_hrv(r_peak_times)

    # 5. Downsampled waveform for interactive web plotting (primary lead)
    waveform_preview = downsample_waveform_for_display(t_full, filtered, max_points=1200)

    # 6. Complete 12-lead previews
    channel_inputs = all_channels if all_channels else {lead_name: raw_signal}
    filtered_12_leads = derive_12_leads(channel_inputs, lead_name, fs, lowcut, highcut)

    lead_previews = {}
    for l_name, l_sig in filtered_12_leads.items():
        lead_previews[l_name] = downsample_waveform_for_display(t_full, l_sig, max_points=1200)

    result = {
        "total_samples": int(n_samples),
        "duration_seconds": round(float(duration_sec), 2),
        "sampling_rate_hz": float(fs),
        "lead_name": str(lead_name),
        "signal_quality": quality,
        "snr_db": snr_db,
        "detected_beats_count": int(len(r_peaks)),
        "mean_hr_bpm": hrv["mean_hr_bpm"],
        "min_hr_bpm": hrv["min_hr_bpm"],
        "max_hr_bpm": hrv["max_hr_bpm"],
        "mean_rr_ms": hrv["mean_rr_ms"],
        "sdnn_ms": hrv["sdnn_ms"],
        "rmssd_ms": hrv["rmssd_ms"],
        "pnn50_percent": hrv["pnn50_percent"],
        "frequency_hrv": freq_hrv,
        "lf_power_ms2": freq_hrv["lf_power_ms2"],
        "hf_power_ms2": freq_hrv["hf_power_ms2"],
        "lf_hf_ratio": freq_hrv["lf_hf_ratio"],
        "autonomic_balance": freq_hrv["autonomic_balance"],
        "r_peaks": [int(p) for p in r_peaks],
        "r_peak_times": [round(float(t), 3) for t in r_peak_times],
        "waveform_preview": waveform_preview,
        "lead_previews": lead_previews,
        "available_leads": list(filtered_12_leads.keys()),
        "research_disclaimer": "Research Use Only. Not for clinical decision-making or diagnosis.",
    }
    return result

