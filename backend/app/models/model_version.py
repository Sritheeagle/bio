import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Text, DateTime
from backend.app.models.base import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_type = Column(String(50), nullable=False)  # "ecg" or "protein"
    name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="available")  # "available", "needs_setup", "disabled"
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=True, nullable=False)
    config_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
