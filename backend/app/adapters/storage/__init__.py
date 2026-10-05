from typing import Optional
from backend.app.config import STORAGE_TYPE, AWS_S3_BUCKET
from backend.app.adapters.storage.base import StorageAdapter
from backend.app.adapters.storage.local import LocalStorageAdapter
from backend.app.adapters.storage.s3 import S3StorageAdapter

_adapter: Optional[StorageAdapter] = None


def get_storage_adapter() -> StorageAdapter:
    global _adapter
    if _adapter is None:
        if STORAGE_TYPE == "s3" and AWS_S3_BUCKET:
            _adapter = S3StorageAdapter()
        else:
            _adapter = LocalStorageAdapter()
    return _adapter


def set_storage_adapter(adapter: Optional[StorageAdapter]) -> None:
    """Set or reset the active storage adapter (useful for test isolation)."""
    global _adapter
    _adapter = adapter
