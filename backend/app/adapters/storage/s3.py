import re
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
import boto3
from botocore.config import Config
from backend.app.config import AWS_S3_BUCKET, AWS_REGION, AWS_KMS_KEY_ID, AWS_ENDPOINT_URL
from backend.app.adapters.storage.base import StorageAdapter


class S3StorageAdapter(StorageAdapter):
    """
    AWS S3 Storage Adapter with SSE-KMS customer-managed encryption,
    private bucket enforcement, and short-lived presigned URL generation.
    """

    def __init__(
        self,
        bucket_name: str = AWS_S3_BUCKET,
        region: str = AWS_REGION,
        kms_key_id: str = AWS_KMS_KEY_ID,
        endpoint_url: Optional[str] = None,
    ):
        self.bucket_name = bucket_name
        self.region = region
        self.kms_key_id = kms_key_id
        self.endpoint_url = endpoint_url or (AWS_ENDPOINT_URL if AWS_ENDPOINT_URL else None)
        self.client = boto3.client(
            "s3",
            region_name=self.region,
            endpoint_url=self.endpoint_url,
            config=Config(signature_version="s3v4"),
        )

    @staticmethod
    def build_storage_key(project_id: str, workflow_type: str, file_id: str, filename: str) -> str:
        """
        Server-side generation of structured, isolated storage keys.
        Format: projects/{project_id}/{workflow_type}/{file_id}/{sanitized_filename}
        """
        clean_name = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(filename).name)[:120]
        clean_workflow = re.sub(r"[^a-z0-9_-]", "", workflow_type.lower())
        return f"projects/{project_id}/{clean_workflow}/{file_id}/{clean_name}"

    @staticmethod
    def extract_project_id(storage_key: str) -> Optional[str]:
        """
        Extracts project_id from storage key for authorization verification.
        """
        parts = storage_key.strip("/").split("/")
        if len(parts) >= 2 and parts[0] == "projects":
            return parts[1]
        elif len(parts) >= 1:
            return parts[0]
        return None

    def generate_upload_url(
        self, storage_key: str, expires_in: int = 900, content_type: Optional[str] = None
    ) -> Tuple[str, Dict[str, str]]:
        """
        Generate a short-lived presigned URL (default 15 minutes) with required KMS headers.
        """
        params: Dict[str, Any] = {
            "Bucket": self.bucket_name,
            "Key": storage_key,
            "ServerSideEncryption": "aws:kms",
        }
        headers: Dict[str, str] = {
            "x-amz-server-side-encryption": "aws:kms",
        }

        if self.kms_key_id:
            params["SSEKMSKeyId"] = self.kms_key_id
            headers["x-amz-server-side-encryption-aws-kms-key-id"] = self.kms_key_id

        if content_type:
            params["ContentType"] = content_type
            headers["Content-Type"] = content_type

        url = self.client.generate_presigned_url(
            ClientMethod="put_object",
            Params=params,
            ExpiresIn=expires_in,
            HttpMethod="PUT",
        )
        return url, headers

    def generate_download_url(self, storage_key: str, expires_in: int = 900) -> str:
        """
        Generate a short-lived presigned download URL (default 15 minutes).
        """
        return self.client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": self.bucket_name, "Key": storage_key},
            ExpiresIn=expires_in,
        )

    def put_object(
        self, storage_key: str, data: bytes, content_type: Optional[str] = None
    ) -> str:
        kwargs: Dict[str, Any] = {
            "Bucket": self.bucket_name,
            "Key": storage_key,
            "Body": data,
            "ServerSideEncryption": "aws:kms",
        }
        if self.kms_key_id:
            kwargs["SSEKMSKeyId"] = self.kms_key_id
        if content_type:
            kwargs["ContentType"] = content_type
        self.client.put_object(**kwargs)
        return storage_key

    def get_object(self, storage_key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket_name, Key=storage_key)
        return response["Body"].read()

    def delete_object(self, storage_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket_name, Key=storage_key)

    def object_exists(self, storage_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=storage_key)
            return True
        except Exception:
            return False

