from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.file import UploadedFile
from backend.app.models.model_version import ModelVersion
from backend.app.adapters.storage import get_storage_adapter
from backend.app.pipelines.protein.validator import parse_and_validate_fasta
from backend.app.pipelines.protein.references import BENCHMARKS
from backend.app.pipelines.protein.esmfold import ESMFoldAdapter
from backend.app.api.deps import get_current_user, verify_project_access

router = APIRouter(prefix="/protein", tags=["Protein Structure Prediction"])


class ValidateFastaRequest(BaseModel):
    sequence: Optional[str] = None
    file_id: Optional[str] = None


@router.get("/benchmarks")
def list_reference_benchmarks():
    return [
        {
            "id": b["id"],
            "name": b["name"],
            "header": b["header"],
            "sequence": b["sequence"],
            "sequence_length": len(b["sequence"]),
            "organism": b["organism"],
            "mean_plddt": b["mean_plddt"],
            "ptm": b["ptm"],
            "label": "REFERENCE BENCHMARK STRUCTURE (Synthetic verification)",
        }
        for b in BENCHMARKS.values()
    ]


@router.post("/validate")
def validate_sequence(
    req: ValidateFastaRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fasta_input = ""
    if req.file_id:
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == req.file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="Referenced file not found")
        verify_project_access(uploaded_file.project_id, current_user, db)
        storage = get_storage_adapter()
        file_bytes = storage.get_object(uploaded_file.storage_key)
        fasta_input = file_bytes.decode("utf-8", errors="ignore")
    elif req.sequence:
        fasta_input = req.sequence
    else:
        raise HTTPException(status_code=400, detail="Must provide sequence or file_id.")

    try:
        sequence, header, metadata = parse_and_validate_fasta(fasta_input)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "is_valid": True,
        "header": header,
        "sequence": sequence,
        "sequence_length": metadata["sequence_length"],
        "molecular_weight_kda": metadata["molecular_weight_kda"],
        "composition": metadata["composition"],
    }


@router.get("/models")
def list_protein_models(db: Session = Depends(get_db)):
    is_available, status_msg, details = ESMFoldAdapter.check_availability()
    db_models = (
        db.query(ModelVersion)
        .filter(ModelVersion.workflow_type == "protein")
        .all()
    )
    result = []
    for m in db_models:
        m_dict = {
            "id": m.id,
            "name": m.name,
            "version": m.version,
            "status": m.status,
            "description": m.description,
            "is_enabled": m.is_enabled,
        }
        if "ESMFold" in m.name:
            m_dict["runtime_availability"] = is_available
            m_dict["runtime_status"] = status_msg
            m_dict["runtime_details"] = details
        result.append(m_dict)
    return result


@router.get("/lookup/{identifier}")
def lookup_protein_identifier(identifier: str):
    """
    Looks up a protein sequence, gene name, or PDB crystal structure
    from UniProt / RCSB PDB with full structural metadata and IUPAC validation.
    """
    try:
        from backend.app.pipelines.protein.uniprot import resolve_protein_identifier
        return resolve_protein_identifier(identifier)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))

