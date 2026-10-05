from typing import Dict, Any, Optional
import numpy as np


class ECGArrhythmiaClassifierPlugin:
    """
    Versioned research plugin for preliminary ECG rhythm classification.
    Produces strictly defined descriptive classifications with research disclaimers.
    Does NOT produce medical diagnoses.
    """
    plugin_name = "ecg-rhythm-classifier"
    plugin_version = "v1.2.0"

    @classmethod
    def classify(cls, metrics: Dict[str, Any]) -> Dict[str, Any]:
        mean_hr = metrics.get("mean_hr_bpm", 0.0)
        sdnn = metrics.get("sdnn_ms", 0.0)
        mean_rr = metrics.get("mean_rr_ms", 0.0)
        beats = metrics.get("detected_beats_count", 0)

        if beats < 3:
            classification = "Indeterminate Rhythm (Insufficient Beats)"
            confidence = "Low"
            description = "Fewer than 3 beats detected; unable to assess rhythm stability."
        elif mean_hr > 100.0:
            classification = "Tachycardia Pattern Detected"
            confidence = "Moderate"
            description = f"Elevated ventricular rate ({mean_hr:.1f} bpm > 100 bpm threshold)."
        elif mean_hr < 60.0:
            classification = "Bradycardia Pattern Detected"
            confidence = "Moderate"
            description = f"Low ventricular rate ({mean_hr:.1f} bpm < 60 bpm threshold)."
        elif mean_rr > 0 and (sdnn / mean_rr) > 0.20:
            classification = "Irregular Rhythm / High HRV Variation"
            confidence = "Moderate"
            description = f"Coefficient of RR variation is elevated ({sdnn:.1f} ms SDNN), suggesting potential ectopic beats or sinus arrhythmia."
        else:
            classification = "Normal Sinus Rhythm Pattern"
            confidence = "High"
            description = f"Ventricular rate within normal resting bounds ({mean_hr:.1f} bpm) with stable RR intervals."

        return {
            "plugin_name": cls.plugin_name,
            "plugin_version": cls.plugin_version,
            "classification": classification,
            "confidence": confidence,
            "description": description,
            "is_clinically_validated": False,
            "regulatory_status": "Investigational Use Only — Not Approved for Diagnostic Use",
        }
