import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db
from backend.app.adapters.auth import set_auth_adapter, get_auth_adapter, LocalAuthAdapter
from backend.app.adapters.queue import set_queue_adapter, LocalQueueAdapter
from backend.app.adapters.storage import set_storage_adapter, LocalStorageAdapter

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_app_db():
    local_auth = LocalAuthAdapter()
    local_queue = LocalQueueAdapter()
    local_storage = LocalStorageAdapter()

    set_auth_adapter(local_auth)
    set_queue_adapter(local_queue)
    set_storage_adapter(local_storage)
    app.dependency_overrides[get_auth_adapter] = lambda: local_auth

    init_db()
    yield
    app.dependency_overrides.pop(get_auth_adapter, None)
    set_auth_adapter(None)
    set_queue_adapter(None)
    set_storage_adapter(None)


def get_auth_token(email: str = "researcher@biocloud.local", password: str = "Researcher123!"):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def test_health_check_endpoint():
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "storage" in data
    assert "workers" in data


def test_login_success_and_failure():
    # Success
    resp = client.post("/api/v1/auth/login", json={"email": "researcher@biocloud.local", "password": "Researcher123!"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert resp.json()["role"] == "researcher"

    # Failure
    resp_fail = client.post("/api/v1/auth/login", json={"email": "researcher@biocloud.local", "password": "WrongPassword"})
    assert resp_fail.status_code == 401


def test_project_crud_and_access_control():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # List projects
    resp = client.get("/api/v1/projects", headers=headers)
    assert resp.status_code == 200
    projects = resp.json()
    assert len(projects) >= 1
    proj_id = projects[0]["id"]

    # Create new project
    resp_create = client.post(
        "/api/v1/projects",
        json={"name": "Cardiac Arrhythmia Pilot", "description": "Clinical research trial"},
        headers=headers,
    )
    assert resp_create.status_code == 201
    new_proj = resp_create.json()
    assert new_proj["name"] == "Cardiac Arrhythmia Pilot"


def test_ecg_job_creation_and_lifecycle():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    projs = client.get("/api/v1/projects", headers=headers).json()
    proj_id = projs[0]["id"]

    # Create synthetic ECG job
    job_payload = {
        "project_id": proj_id,
        "workflow_type": "ecg",
        "name": "Test Synthetic Sinus Analysis",
        "parameters": {
            "synthetic_pattern": "normal_sinus",
            "sampling_rate_hz": 250.0,
            "channel_name": "lead_II",
        },
    }
    resp = client.post("/api/v1/jobs", json=job_payload, headers=headers)
    assert resp.status_code == 201
    job = resp.json()
    assert job["workflow_type"] == "ecg"
    assert job["status"] in ("queued", "processing", "completed")

    # Get job status
    job_id = job["id"]
    resp_get = client.get(f"/api/v1/jobs/{job_id}", headers=headers)
    assert resp_get.status_code == 200
    assert resp_get.json()["id"] == job_id


def test_protein_job_creation_with_benchmark():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    projs = client.get("/api/v1/projects", headers=headers).json()
    proj_id = projs[0]["id"]

    # Create protein job with reference benchmark
    job_payload = {
        "project_id": proj_id,
        "workflow_type": "protein",
        "name": "Test Insulin Benchmark Fold",
        "parameters": {
            "reference_benchmark": "insulin",
            "sequence": "FVNQHLCGSHLVEALYLVCGERGFFYTPKT",
        },
    }
    resp = client.post("/api/v1/jobs", json=job_payload, headers=headers)
    assert resp.status_code == 201
    job = resp.json()
    assert job["workflow_type"] == "protein"


def test_admin_access_restriction():
    researcher_token = get_auth_token("researcher@biocloud.local", "Researcher123!")
    headers = {"Authorization": f"Bearer {researcher_token}"}

    # Researcher cannot access admin endpoints
    resp = client.get("/api/v1/admin/users", headers=headers)
    assert resp.status_code == 403

    # Admin CAN access admin endpoints
    admin_token = get_auth_token("admin@biocloud.local", "Admin123!")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp_admin = client.get("/api/v1/admin/users", headers=admin_headers)
    assert resp_admin.status_code == 200
    assert len(resp_admin.json()) >= 2


def test_copilot_query_endpoint():
    # 1. Test DSP Query
    ecg_req = {"query": "Explain Butterworth zero-phase filter for ECG"}
    resp_ecg = client.post("/api/v1/copilot/query", json=ecg_req)
    assert resp_ecg.status_code == 200
    ecg_data = resp_ecg.json()
    assert ecg_data["category"] == "cardiovascular_dsp"
    assert "Butterworth" in ecg_data["response"]
    assert len(ecg_data["citations"]) > 0
    assert "RUO" in ecg_data["ruo_disclaimer"]

    # 2. Test Protein Query
    protein_req = {"query": "How is pLDDT confidence measured in ESMFold structures?"}
    resp_protein = client.post("/api/v1/copilot/query", json=protein_req)
    assert resp_protein.status_code == 200
    protein_data = resp_protein.json()
    assert protein_data["category"] == "structural_biology"
    assert "pLDDT" in protein_data["response"]
    assert len(protein_data["citations"]) > 0

