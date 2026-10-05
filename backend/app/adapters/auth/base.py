from abc import ABC, abstractmethod
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.models.user import User


class AuthAdapter(ABC):
    @abstractmethod
    def authenticate_token(self, token: str, db: Session) -> Optional[User]:
        """Verify token and return corresponding active User."""
        pass
