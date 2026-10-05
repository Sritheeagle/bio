import io
import re
from typing import Tuple, List, Optional
import numpy as np


class ECGValidationError(ValueError):
    pass


def validate_and_parse_ecg(
    content: bytes,
    preferred_channel: Optional[str] = None,
    user_sampling_rate: Optional[float] = None,
    return_all_channels: bool = False,
) -> Tuple[np.ndarray, float, str, List[str]]:
    """
    Validates ECG input file content and returns:
    (signal_array, sampling_rate_hz, channel_name, available_channels)
    or if return_all_channels=True:
    (signal_array, sampling_rate_hz, channel_name, available_channels, all_channels_dict)
    """
    if not content:
        raise ECGValidationError("ECG file content is empty")

    if len(content) > 50 * 1024 * 1024:
        raise ECGValidationError("ECG file exceeds maximum limit of 50 MB")

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError:
            raise ECGValidationError("Unable to decode text file. Ensure input is valid ASCII/UTF-8.")

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        raise ECGValidationError("File contains no data lines")

    # Filter comments starting with # or ;
    data_lines = [l for l in lines if not l.startswith("#") and not l.startswith(";")]
    if not data_lines:
        raise ECGValidationError("No data found after comment header")

    # Detect delimiter: comma, tab, whitespace, or semicolon
    first_row = data_lines[0]
    delimiter = None
    if "," in first_row:
        delimiter = ","
    elif "\t" in first_row:
        delimiter = "\t"
    elif ";" in first_row:
        delimiter = ";"
    else:
        delimiter = None  # whitespace split

    # Check if first line is a header
    raw_header_tokens = [t.strip() for t in (first_row.split(delimiter) if delimiter else first_row.split())]
    has_header = False
    for tok in raw_header_tokens:
        if re.search(r"[A-Za-z]", tok) and not tok.lower() in ("nan", "inf"):
            has_header = True
            break

    if has_header:
        headers = raw_header_tokens
        numeric_lines = data_lines[1:]
    else:
        num_cols = len(raw_header_tokens)
        headers = [f"channel_{i}" for i in range(num_cols)]
        numeric_lines = data_lines

    if len(numeric_lines) < 100:
        raise ECGValidationError(f"Too few samples ({len(numeric_lines)}). At least 100 samples required for reliable analysis.")

    # Parse numeric data
    try:
        data = np.genfromtxt(
            io.StringIO("\n".join(numeric_lines)),
            delimiter=delimiter,
            dtype=float,
        )
    except Exception as exc:
        raise ECGValidationError(f"Failed to parse numeric data in ECG file: {str(exc)}")

    if data.ndim == 1:
        data = data.reshape(-1, 1)

    if data.shape[0] < 100:
        raise ECGValidationError("Parsed matrix has insufficient rows (<100)")

    # Check for NaN / Inf
    if np.isnan(data).any() or np.isinf(data).any():
        # Clean by forward-filling or nan_to_num
        data = np.nan_to_num(data, nan=0.0, posinf=1.0, neginf=-1.0)

    # Detect time column
    time_col_idx = None
    channels_map = {}
    time_headers = {"time", "time_s", "t", "timestamp", "seconds", "sec"}

    for idx, h in enumerate(headers):
        clean_h = h.lower().replace(" ", "_")
        if clean_h in time_headers and time_col_idx is None:
            time_col_idx = idx
        else:
            channels_map[h] = idx

    # If no channels left (e.g. 1 column named time), use column 0 as signal
    if not channels_map:
        channels_map = {headers[0]: 0}
        time_col_idx = None

    # Determine sampling rate
    inferred_fs = None
    if time_col_idx is not None and data.shape[1] > time_col_idx:
        time_series = data[:, time_col_idx]
        diffs = np.diff(time_series)
        valid_diffs = diffs[diffs > 0]
        if len(valid_diffs) > 10:
            median_dt = float(np.median(valid_diffs))
            if 0.0001 <= median_dt <= 0.05:  # 20 Hz to 10,000 Hz
                inferred_fs = round(1.0 / median_dt, 1)

    fs = user_sampling_rate if (user_sampling_rate and user_sampling_rate > 0) else (inferred_fs if inferred_fs else 250.0)
    fs = round(float(fs), 1)

    # Select target channel
    selected_channel = None
    if preferred_channel and preferred_channel in channels_map:
        selected_channel = preferred_channel
    else:
        # Prefer common ECG leads: lead_II, II, MLII, lead_I, V1, ecg
        lead_priority = ["lead_ii", "ii", "mlii", "lead_2", "lead_i", "i", "v1", "v2", "v5", "ecg"]
        for p in lead_priority:
            for ch_name in channels_map.keys():
                if ch_name.lower().replace(" ", "_") == p:
                    selected_channel = ch_name
                    break
            if selected_channel:
                break
        if not selected_channel:
            selected_channel = list(channels_map.keys())[0]

    ch_idx = channels_map[selected_channel]
    signal = data[:, ch_idx].astype(np.float64)

    if return_all_channels:
        all_channels = {
            ch: data[:, idx].astype(np.float64)
            for ch, idx in channels_map.items()
        }
        return signal, float(fs), selected_channel, list(channels_map.keys()), all_channels

    return signal, float(fs), selected_channel, list(channels_map.keys())

