from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.model_version import ModelVersion
from backend.app.models.audit import AuditEvent
from backend.app.schemas.admin import UserAdminOut, UserAdminUpdate, ModelVersionOut, ModelVersionUpdate
from backend.app.schemas.audit import AuditEventOut
from backend.app.api.deps import require_admin
from backend.app.utils.audit import log_audit_event

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/users", response_model=List[UserAdminOut])
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.asc()).all()
    return users


@router.put("/users/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: str,
    req: UserAdminUpdate,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.role is not None:
        if req.role not in ("researcher", "admin"):
            raise HTTPException(status_code=400, detail="Role must be 'researcher' or 'admin'.")
        user.role = req.role

    if req.is_active is not None:
        user.is_active = req.is_active

    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        event_type="admin.user_updated",
        user_id=admin.id,
        user_email=admin.email,
        target_type="user",
        target_id=user.id,
        details={"updated_role": user.role, "updated_active": user.is_active},
        request=request,
    )
    return user


@router.get("/models", response_model=List[ModelVersionOut])
def list_models(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    models = db.query(ModelVersion).order_by(ModelVersion.workflow_type.asc()).all()
    return models


@router.put("/models/{model_id}", response_model=ModelVersionOut)
def update_model(
    model_id: str,
    req: ModelVersionUpdate,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = db.query(ModelVersion).filter(ModelVersion.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model engine not found")

    if req.is_enabled is not None:
        model.is_enabled = req.is_enabled
    if req.status is not None:
        model.status = req.status
    if req.description is not None:
        model.description = req.description

    db.commit()
    db.refresh(model)

    log_audit_event(
        db=db,
        event_type="admin.model_updated",
        user_id=admin.id,
        user_email=admin.email,
        target_type="model",
        target_id=model.id,
        details={"name": model.name, "is_enabled": model.is_enabled, "status": model.status},
        request=request,
    )
    return model


@router.get("/audit", response_model=List[AuditEventOut])
@router.get("/audit-events", response_model=List[AuditEventOut])
def list_audit_events(
    event_type: Optional[str] = None,
    limit: int = 100,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditEvent)
    if event_type:
        query = query.filter(AuditEvent.event_type.like(f"%{event_type}%"))
    events = query.order_by(AuditEvent.created_at.desc()).limit(limit).all()
    return events
