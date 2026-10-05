import pytest
from backend.app.utils.security import verify_password, get_password_hash, create_access_token, decode_access_token
from backend.app.database import SessionLocal, init_db
from backend.app.models.user import User


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()


def test_password_hashing():
    raw = "SecureSecret123!"
    hashed = get_password_hash(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_creation_and_decoding():
    token = create_access_token(subject="user-12345", role="researcher")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-12345"
    assert payload["role"] == "researcher"
    assert "exp" in payload


def test_seeded_users():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@biocloud.local").first()
        researcher = db.query(User).filter(User.email == "researcher@biocloud.local").first()
        assert admin is not None
        assert admin.role == "admin"
        assert verify_password("Admin123!", admin.hashed_password) is True

        assert researcher is not None
        assert researcher.role == "researcher"
        assert verify_password("Researcher123!", researcher.hashed_password) is True
    finally:
        db.close()
