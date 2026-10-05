import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import logging
from backend.app.config import (
    PROJECT_NAME,
    VERSION,
    API_V1_STR,
    CORS_ORIGINS,
    ROOT_DIR,
    QUEUE_TYPE,
    LOCAL_DEV_MODE,
    validate_config,
)
from backend.app.database import init_db
from backend.app.workers.ecg_worker import run_ecg_worker
from backend.app.workers.protein_worker import run_protein_worker
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.projects import router as projects_router
from backend.app.api.v1.files import router as files_router
from backend.app.api.v1.jobs import router as jobs_router
from backend.app.api.v1.ecg import router as ecg_router
from backend.app.api.v1.protein import router as protein_router
from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.storage import router as storage_router
from backend.app.api.v1.health import router as health_router

logger = logging.getLogger(__name__)
worker_tasks = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup validation: ensure required settings exist without exposing secrets
    is_valid, validation_errors = validate_config(strict_aws=not LOCAL_DEV_MODE)
    if not is_valid:
        error_summary = "Application startup failed due to configuration errors:\n - " + "\n - ".join(validation_errors)
        logger.error(error_summary)
        raise RuntimeError(error_summary)

    # 2. Initialize database (SQLite create_all in dev mode; connection check in prod mode)
    init_db()

    # 3. Conditional background worker tasks
    # Only spawn local in-memory workers when local queue mode is active
    if QUEUE_TYPE == "local":
        logger.info("QUEUE_TYPE is 'local'. Starting local in-memory ECG and Protein worker tasks.")
        ecg_task = asyncio.create_task(run_ecg_worker())
        protein_task = asyncio.create_task(run_protein_worker())
        worker_tasks.extend([ecg_task, protein_task])
    else:
        logger.info(
            "QUEUE_TYPE is '%s'. Local in-memory workers suppressed. Jobs dispatched to SQS and processed via worker daemon / AWS Batch.",
            QUEUE_TYPE,
        )

    yield

    # Shutdown: cancel any local in-memory workers
    for t in worker_tasks:
        t.cancel()



app = FastAPI(
    title=PROJECT_NAME,
    version=VERSION,
    description="BioCloud Workbench: Health Care ECG Signal Processing and Protein Structure Prediction",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 routers
app.include_router(health_router, prefix=API_V1_STR)
app.include_router(auth_router, prefix=API_V1_STR)
app.include_router(projects_router, prefix=API_V1_STR)
app.include_router(files_router, prefix=API_V1_STR)
app.include_router(jobs_router, prefix=API_V1_STR)
app.include_router(ecg_router, prefix=API_V1_STR)
app.include_router(protein_router, prefix=API_V1_STR)
app.include_router(admin_router, prefix=API_V1_STR)
app.include_router(storage_router, prefix=API_V1_STR)

# Also expose health at /api/health for convenient probe checks
app.include_router(health_router, prefix="/api")

# Mount Next.js static assets if built
next_static_dir = ROOT_DIR / "frontend" / ".next" / "static"
if next_static_dir.exists():
    app.mount("/_next/static", StaticFiles(directory=str(next_static_dir)), name="next-static")

# Mount static directory for fallback assets
static_dir = ROOT_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/")
def root():
    # Priority 1: Built Next.js app
    next_index = ROOT_DIR / "frontend" / ".next" / "server" / "app" / "index.html"
    if next_index.exists():
        return FileResponse(next_index)

    # Priority 2: Static export if generated
    out_index = ROOT_DIR / "frontend" / "out" / "index.html"
    if out_index.exists():
        return FileResponse(out_index)

    return {
        "app": PROJECT_NAME,
        "version": VERSION,
        "docs_url": "/docs",
        "api_v1": API_V1_STR,
        "health": "/api/v1/health",
        "message": "BioCloud Workbench Backend is running.",
    }

