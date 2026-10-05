import numpy as np


def generate_synthetic_ecg(
    pattern: str = "normal_sinus",
    duration_sec: float = 10.0,
    fs: float = 250.0,
    noise_std: float = 0.02,
    seed: int = 42,
    multi_lead: bool = False,
) -> str:
    """
    Generate synthetic ECG waveform with realistic P-Q-R-S-T complexes.
    Supports single lead (lead_II) or full 12-lead clinical ECG (I, II, III, aVR, aVL, aVF, V1-V6).
    Labeled as SYNTHETIC research data.
    """
    np.random.seed(seed)
    total_samples = int(duration_sec * fs)
    t = np.linspace(0, duration_sec, total_samples, endpoint=False)
    signal = np.zeros(total_samples)

    if pattern == "tachycardia":
        base_hr = 125.0
    elif pattern == "bradycardia":
        base_hr = 48.0
    elif pattern == "arrhythmia":
        base_hr = 75.0
    else:  # normal_sinus
        base_hr = 72.0

    beat_duration = 60.0 / base_hr
    beat_times = []
    curr_time = 0.3

    while curr_time < duration_sec - 0.3:
        beat_times.append(curr_time)
        if pattern == "arrhythmia":
            # Add irregular variation and occasional premature beat
            jitter = np.random.uniform(-0.18, 0.22) * beat_duration
            curr_time += max(0.4, beat_duration + jitter)
        else:
            jitter = np.random.uniform(-0.02, 0.02)
            curr_time += beat_duration + jitter

    # Construct P-Q-R-S-T waves for each beat
    for b_time in beat_times:
        # P-wave: small positive defection ~160ms before R-peak
        p_center = b_time - 0.16
        signal += 0.15 * np.exp(-((t - p_center) ** 2) / (2 * (0.025 ** 2)))

        # Q-wave: small negative deflection ~40ms before R-peak
        q_center = b_time - 0.04
        signal -= 0.18 * np.exp(-((t - q_center) ** 2) / (2 * (0.012 ** 2)))

        # R-peak: sharp prominent spike at b_time
        signal += 1.25 * np.exp(-((t - b_time) ** 2) / (2 * (0.018 ** 2)))

        # S-wave: negative deflection ~45ms after R-peak
        s_center = b_time + 0.045
        signal -= 0.30 * np.exp(-((t - s_center) ** 2) / (2 * (0.015 ** 2)))

        # T-wave: wider positive deflection ~220ms after R-peak
        t_center = b_time + 0.22
        signal += 0.35 * np.exp(-((t - t_center) ** 2) / (2 * (0.055 ** 2)))

    # Baseline wander (low frequency respiration artifact ~0.25 Hz)
    baseline_wander = 0.12 * np.sin(2 * np.pi * 0.25 * t)
    # High frequency measurement noise
    noise = np.random.normal(0, noise_std, total_samples)

    final_lead2 = signal + baseline_wander + noise

    if not multi_lead:
        # Format as CSV with clear SYNTHETIC provenance header (single lead_II)
        lines = [
            f"# BioCloud Workbench SYNTHETIC ECG Test Signal",
            f"# Pattern: {pattern}, SamplingRate: {fs}Hz, Duration: {duration_sec}s",
            f"# FOR RESEARCH & TESTING ONLY - NOT HUMAN CLINICAL DATA",
            "time_s,lead_II",
        ]
        for i in range(total_samples):
            lines.append(f"{t[i]:.4f},{final_lead2[i]:.5f}")
        return "\n".join(lines)

    # 12-Lead Synthesis based on Einthoven's triangle, Goldberger's equations, and Precordial R-wave progression
    lead_signals = {}
    lead_signals["II"] = final_lead2

    # Limb leads: Einthoven's law (I + III = II)
    lead_signals["I"] = 0.62 * signal + 0.08 * np.sin(2 * np.pi * 0.25 * t + 0.3) + np.random.normal(0, noise_std, total_samples)
    lead_signals["III"] = lead_signals["II"] - lead_signals["I"]

    # Augmented unipolar leads: Goldberger's equations
    lead_signals["aVR"] = -0.5 * (lead_signals["I"] + lead_signals["II"])
    lead_signals["aVL"] = 0.5 * (lead_signals["I"] - lead_signals["III"])
    lead_signals["aVF"] = 0.5 * (lead_signals["II"] + lead_signals["III"])

    # Precordial leads (V1-V6) with septal-to-lateral dipole rotation & R-wave progression
    sig_std = max(1e-4, float(np.std(signal)))
    deriv = np.gradient(signal)
    deriv_norm = (deriv / max(1e-4, float(np.std(deriv)))) * sig_std * 0.35

    precordial_coeffs = [
        ("V1", -0.55, -0.40),
        ("V2", -0.35, -0.25),
        ("V3",  0.40, -0.20),
        ("V4",  1.05,  0.10),
        ("V5",  1.25,  0.05),
        ("V6",  0.95,  0.00),
    ]

    for idx, (lead_name, c_sig, c_dev) in enumerate(precordial_coeffs):
        l_wander = 0.08 * np.sin(2 * np.pi * 0.25 * t + idx * 0.4)
        l_noise = np.random.normal(0, noise_std, total_samples)
        lead_signals[lead_name] = c_sig * signal + c_dev * deriv_norm + l_wander + l_noise

    # Output CSV containing all 12 standard leads
    leads_order = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]
    header_cols = ["time_s"] + leads_order
    lines = [
        f"# BioCloud Workbench SYNTHETIC 12-Lead ECG Test Signal",
        f"# Pattern: {pattern}, SamplingRate: {fs}Hz, Duration: {duration_sec}s, Leads: {','.join(leads_order)}",
        f"# FOR RESEARCH & TESTING ONLY - NOT HUMAN CLINICAL DATA",
        ",".join(header_cols),
    ]
    for i in range(total_samples):
        vals = [f"{t[i]:.4f}"] + [f"{lead_signals[ld][i]:.5f}" for ld in leads_order]
        lines.append(",".join(vals))

    return "\n".join(lines)

