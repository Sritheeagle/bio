import re
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.project import Project
from backend.app.models.file import UploadedFile
from backend.app.schemas.file import UploadTicketRequest, UploadTicketResponse, FileOut
from backend.app.adapters.storage import get_storage_adapter
from backend.app.api.deps import get_current_user, verify_project_access
from backend.app.config import (
    ECG_ALLOWED_EXTENSIONS,
    ECG_MAX_FILE_SIZE_MB,
    PROTEIN_ALLOWED_EXTENSIONS,
    PROTEIN_MAX_FILE_SIZE_MB,
    UPLOAD_EXPIRATION_SECONDS,
)
from backend.app.utils.audit import log_audit_event

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload-ticket", response_model=UploadTicketResponse)
def request_upload_ticket(
    req: UploadTicketRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify access to target project
    verify_project_access(req.project_id, current_user, db)

    # Validate file extension
    clean_name = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(req.filename).name)[:120]
    ext = Path(clean_name).suffix.lower()

    if req.workflow_type == "ecg":
        if ext not in ECG_ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported ECG file format '{ext}'. Supported: {', '.join(sorted(ECG_ALLOWED_EXTENSIONS))}",
            )
        max_bytes = ECG_MAX_FILE_SIZE_MB * 1024 * 1024
        if req.file_size > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"ECG file size exceeds maximum limit of {ECG_MAX_FILE_SIZE_MB} MB.",
            )
    elif req.workflow_type == "protein":
        if ext not in PROTEIN_ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported protein file format '{ext}'. Supported: {', '.join(sorted(PROTEIN_ALLOWED_EXTENSIONS))}",
            )
        max_bytes = PROTEIN_MAX_FILE_SIZE_MB * 1024 * 1024
        if req.file_size > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Protein file size exceeds maximum limit of {PROTEIN_MAX_FILE_SIZE_MB} MB.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workflow type must be 'ecg' or 'protein'.",
        )

    file_id = str(uuid.uuid4())
    from backend.app.adapters.storage.s3 import S3StorageAdapter
    storage_key = S3StorageAdapter.build_storage_key(
        project_id=req.project_id,
        workflow_type=req.workflow_type,
        file_id=file_id,
        filename=clean_name,
    )

    storage = get_storage_adapter()
    upload_url, headers = storage.generate_upload_url(
        storage_key=storage_key,
        expires_in=UPLOAD_EXPIRATION_SECONDS,
        content_type=req.content_type,
    )

    # Record uploaded file record
    uploaded_file = UploadedFile(
        id=file_id,
        project_id=req.project_id,
        user_id=current_user.id,
        workflow_type=req.workflow_type,
        original_name=clean_name,
        storage_key=storage_key,
        file_size=req.file_size,
        content_type=req.content_type,
        sha256_checksum=req.sha256_checksum,
        is_validated=False,
    )
    db.add(uploaded_file)
    db.commit()

    log_audit_event(
        db=db,
        event_type="file.upload_ticket_created",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="file",
        target_id=file_id,
        details={
            "filename": clean_name,
            "project_id": req.project_id,
            "workflow_type": req.workflow_type,
            "file_size": req.file_size,
        },
        request=request,
    )

    return UploadTicketResponse(
        file_id=file_id,
        upload_url=upload_url,
        storage_key=storage_key,
        expires_in=UPLOAD_EXPIRATION_SECONDS,
        headers=headers,
    )


@router.get("", response_model=List[FileOut])
def list_files(
    project_id: str,
    workflow_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_project_access(project_id, current_user, db)
    query = db.query(UploadedFile).filter(UploadedFile.project_id == project_id)
    if workflow_type:
        query = query.filter(UploadedFile.workflow_type == workflow_type)
    return query.order_by(UploadedFile.created_at.desc()).all()


@router.get("/{file_id}", response_model=FileOut)
def get_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not uploaded_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    verify_project_access(uploaded_file.project_id, current_user, db)
    return uploaded_file


@router.get("/{file_id}/download")
def get_file_download_url(
    file_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not uploaded_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    verify_project_access(uploaded_file.project_id, current_user, db)

    storage = get_storage_adapter()
    download_url = storage.generate_download_url(
        uploaded_file.storage_key, expires_in=UPLOAD_EXPIRATION_SECONDS
    )


    log_audit_event(
        db=db,
        event_type="file.download_requested",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="file",
        target_id=file_id,
        details={"storage_key": uploaded_file.storage_key},
        request=request,
    )
    return {"download_url": download_url, "filename": uploaded_file.original_name}
