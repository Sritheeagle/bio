from typing import Optional, List, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])


class CopilotQueryRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None


class CopilotQueryResponse(BaseModel):
    query: str
    response: str
    category: str
    citations: List[str]
    confidence: float
    ruo_disclaimer: str = (
        "Research Use Only (RUO). BioCloud AI Copilot predictions and interpretations "
        "are for computational research and exploratory validation only, not clinical diagnostics."
    )


@router.post("/query", response_model=CopilotQueryResponse)
def copilot_query(req: CopilotQueryRequest):
    q = req.query.strip().lower()

    if any(k in q for k in ["tachycardia", "bradycardia", "arrhythmia", "ecg", "hrv", "qrs", "butterworth"]):
        category = "cardiovascular_dsp"
        if "tachycardia" in q:
            resp = (
                "### Sinus Tachycardia Clinical Assessment\n"
                "- **Ventricular Rate**: Sustained ventricular depolarization rate exceeding 100 bpm with upright P-waves in Lead II.\n"
                "- **Autonomic Profile**: Associated with sympathetic hyperactivation, suppressed SDNN (< 35 ms), and elevated LF/HF ratio.\n"
                "- **DSP Filter Recommendation**: Apply 0.5–40 Hz zero-phase forward-backward Butterworth IIR filter to eliminate respiration drift without introducing phase delay."
            )
            citations = ["Goldberger AL, et al. PhysioNet: Components of a new research resource for complex physiologic signals (2000)."]
            conf = 0.96
        elif "butterworth" in q or "filter" in q:
            resp = (
                "### Zero-Phase Butterworth Digital Signal Processing\n"
                "- **Design**: 2nd-order IIR bandpass with cutoffs at 0.5 Hz (high-pass) and 45.0 Hz (low-pass).\n"
                "- **Phase Distortion Avoidance**: Implemented via `scipy.signal.filtfilt`, doubling the effective order and achieving precisely zero group delay.\n"
                "- **Clinical Benefit**: Preserves the exact onset and termination fiducial points of the QRS complex for accurate QTc measurement."
            )
            citations = ["Pan J, Tompkins WJ. A real-time QRS detection algorithm. IEEE Trans Biomed Eng. 1985."]
            conf = 0.98
        else:
            resp = (
                "### Heart Rate Variability (HRV) Biomarker Metrics\n"
                "- **SDNN**: Standard deviation of all NN intervals reflecting total autonomic variability.\n"
                "- **RMSSD**: Root mean square of successive differences measuring parasympathetic vagal innervation.\n"
                "- **pNN50**: Percentage of interval differences exceeding 50 ms.\n"
                "- **LF/HF Ratio**: Spectral power balance between sympathetic (0.04–0.15 Hz) and parasympathetic (0.15–0.40 Hz) modulation."
            )
            citations = ["Task Force of the ESC and NASPE. Heart rate variability: standards of measurement. Circulation 1996."]
            conf = 0.95

    elif any(k in q for k in ["protein", "esmfold", "plddt", "alphafold", "fasta", "structure"]):
        category = "structural_biology"
        if "plddt" in q:
            resp = (
                "### ESMFold / AlphaFold pLDDT Confidence Metric\n"
                "- **> 90 (Deep Blue)**: High accuracy; coordinates are reliable for active site geometry and ligand docking.\n"
                "- **70–90 (Cyan)**: Confident backbone trace with well-modeled secondary structure elements.\n"
                "- **50–70 (Yellow)**: Low confidence; typical for exposed solvent loops and flexible hinge regions.\n"
                "- **< 50 (Orange/Red)**: Very low confidence; frequently indicates Intrinsically Disordered Proteins/Regions (IDPs/IDRs)."
            )
            citations = ["Lin Z, et al. Evolutionary-scale prediction of atomic-level protein structure with a language model. Science 2023."]
            conf = 0.97
        else:
            resp = (
                "### ESMFold Deep Learning Structural Inference\n"
                "- **Architecture**: ESM-2 transformer (up to 3B parameters) sequence model paired with an invariant point attention folding trunk.\n"
                "- **Inference Speed**: Direct single-sequence inference in ~1.5 to 4 seconds, eliminating the CPU bottleneck of homology search MSA generation.\n"
                "- **Validation**: Coordinates output in standardized PDB format with B-factor columns occupied by per-residue pLDDT values."
            )
            citations = ["Rives A, et al. Biological structure and function emerge from scaling unsupervised learning to 250M protein sequences. PNAS 2021."]
            conf = 0.94

    elif any(k in q for k in ["aws", "cloud", "s3", "ec2", "security", "docker"]):
        category = "cloud_infrastructure"
        resp = (
            "### BioCloud AWS Production Deployment Architecture\n"
            "- **Region**: eu-north-1 (Stockholm, low-latency Nordic cloud zone).\n"
            "- **Object Storage**: Amazon S3 bucket `biocloud-workbench-211125717128` with AES-256 server-side encryption and versioning.\n"
            "- **Compute**: Amazon EC2 `t3.large` compute node running Docker Compose microservices.\n"
            "- **Zero-Trust**: Least-privilege IAM instance profile with SSM Session Manager access."
        )
        citations = ["AWS Well-Architected Framework: Healthcare and Life Sciences Lens (2024)."]
        conf = 0.99

    else:
        category = "general_biomedical"
        resp = (
            "### BioCloud Computational Workbench Copilot\n"
            "Ready to assist with digital ECG signal processing, HRV time/frequency domain analytics, "
            "ESMFold 3D structural predictions, and AWS S3/EC2 cloud infrastructure management."
        )
        citations = []
        conf = 0.90

    return CopilotQueryResponse(
        query=req.query,
        response=resp,
        category=category,
        citations=citations,
        confidence=conf,
    )
