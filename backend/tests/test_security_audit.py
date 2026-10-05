import pytest
from backend.app.adapters.storage.local import LocalStorageAdapter
from backend.app.utils.audit import log_audit_event
from backend.app.database import SessionLocal, init_db
from backend.app.models.audit import AuditEvent


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()


def test_storage_path_traversal_prevention():
    adapter = LocalStorageAdapter()
    with pytest.raises(ValueError):
        adapter._safe_path("../../windows/system32/cmd.exe")


def test_storage_token_validation():
    adapter = LocalStorageAdapter()
    token = adapter._generate_token("project1/ecg/file.csv", "upload", 3600)
    # Valid token verification
    key = LocalStorageAdapter.verify_token(token, "upload")
    assert key == "project1/ecg/file.csv"

    # Action mismatch verification
    assert LocalStorageAdapter.verify_token(token, "download") is None

    # Tampered token
    tampered = token[:-4] + "abcd"
    assert LocalStorageAdapter.verify_token(tampered, "upload") is None


def test_audit_scrubbing_credentials():
    db = SessionLocal()
    try:
        event = log_audit_event(
            db=db,
            event_type="test.auth_action",
            user_email="researcher@biocloud.local",
            details={
                "username": "researcher",
                "password": "SecretPassword123!",
                "access_token": "eyJhbGciOi...",
                "status": "ok",
            },
        )
        assert event is not None
        assert "SecretPassword123!" not in event.details_json
        assert "eyJhbGciOi" not in event.details_json
        assert "status" in event.details_json
    finally:
        db.close()
