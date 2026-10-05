from typing import Optional
from sqlalchemy.orm import Session
from backend.app.models.user import User
from backend.app.adapters.auth.base import AuthAdapter
from backend.app.utils.security import decode_access_token


class LocalAuthAdapter(AuthAdapter):
    def authenticate_token(self, token: str, db: Session) -> Optional[User]:
        payload = decode_access_token(token)
        if not payload:
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        return user
