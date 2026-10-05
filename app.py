import asyncio
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
DATA = Path(os.getenv("APP_DATA_DIR", ROOT / "data"))
UPLOADS = DATA / "uploads"
DB = DATA / "jobs.sqlite3"
BUCKET = os.getenv("AWS_S3_BUCKET", "").strip()
REGION = os.getenv("AWS_REGION", "us-east-1")
DATA.mkdir(parents=True, exist_ok=True)
UPLOADS.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="BioCloud Workbench", version="0.1.0")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


def connect():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY, project TEXT NOT NULL, name TEXT NOT NULL,
            filename TEXT NOT NULL, storage_key TEXT NOT NULL, status TEXT NOT NULL,
            progress INTEGER NOT NULL, stage TEXT NOT NULL, created_at TEXT NOT NULL,
            result TEXT, error TEXT
        )""")


init_db()


def job_dict(row):
    item = dict(row)
    item["result"] = json.loads(item["result"]) if item.get("result") else None
    return item


def get_job(job_id):
    with connect() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    return job_dict(row) if row else None


async def demo_pipeline(job_id: str, project: str):
    stages = [
        (12, "Validating input"),
        (38, "Preparing analysis"),
        (72, "Running demonstration workflow"),
        (100, "Completed — sample output"),
    ]
    try:
        for progress, stage in stages:
            await asyncio.sleep(1.4)
            with connect() as conn:
                conn.execute("UPDATE jobs SET progress=?, stage=?, status=? WHERE id=?",
                             (progress, stage, "completed" if progress == 100 else "processing", job_id))
        result = ({
            "type": "ECG demo summary",
            "summary": "Demo workflow completed. No clinical interpretation was performed.",
            "metrics": ["Input accepted", "Sample output generated"],
        } if project == "ecg" else {
            "type": "Protein prediction demo",
            "summary": "Demo workflow completed. No molecular structure prediction was performed.",
            "metrics": ["Sequence accepted", "Sample output generated"],
        })
        with connect() as conn:
            conn.execute("UPDATE jobs SET result=? WHERE id=?", (json.dumps(result), job_id))
    except Exception as exc:
        with connect() as conn:
            conn.execute("UPDATE jobs SET status='failed', stage='Workflow failed', error=? WHERE id=?",
                         (str(exc)[:500], job_id))


@app.get("/")
def home():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "storage": "s3" if BUCKET else "local", "mode": "demo"}


@app.get("/api/jobs")
def list_jobs():
    with connect() as conn:
        rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
    return [job_dict(row) for row in rows]


@app.get("/api/jobs/{job_id}")
def read_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.post("/api/jobs")
async def create_job(project: str = Form(...), name: str = Form(...), file: UploadFile = File(...)):
    if project not in {"ecg", "protein"}:
        raise HTTPException(400, "Project must be ecg or protein")
    clean_name = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(file.filename or "upload.dat").name)[:120]
    suffix = Path(clean_name).suffix.lower()
    allowed = {"ecg": {".csv", ".txt", ".dat"}, "protein": {".fasta", ".fa", ".fna", ".txt"}}
    if suffix not in allowed[project]:
        raise HTTPException(400, f"Unsupported file extension for {project} workflow")
    content = await file.read(100 * 1024 * 1024 + 1)
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(413, "Files must be 100 MB or smaller in this demo")
    if not content:
        raise HTTPException(400, "Uploaded file is empty")
    if project == "protein" and not re.search(rb"[A-Za-z]", content):
        raise HTTPException(400, "No sequence letters found")

    job_id = str(uuid.uuid4())
    key = f"{project}/{job_id}/{clean_name}"
    if BUCKET:
        try:
            boto3.client("s3", region_name=REGION).put_object(
                Bucket=BUCKET, Key=key, Body=content,
                ServerSideEncryption="aws:kms")
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(502, f"S3 upload failed: {exc.__class__.__name__}") from exc
    else:
        path = UPLOADS / job_id
        path.mkdir(parents=True, exist_ok=True)
        (path / clean_name).write_bytes(content)

    created_at = datetime.now(timezone.utc).isoformat()
    with connect() as conn:
        conn.execute("INSERT INTO jobs VALUES (?, ?, ?, ?, ?, 'queued', 0, 'Queued', ?, NULL, NULL)",
                     (job_id, project, name[:100], clean_name, key, created_at))
    asyncio.create_task(demo_pipeline(job_id, project))
    return get_job(job_id)


@app.get("/api/jobs/{job_id}/download")
def download_input(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if BUCKET:
        try:
            url = boto3.client("s3", region_name=REGION).generate_presigned_url(
                "get_object", Params={"Bucket": BUCKET, "Key": job["storage_key"]}, ExpiresIn=300)
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url)
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(502, "Could not create a temporary download link") from exc
    path = UPLOADS / job_id / job["filename"]
    if not path.exists():
        raise HTTPException(404, "Stored input is missing")
    return FileResponse(path, filename=job["filename"])
