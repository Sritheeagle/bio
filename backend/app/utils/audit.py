import json
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Request
from backend.app.models.audit import AuditEvent


def log_audit_event(
    db: Session,
    event_type: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> AuditEvent:
    ip_address = None
    if request:
        ip_address = request.client.host if request.client else None

    # Never log sensitive secrets, raw passwords, or tokens in audit logs
    clean_details = {}
    if details:
        for k, v in details.items():
            if any(secret_term in k.lower() for secret_term in ("pass", "token", "secret", "auth", "key")):
                continue
            clean_details[k] = v

    event = AuditEvent(
        user_id=user_id,
        user_email=user_email,
        event_type=event_type,
        target_type=target_type,
        target_id=target_id,
        details_json=json.dumps(clean_details) if clean_details else None,
        ip_address=ip_address,
    )
    db.add(event)
    try:
        db.commit()
    except Exception:
        db.rollback()
    return event
