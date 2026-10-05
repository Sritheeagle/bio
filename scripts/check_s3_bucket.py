"""
BioCloud Workbench - S3 Bucket Status Poller
Monitors when https://biocloud-workbench-211125717128.s3.eu-north-1.amazonaws.com
becomes active.
"""

import sys
import time
import urllib.request
import urllib.error

BUCKET_NAME = "biocloud-workbench-211125717128"
REGION = "eu-north-1"
URL = f"https://{BUCKET_NAME}.s3.{REGION}.amazonaws.com"


def check_bucket() -> str:
    try:
        req = urllib.request.Request(URL, method="HEAD")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return "READY (HTTP 200)"
    except urllib.error.HTTPError as e:
        if e.code == 403:
            # 403 Forbidden means the private bucket EXISTS and is active!
            return "ACTIVE_AND_SECURED (HTTP 403 Forbidden - Bucket exists!)"
        elif e.code == 404:
            return "NOT_CREATED_YET (HTTP 404 - NoSuchBucket)"
        else:
            return f"HTTP_{e.code}"
    except Exception as e:
        return f"ERROR: {e}"


if __name__ == "__main__":
    status = check_bucket()
    print(f"Bucket: {BUCKET_NAME}")
    print(f"Region: {REGION}")
    print(f"URL   : {URL}")
    print(f"Status: {status}")
