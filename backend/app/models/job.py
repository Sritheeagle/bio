import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.models.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    workflow_type = Column(String(50), nullable=False, index=True)  # "ecg" or "protein"
    name = Column(String(200), nullable=False)
    status = Column(String(50), nullable=False, default="queued", index=True)  # "queued", "processing", "completed", "failed", "cancelled"
    progress = Column(Integer, default=0, nullable=False)
    stage = Column(String(100), default="Queued", nullable=False)
    error_message = Column(Text, nullable=True)

    input_file_id = Column(String(36), ForeignKey("uploaded_files.id"), nullable=True)
    parameters_json = Column(Text, nullable=True)  # JSON string
    result_json = Column(Text, nullable=True)  # JSON string
    provenance_json = Column(Text, nullable=True)  # JSON string

    output_storage_key = Column(String(500), nullable=True)
    output_filename = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="jobs")
    user = relationship("User", back_populates="jobs")
    input_file = relationship("UploadedFile", back_populates="jobs")
