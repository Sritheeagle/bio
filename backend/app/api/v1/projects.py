from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.project import Project, ProjectMember
from backend.app.models.job import Job
from backend.app.models.file import UploadedFile
from backend.app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut
from backend.app.api.deps import get_current_user, verify_project_access
from backend.app.utils.audit import log_audit_event

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "admin":
        projects = db.query(Project).order_by(Project.created_at.desc()).all()
    else:
        # Owned projects or member projects
        member_proj_ids = [
            m.project_id
            for m in db.query(ProjectMember.project_id)
            .filter(ProjectMember.user_id == current_user.id)
            .all()
        ]
        projects = (
            db.query(Project)
            .filter(
                (Project.owner_id == current_user.id) | (Project.id.in_(member_proj_ids))
            )
            .order_by(Project.created_at.desc())
            .all()
        )

    results = []
    for p in projects:
        job_count = db.query(Job).filter(Job.project_id == p.id).count()
        file_count = db.query(UploadedFile).filter(UploadedFile.project_id == p.id).count()
        results.append(
            ProjectOut(
                id=p.id,
                name=p.name,
                description=p.description,
                owner_id=p.owner_id,
                created_at=p.created_at,
                updated_at=p.updated_at,
                job_count=job_count,
                file_count=file_count,
            )
        )
    return results


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    req: ProjectCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        owner_id=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Add owner as project member
    member = ProjectMember(project_id=project.id, user_id=current_user.id, role="owner")
    db.add(member)
    db.commit()

    log_audit_event(
        db=db,
        event_type="project.created",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="project",
        target_id=project.id,
        details={"name": project.name},
        request=request,
    )
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        job_count=0,
        file_count=0,
    )


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    project: Project = Depends(verify_project_access),
    db: Session = Depends(get_db),
):
    job_count = db.query(Job).filter(Job.project_id == project.id).count()
    file_count = db.query(UploadedFile).filter(UploadedFile.project_id == project.id).count()
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        job_count=job_count,
        file_count=file_count,
    )


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    req: ProjectUpdate,
    request: Request,
    project: Project = Depends(verify_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.name is not None:
        project.name = req.name.strip()
    if req.description is not None:
        project.description = req.description.strip()
    db.commit()
    db.refresh(project)

    log_audit_event(
        db=db,
        event_type="project.updated",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="project",
        target_id=project.id,
        details={"name": project.name},
        request=request,
    )
    job_count = db.query(Job).filter(Job.project_id == project.id).count()
    file_count = db.query(UploadedFile).filter(UploadedFile.project_id == project.id).count()
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        job_count=job_count,
        file_count=file_count,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    request: Request,
    project: Project = Depends(verify_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin" and project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner or an administrator can delete this project.",
        )
    log_audit_event(
        db=db,
        event_type="project.deleted",
        user_id=current_user.id,
        user_email=current_user.email,
        target_type="project",
        target_id=project.id,
        details={"name": project.name},
        request=request,
    )
    db.delete(project)
    db.commit()
    return None
