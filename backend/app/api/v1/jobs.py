import json
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.job import Job
from backend.app.models.file import UploadedFile
from backend.app.schemas.job import JobCreate, JobOut
from backend.app.api.deps import get_current_user, verify_project_access
from backend.app.adapters.queue import get_queue_adapter
from backend.app.adapters.storage import get_storage_adapter
from backend.app.utils.audit import log_audit_event

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def _format_job(job: Job) -> JobOut:
    return JobOut(
        id=job.id,
        project_id=job.project_id,
        user_id=job.user_id,
        workflow_type=job.workflow_type,
        name=job.name,
        status=job.status,
        progress=job.progress,
        stage=job.stage,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        input_file_id=job.input_file_id,
        parameters=json.loads(job.parameters_json) if job.parameters_json else None,
        result=json.loads(job.result_json) if job.result_json else None,
        provenance=json.loads(job.provenance_json) if job.provenance_json else None,
        output_storage_key=job.output_storage_key,
        output_filename=job.output_filename,
    )


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    req: JobCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_project_access(req.project_id, current_user, db)

    # Validate input file if provided
    if req.input_file_id:
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == req.input_file_id).first()
        if not uploaded_file or uploaded_file.project_id != req.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Referenced input file not found in this project.",
            )

    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        project_id=req.project_id,
        user_id=current_user.id,
        workflow_type=req.workflow_type,
        name=req.name.strip(),
        status="queued",
        progress=0,
        stage="Queued for processing",
        input_file_id=req.input_file_id,
        parameters_json=json.dumps(req.parameters) if req.parameters else None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Enqueue asynchronously to matching worker
    queue_adapter = get_queue_adapter()
    await queue_adapter.enqueue_job(job.id, req.workflow_type, job.project_id)


    log_audit_event(
        db=db,
        event_type="job.created",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="job",
        target_id=job.id,
        details={
            "project_id": job.project_id,
            "workflow_type": job.workflow_type,
            "name": job.name,
        },
        request=request,
    )

    return _format_job(job)


@router.get("", response_model=List[JobOut])
def list_jobs(
    project_id: Optional[str] = None,
    workflow_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Job)

    if project_id:
        verify_project_access(project_id, current_user, db)
        query = query.filter(Job.project_id == project_id)
    elif current_user.role != "admin":
        # Only show jobs from user's accessible projects
        from backend.app.models.project import Project, ProjectMember
        member_proj_ids = [
            m.project_id
            for m in db.query(ProjectMember.project_id)
            .filter(ProjectMember.user_id == current_user.id)
            .all()
        ]
        accessible_projs = db.query(Project.id).filter(
            (Project.owner_id == current_user.id) | (Project.id.in_(member_proj_ids))
        ).all()
        acc_ids = [p[0] for p in accessible_projs]
        query = query.filter(Job.project_id.in_(acc_ids))

    if workflow_type:
        query = query.filter(Job.workflow_type == workflow_type)
    if status_filter:
        query = query.filter(Job.status == status_filter)

    jobs = query.order_by(Job.created_at.desc()).limit(100).all()
    return [_format_job(j) for j in jobs]


@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    verify_project_access(job.project_id, current_user, db)
    return _format_job(job)


@router.post("/{job_id}/cancel", response_model=JobOut)
def cancel_job(
    job_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    verify_project_access(job.project_id, current_user, db)

    if current_user.role != "admin" and job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own jobs.",
        )

    if job.status in ("completed", "failed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a job that is already '{job.status}'.",
        )

    # Trigger cancellation via queue adapter
    queue_adapter = get_queue_adapter()
    queue_adapter.cancel_job(job_id)

    job.status = "cancelled"
    job.stage = "Cancelled by user"
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)

    log_audit_event(
        db=db,
        event_type="job.cancelled",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="job",
        target_id=job.id,
        request=request,
    )
    return _format_job(job)


@router.post("/{job_id}/retry", response_model=JobOut)
async def retry_job(
    job_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    verify_project_access(job.project_id, current_user, db)

    if current_user.role != "admin" and job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only retry your own jobs.",
        )

    if job.status not in ("failed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only failed or cancelled jobs can be retried.",
        )

    job.status = "queued"
    job.progress = 0
    job.stage = "Queued for retry"
    job.error_message = None
    job.result_json = None
    job.provenance_json = None
    job.started_at = None
    job.completed_at = None
    db.commit()
    db.refresh(job)

    queue_adapter = get_queue_adapter()
    await queue_adapter.enqueue_job(job.id, job.workflow_type, job.project_id)

    log_audit_event(
        db=db,
        event_type="job.retried",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="job",
        target_id=job.id,
        request=request,
    )
    return _format_job(job)


@router.get("/{job_id}/download-result")
def download_job_result(
    job_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    verify_project_access(job.project_id, current_user, db)

    if not job.output_storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No output file artifact associated with this job.",
        )

    storage = get_storage_adapter()
    download_url = storage.generate_download_url(job.output_storage_key, expires_in=3600)

    log_audit_event(
        db=db,
        event_type="job.result_downloaded",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="job",
        target_id=job.id,
        details={"output_key": job.output_storage_key},
        request=request,
    )
    return {
        "download_url": download_url,
        "filename": job.output_filename or "result.dat",
    }
