from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class UploadTicketRequest(BaseModel):
    project_id: str
    workflow_type: str = Field(..., pattern="^(ecg|protein)$")
    filename: str = Field(..., min_length=1, max_length=255)
    file_size: int = Field(..., gt=0)
    content_type: Optional[str] = None
    sha256_checksum: Optional[str] = Field(None, max_length=64)


class UploadTicketResponse(BaseModel):
    file_id: str
    upload_url: str
    storage_key: str
    expires_in: int
    headers: Optional[dict] = None


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    user_id: str
    workflow_type: str
    original_name: str
    file_size: int
    content_type: Optional[str]
    sha256_checksum: Optional[str]
    is_validated: bool
    created_at: datetime

