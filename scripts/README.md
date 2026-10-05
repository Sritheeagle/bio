# BioCloud Workbench: Automation & Verification Scripts

This directory contains developer utilities and automation scripts for local cloud emulation, database diagnostics, and automated end-to-end smoke testing.

---

## Script Index

| Script | Purpose | Execution Command |
| :--- | :--- | :--- |
| **`smoke_test.py`** | Automated 9-tier system health and pipeline verification suite | `python scripts/smoke_test.py` |
| **`init_local_aws.py`** | Provisions offline AWS resources on Moto server (port 5000) with zero cloud charges | `python scripts/init_local_aws.py` |
| **`benchmark_simulation.py`** | Multi-threaded performance benchmarking for API, DSP, and protein engines | `python scripts/benchmark_simulation.py` |
| **`aws_create_push.py`** | Turnkey CLI to build, tag, and push containers to Amazon ECR in `eu-north-1` | `python scripts/aws_create_push.py` |
| **`push_to_ecr.ps1`** | Native PowerShell script to build and push container images to ECR | `powershell scripts/push_to_ecr.ps1` |

---

## 1. Automated Smoke Test (`smoke_test.py`)

Validates the end-to-end runtime health of the BioCloud Workbench platform across 9 key checkpoints:

```powershell
python scripts/smoke_test.py
```

### Checkpoints Executed:
1. **Frontend Web Application**: Queries `http://localhost:3000` to confirm Next.js 16 is serving HTTP 200.
2. **Backend REST API Health**: Queries `http://127.0.0.1:8000/api/v1/health` to verify `status == "healthy"` and active mode.
3. **OpenAPI / Swagger Documentation**: Confirms `/docs` endpoint is accessible.
4. **Database Connectivity & Schema**: Verifies SQLite connection and confirms all 8 core tables exist (`users`, `projects`, `project_members`, `ecg_records`, `ecg_features`, `protein_structures`, `jobs`, `audit_logs`).
5. **Authentication & User Access**: Executes automated JWT login for `researcher@biocloud.local` and validates access to `/api/v1/projects`.
6. **ECG DSP Pipeline**: Loads synthetic ECG generator patterns (Normal Sinus Rhythm, Bradycardia, Tachycardia, Arrhythmia) and verifies DSP modules.
7. **Protein Structural Engine**: Verifies verified structural benchmarks (`1L2Y` Trp-cage fold, `1TRZ-B` Insulin B-chain).
8. **Offline AWS Cloud Emulator**: Checks if Moto server is listening on port 5000 and reports emulation status.
9. **Final Summary**: Tallies passes, failures, and notices with color-coded console output.

---

## 2. Offline AWS Cloud Emulator (`init_local_aws.py`)

Provisions local offline AWS services using `moto.server` or `LocalStack` on `http://127.0.0.1:5000`. This enables verifying cloud-mode adapters (`LOCAL_DEV_MODE=false`) with **zero AWS charges**.

### Prerequisites:
Start the Moto server daemon in a separate terminal:
```powershell
python -m moto.server -H 127.0.0.1 -p 5000
```

### Provisioning Emulated AWS Resources:
```powershell
# Provision S3 bucket, KMS key, SQS FIFO queues, and Cognito user pool:
python scripts/init_local_aws.py
```

### Options & Flags:
- `--local`: Reverts environment configuration back to default local development mode (`LOCAL_DEV_MODE=true`, SQLite, local storage, local queues).
- `--endpoint URL`: Specifies custom emulation endpoint (default: `http://127.0.0.1:5000`).
- `--region REGION`: Sets emulated AWS region (default: `us-east-1`).
- `--db-url URL`: Overrides database URL and performs a pre-flight TCP reachability check before writing to `.env`.

### Resources Provisioned Locally:
- **AWS KMS**: Key ID `12345678-1234-1234-1234-123456789012` with alias `alias/biocloud-key`.
- **Amazon S3**: Bucket `biocloud-local-bucket` with SSE-KMS default encryption.
- **Amazon SQS FIFO**:
  - `biocloud-ecg-queue.fifo` + DLQ (`biocloud-ecg-dlq.fifo`)
  - `biocloud-protein-queue.fifo` + DLQ (`biocloud-protein-dlq.fifo`)
- **Amazon Cognito**: User Pool `us-east-1_localpool` with App Client ID `local-client-id`.
- **AWS Batch**: Compute Environment `biocloud-batch-env` and Job Queue `biocloud-protein-queue`.

---

## 3. Performance & Load Benchmark Suite (`benchmark_simulation.py`)

Executes automated load testing and latency benchmarks across the API gateway, signal processing, and biological sequence engines:

```powershell
python scripts/benchmark_simulation.py
```

### Metrics Evaluated:
1. **REST API Gateway**: Measures throughput (req/sec), mean, median ($p_{50}$), $p_{95}$, and $p_{99}$ latency across 100 requests with 10 concurrent threads.
2. **ECG DSP Pipeline**: Benchmarks 50 trials of 10-second 12-lead ECG signals (125,000 samples) processed via Butterworth filtering, Pan-Tompkins QRS detection, and Welch periodogram spectral HRV.
3. **Protein Validation Engine**: Benchmarks IUPAC verification, stoichiometric composition, and molecular weight calculation across 500 variable-length polypeptides.
4. **Concurrent Job Dispatch**: Dispatches 20 compute jobs with 5 concurrent threads, measuring database persistence, JWT authorization, and queue ticket throughput.
5. **Output**: Exports raw structured results to [`data/benchmark_results.json`](file:///c:/Users/rajub/Documents/Codex/2026-09-28/onc/outputs/biocloud-workbench/data/benchmark_results.json).
