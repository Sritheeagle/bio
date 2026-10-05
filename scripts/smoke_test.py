#!/usr/bin/env python3
"""
BioCloud Workbench - Automated Multi-Tier Smoke Test
Validates all running layers in a single pass:
  1. Frontend Web Server (port 3000)
  2. Backend REST API & Health Probes (port 8000)
  3. API Documentation (Swagger /docs)
  4. Relational Database Reachability & Table Integrity
  5. Authentication & JWT Validation
  6. ECG DSP Engine & Synthetic Pattern Catalogue
  7. Protein Structure Benchmark Engine
  8. Offline AWS Cloud Emulator (port 5000, if active)
"""

import sys
import json
import socket
import urllib.request
import urllib.error
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://127.0.0.1:8000/api/v1"
BACKEND_DOCS = "http://127.0.0.1:8000/docs"
MOTO_URL = "http://127.0.0.1:5000"


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def check_port(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False


def get_json(url: str, headers: dict = None, timeout: float = 3.0):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def post_json(url: str, payload: dict, headers: dict = None, timeout: float = 3.0):
    data = json.dumps(payload).encode("utf-8")
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def run_smoke_tests() -> int:
    print(f"\n{Colors.BOLD}{Colors.BLUE}=======================================================")
    print(f"  BioCloud Workbench — Automated Smoke Test Suite")
    print(f"======================================================={Colors.RESET}\n")

    passed = 0
    failed = 0
    notices = 0

    # 1. Frontend Web Server
    print("[*] 1. Checking Frontend Web Application...")
    if check_port("localhost", 3000):
        try:
            req = urllib.request.Request(FRONTEND_URL)
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    print(f"    {Colors.GREEN}[PASS] Frontend is responding (HTTP 200) at {FRONTEND_URL}{Colors.RESET}")
                    passed += 1
                else:
                    print(f"    {Colors.RED}[FAIL] Frontend returned unexpected status {resp.status}{Colors.RESET}")
                    failed += 1
        except Exception as e:
            print(f"    {Colors.RED}[FAIL] Frontend request failed: {e}{Colors.RESET}")
            failed += 1
    else:
        print(f"    {Colors.RED}[FAIL] Port 3000 is closed (Frontend server not running).{Colors.RESET}")
        failed += 1

    # 2. Backend Health Endpoint
    print("\n[*] 2. Checking Backend REST API Health...")
    if check_port("127.0.0.1", 8000):
        try:
            status_code, health = get_json(f"{BACKEND_URL}/health")
            if status_code == 200 and health.get("status") == "healthy":
                print(f"    {Colors.GREEN}[PASS] Backend API is healthy (v{health.get('version')}, {health.get('service')}){Colors.RESET}")
                print(f"           Mode: {'Local Dev' if health.get('local_dev_mode') else 'Production Cloud'}, Database: {health.get('database', {}).get('engine')}")
                passed += 1
            else:
                print(f"    {Colors.RED}[FAIL] Backend health reported degraded state: {health}{Colors.RESET}")
                failed += 1
        except Exception as e:
            print(f"    {Colors.RED}[FAIL] Backend health probe failed: {e}{Colors.RESET}")
            failed += 1
    else:
        print(f"    {Colors.RED}[FAIL] Port 8000 is closed (Backend API server not running).{Colors.RESET}")
        failed += 1

    # 3. Swagger Documentation
    print("\n[*] 3. Checking API Documentation...")
    try:
        req = urllib.request.Request(BACKEND_DOCS)
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                print(f"    {Colors.GREEN}[PASS] Swagger UI docs accessible at {BACKEND_DOCS}{Colors.RESET}")
                passed += 1
            else:
                print(f"    {Colors.RED}[FAIL] Swagger docs returned status {resp.status}{Colors.RESET}")
                failed += 1
    except Exception as e:
        print(f"    {Colors.RED}[FAIL] Swagger docs check failed: {e}{Colors.RESET}")
        failed += 1

    # 4. Database Reachability & Table Integrity
    print("\n[*] 4. Checking Database Connectivity & Schema...")
    try:
        from backend.app.database import engine
        from sqlalchemy import text, inspect

        with engine.connect() as conn:
            one = conn.execute(text("SELECT 1")).scalar()
            if one == 1:
                inspector = inspect(engine)
                tables = inspector.get_table_names()
                print(f"    {Colors.GREEN}[PASS] Database connection verified ({engine.dialect.name}). Found {len(tables)} tables.{Colors.RESET}")
                passed += 1
            else:
                print(f"    {Colors.RED}[FAIL] SELECT 1 query did not return 1.{Colors.RESET}")
                failed += 1
    except Exception as e:
        print(f"    {Colors.RED}[FAIL] Database connection test failed: {e}{Colors.RESET}")
        failed += 1

    # 5. Authentication & JWT Validation
    print("\n[*] 5. Checking Authentication & User Access...")
    token = None
    try:
        status_code, auth_resp = post_json(
            f"{BACKEND_URL}/auth/login",
            {"email": "researcher@biocloud.local", "password": "Researcher123!"},
        )
        token = auth_resp.get("access_token")
        if status_code == 200 and token:
            print(f"    {Colors.GREEN}[PASS] JWT login succeeded for default researcher account.{Colors.RESET}")
            passed += 1
        else:
            print(f"    {Colors.RED}[FAIL] Login failed: {auth_resp}{Colors.RESET}")
            failed += 1
    except Exception as e:
        print(f"    {Colors.RED}[FAIL] Authentication test error: {e}{Colors.RESET}")
        failed += 1

    # 6. Projects Listing with Token
    if token:
        try:
            status_code, projects = get_json(f"{BACKEND_URL}/projects", headers={"Authorization": f"Bearer {token}"})
            if status_code == 200 and isinstance(projects, list):
                print(f"    {Colors.GREEN}[PASS] Authenticated request to /projects verified ({len(projects)} accessible projects).{Colors.RESET}")
                passed += 1
            else:
                print(f"    {Colors.RED}[FAIL] Projects endpoint returned error: {projects}{Colors.RESET}")
                failed += 1
        except Exception as e:
            print(f"    {Colors.RED}[FAIL] Projects request failed: {e}{Colors.RESET}")
            failed += 1

    # 7. ECG Pipeline Catalogue
    print("\n[*] 6. Checking ECG DSP Pipeline...")
    try:
        status_code, patterns = get_json(f"{BACKEND_URL}/ecg/synthetic-patterns")
        if status_code == 200 and len(patterns) >= 4:
            print(f"    {Colors.GREEN}[PASS] ECG synthetic pattern library loaded ({len(patterns)} patterns available).{Colors.RESET}")
            passed += 1
        else:
            print(f"    {Colors.RED}[FAIL] ECG pattern catalogue failed or incomplete: {patterns}{Colors.RESET}")
            failed += 1
    except Exception as e:
        print(f"    {Colors.RED}[FAIL] ECG endpoint error: {e}{Colors.RESET}")
        failed += 1

    # 8. Protein Pipeline Benchmarks
    print("\n[*] 7. Checking Protein Structural Engine...")
    try:
        status_code, benchmarks = get_json(f"{BACKEND_URL}/protein/benchmarks")
        if status_code == 200 and len(benchmarks) >= 2:
            print(f"    {Colors.GREEN}[PASS] Protein reference benchmarks verified ({len(benchmarks)} benchmarks available).{Colors.RESET}")
            passed += 1
        else:
            print(f"    {Colors.RED}[FAIL] Protein benchmark catalogue failed: {benchmarks}{Colors.RESET}")
            failed += 1
    except Exception as e:
        print(f"    {Colors.RED}[FAIL] Protein benchmark endpoint error: {e}{Colors.RESET}")
        failed += 1

    # 9. Offline AWS Emulator (Optional / Informational)
    print("\n[*] 8. Checking Offline AWS Cloud Emulator (moto)...")
    if check_port("127.0.0.1", 5000):
        print(f"    {Colors.GREEN}[INFO] Local AWS Emulator (moto) is ACTIVE on port 5000.{Colors.RESET}")
        passed += 1
    else:
        print(f"    {Colors.YELLOW}[NOTICE] Local AWS Emulator (port 5000) is idle/offline (optional for local dev).{Colors.RESET}")
        notices += 1

    # Final Summary
    print(f"\n{Colors.BOLD}=======================================================")
    print(f"  Smoke Test Results: {Colors.GREEN}{passed} Passed{Colors.RESET}, {Colors.RED}{failed} Failed{Colors.RESET}, {Colors.YELLOW}{notices} Notices{Colors.RESET}")
    print(f"======================================================={Colors.RESET}\n")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_smoke_tests())
