import os
import hmac
import hashlib
import base64
import json
import time
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
from backend.app.config import STORAGE_DIR, SECRET_KEY, API_V1_STR
from backend.app.adapters.storage.base import StorageAdapter


class LocalStorageAdapter(StorageAdapter):
    def __init__(self, base_dir: Path = STORAGE_DIR):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, storage_key: str) -> Path:
        # Prevent path traversal attacks
        clean_key = storage_key.replace("\\", "/").strip("/")
        if ".." in clean_key.split("/"):
            raise ValueError("Path traversal attempt detected in storage key")
        target = (self.base_dir / Path(clean_key)).resolve()
        if not str(target).startswith(str(self.base_dir)):
            raise ValueError("Invalid storage key path traversal attempt")
        return target

    def _generate_token(self, storage_key: str, action: str, expires_in: int) -> str:
        payload = {
            "key": storage_key,
            "act": action,
            "exp": int(time.time()) + expires_in,
        }
        data_str = json.dumps(payload, separators=(",", ":"))
        data_b64 = base64.urlsafe_b64encode(data_str.encode("utf-8")).decode("utf-8")
        sig = hmac.new(SECRET_KEY.encode("utf-8"), data_b64.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"{data_b64}.{sig}"

    @staticmethod
    def verify_token(token: str, expected_action: str) -> Optional[str]:
        try:
            parts = token.split(".")
            if len(parts) != 2:
                return None
            data_b64, sig = parts
            expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), data_b64.encode("utf-8"), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, expected_sig):
                return None
            data_str = base64.urlsafe_b64decode(data_b64.encode("utf-8")).decode("utf-8")
            payload = json.loads(data_str)
            if payload.get("act") != expected_action:
                return None
            if int(payload.get("exp", 0)) < time.time():
                return None
            return payload.get("key")
        except Exception:
            return None

    def generate_upload_url(
        self, storage_key: str, expires_in: int = 3600, content_type: Optional[str] = None
    ) -> Tuple[str, Dict[str, str]]:
        token = self._generate_token(storage_key, "upload", expires_in)
        url = f"{API_V1_STR}/storage/upload?token={token}"
        headers = {}
        if content_type:
            headers["Content-Type"] = content_type
        return url, headers

    def generate_download_url(self, storage_key: str, expires_in: int = 3600) -> str:
        token = self._generate_token(storage_key, "download", expires_in)
        return f"{API_V1_STR}/storage/download?token={token}"

    def put_object(
        self, storage_key: str, data: bytes, content_type: Optional[str] = None
    ) -> str:
        target = self._safe_path(storage_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return storage_key

    def get_object(self, storage_key: str) -> bytes:
        target = self._safe_path(storage_key)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(f"Storage object not found: {storage_key}")
        return target.read_bytes()

    def delete_object(self, storage_key: str) -> None:
        target = self._safe_path(storage_key)
        if target.exists() and target.is_file():
            target.unlink()

    def object_exists(self, storage_key: str) -> bool:
        target = self._safe_path(storage_key)
        return target.exists() and target.is_file()
