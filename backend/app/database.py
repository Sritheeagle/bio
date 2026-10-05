import json
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from backend.app.config import DATABASE_URL, LOCAL_DEV_MODE

from backend.app.models.base import Base
from backend.app.models.user import User
from backend.app.models.project import Project, ProjectMember
from backend.app.models.model_version import ModelVersion
from backend.app.utils.security import get_password_hash

logger = logging.getLogger(__name__)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
    )
else:
    # PostgreSQL / Amazon Aurora Serverless connection pooling configuration
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    if LOCAL_DEV_MODE:
        logger.info("Local dev mode active: ensuring SQLite tables exist via metadata.create_all.")
        Base.metadata.create_all(bind=engine)
    else:
        logger.info("Production/AWS mode active: database schema must be managed via Alembic migrations. Testing connection.")
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as exc:
            logger.error("Failed to connect to production database: %s", exc)
            raise RuntimeError(f"Database connectivity check failed: {exc}")
    db: Session = SessionLocal()
    try:
        # Seed Admin user if not exists
        admin = db.query(User).filter(User.email == "admin@biocloud.local").first()
        if not admin:
            admin = User(
                email="admin@biocloud.local",
                hashed_password=get_password_hash("Admin123!"),
                full_name="BioCloud Administrator",
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

        # Seed Researcher user if not exists
        researcher = db.query(User).filter(User.email == "researcher@biocloud.local").first()
        if not researcher:
            researcher = User(
                email="researcher@biocloud.local",
                hashed_password=get_password_hash("Researcher123!"),
                full_name="Dr. Jane Doe, Principal Investigator",
                role="researcher",
                is_active=True,
            )
            db.add(researcher)
            db.commit()
            db.refresh(researcher)

        # Seed default project if none exists
        default_project = db.query(Project).first()
        if not default_project:
            proj = Project(
                name="Cardiology & Structural Biology Study 2026",
                description="Comprehensive biomedical project combining patient ECG telemetry review and target protein structural characterization.",
                owner_id=researcher.id,
            )
            db.add(proj)
            db.commit()
            db.refresh(proj)

            # Add researcher as owner member and admin as viewer
            m1 = ProjectMember(project_id=proj.id, user_id=researcher.id, role="owner")
            m2 = ProjectMember(project_id=proj.id, user_id=admin.id, role="contributor")
            db.add_all([m1, m2])
            db.commit()

        # Seed default model versions
        models_to_seed = [
            {
                "workflow_type": "ecg",
                "name": "Pan-Tompkins DSP Engine",
                "version": "v2.1.0",
                "status": "available",
                "description": "High-fidelity digital signal processing pipeline with Butterworth bandpass filter (0.5-40Hz), moving window integration, adaptive peak detection, and HRV metric extraction.",
                "is_enabled": True,
                "config_json": json.dumps({"low_cut": 0.5, "high_cut": 40.0, "window_ms": 150}),
            },
            {
                "workflow_type": "ecg",
                "name": "Arrhythmia Screening Rule Engine",
                "version": "v1.2.0",
                "status": "available",
                "description": "Rule-based non-diagnostic rhythm screening plugin classifying sinus tachycardia, bradycardia, and irregular RR intervals with research disclaimer.",
                "is_enabled": True,
                "config_json": json.dumps({"tachycardia_threshold": 100, "bradycardia_threshold": 60}),
            },
            {
                "workflow_type": "protein",
                "name": "ESMFold Structure Predictor",
                "version": "v1.0.0",
                "status": "available",
                "description": "Meta ESMFold end-to-end language model for single-sequence atomic 3D protein structure prediction with per-residue pLDDT confidence scores.",
                "is_enabled": True,
                "config_json": json.dumps({"max_recycles": 4, "chunk_size": 64, "adapter": "esmfold"}),
            },
            {
                "workflow_type": "protein",
                "name": "AlphaFold2 GPU Cluster (AWS Batch)",
                "version": "v2.3.2",
                "status": "needs_setup",
                "description": "DeepMind AlphaFold multimer/monomer pipeline requiring dedicated GPU worker (NVIDIA A10G/V100) and genetic databases (BFD/Uniclust30).",
                "is_enabled": False,
                "config_json": json.dumps({"container": "alphafold:2.3.2", "requires_gpu": True, "requires_databases": True}),
            },
        ]

        for m_data in models_to_seed:
            existing = db.query(ModelVersion).filter(
                ModelVersion.workflow_type == m_data["workflow_type"],
                ModelVersion.name == m_data["name"]
            ).first()
            if not existing:
                mv = ModelVersion(**m_data)
                db.add(mv)
        db.commit()

    finally:
        db.close()
