from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class JobCreate(BaseModel):
    project_id: str
    workflow_type: str = Field(..., pattern="^(ecg|protein)$")
    name: str = Field(..., min_length=2, max_length=200)
    input_file_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    user_id: str
    workflow_type: str
    name: str
    status: str
    progress: int
    stage: str
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    input_file_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    provenance: Optional[Dict[str, Any]] = None
    output_storage_key: Optional[str] = None
    output_filename: Optional[str] = None

