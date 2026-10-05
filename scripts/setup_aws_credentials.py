#!/usr/bin/env python3
"""
Safely configure AWS credentials in ~/.aws/credentials without leaking secrets.
"""

import os
import sys
import getpass
from pathlib import Path

def main():
    print("=" * 60)
    print("  BioCloud Workbench - Secure AWS Credentials Setup")
    print("=" * 60)
    print("\nThis script safely configures your AWS credentials in ~/.aws/credentials.")
    print("Your secret key input will be hidden as you type.\n")

    aws_dir = Path.home() / ".aws"
    aws_dir.mkdir(parents=True, exist_ok=True)
    cred_file = aws_dir / "credentials"
    config_file = aws_dir / "config"

    try:
        key_id = input("1. Enter AWS Access Key ID (e.g. AKIA...): ").strip()
        if not key_id:
            print("[ERROR] Access Key ID cannot be empty.")
            sys.exit(1)

        secret_key = getpass.getpass("2. Enter AWS Secret Access Key (typing is hidden): ").strip()
        if not secret_key:
            print("[ERROR] Secret Access Key cannot be empty.")
            sys.exit(1)

        region = input("3. Enter AWS Region [default: eu-north-1]: ").strip() or "eu-north-1"

        with open(cred_file, "w", encoding="utf-8") as f:
            f.write(f"[default]\naws_access_key_id = {key_id}\naws_secret_access_key = {secret_key}\n")

        with open(config_file, "w", encoding="utf-8") as f:
            f.write(f"[default]\nregion = {region}\noutput = json\n")

        # Set restrictive permissions where possible
        try:
            os.chmod(cred_file, 0o600)
            os.chmod(config_file, 0o600)
        except Exception:
            pass

        print("\n[SUCCESS] AWS credentials saved securely to ~/.aws/credentials!")
        print(f"Target Region: {region}")
        print("Ready for automated deployment: python scripts/deploy_cfn_stack.py\n")

    except KeyboardInterrupt:
        print("\n[CANCELLED] Setup cancelled by user.")
        sys.exit(1)

if __name__ == "__main__":
    main()
