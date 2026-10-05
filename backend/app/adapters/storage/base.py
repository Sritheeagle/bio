from abc import ABC, abstractmethod
from typing import Tuple, Dict, Any, Optional


class StorageAdapter(ABC):
    @abstractmethod
    def generate_upload_url(
        self, storage_key: str, expires_in: int = 3600, content_type: Optional[str] = None
    ) -> Tuple[str, Dict[str, str]]:
        """Return (upload_url, headers) for direct short-lived upload."""
        pass

    @abstractmethod
    def generate_download_url(self, storage_key: str, expires_in: int = 3600) -> str:
        """Return download_url for authorized download."""
        pass

    @abstractmethod
    def put_object(
        self, storage_key: str, data: bytes, content_type: Optional[str] = None
    ) -> str:
        """Directly write bytes to storage."""
        pass

    @abstractmethod
    def get_object(self, storage_key: str) -> bytes:
        """Retrieve bytes from storage."""
        pass

    @abstractmethod
    def delete_object(self, storage_key: str) -> None:
        """Delete object from storage."""
        pass

    @abstractmethod
    def object_exists(self, storage_key: str) -> bool:
        """Check if object exists."""
        pass
