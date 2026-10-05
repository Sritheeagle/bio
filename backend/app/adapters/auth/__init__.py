from typing import Optional
from backend.app.config import LOCAL_DEV_MODE, COGNITO_USER_POOL_ID
from backend.app.adapters.auth.base import AuthAdapter
from backend.app.adapters.auth.local import LocalAuthAdapter
from backend.app.adapters.auth.cognito import CognitoAuthAdapter

_auth_adapter: Optional[AuthAdapter] = None


def get_auth_adapter() -> AuthAdapter:
    global _auth_adapter
    if _auth_adapter is None:
        if not LOCAL_DEV_MODE and COGNITO_USER_POOL_ID:
            _auth_adapter = CognitoAuthAdapter()
        else:
            _auth_adapter = LocalAuthAdapter()
    return _auth_adapter


def set_auth_adapter(adapter: Optional[AuthAdapter]) -> None:
    """Set or reset the active auth adapter (useful for test isolation)."""
    global _auth_adapter
    _auth_adapter = adapter
