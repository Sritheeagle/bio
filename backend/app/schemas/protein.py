from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class ProteinPredictionParams(BaseModel):
    sequence: Optional[str] = Field(None, max_length=5000)
    header: Optional[str] = Field(None, max_length=200)
    model_name: str = Field("esmfold_v1", max_length=50)
    num_recycles: int = Field(4, ge=1, le=10)
    reference_benchmark: Optional[str] = None  # "insulin", "ubiquitin", "trp_cage"


class ProteinPredictionResult(BaseModel):
    header: str
    sequence_length: int
    molecular_weight_kda: float
    model_name: str
    model_version: str
    execution_device: str
    mean_plddt: Optional[float] = None
    ptm_score: Optional[float] = None
    per_residue_plddt: Optional[List[float]] = None
    secondary_structure_summary: Optional[Dict[str, int]] = None
    pdb_preview: Optional[str] = None
    is_reference_benchmark: bool = False
    model_status: str  # "completed", "model_unavailable", "failed"
    setup_instructions: Optional[str] = None
    research_disclaimer: str = "Research Use Only. Predicted models require experimental structural validation."
