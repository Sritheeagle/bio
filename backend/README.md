# BioCloud Workbench: Backend Architecture & API Service

The BioCloud Workbench backend is an enterprise-grade, cloud-native FastAPI microservice platform delivering dual computational pipelines for clinical electrophysiology (ECG) and computational biology (protein structure prediction).

It features pluggable architecture patterns enabling identical code to run seamlessly in **Local Development Mode** (SQLite, local disk, local async queue, local JWT) or **AWS Cloud Production Mode** (Amazon Aurora Serverless v2 PostgreSQL, S3 with SSE-KMS, SQS FIFO queues, Amazon Cognito JWKS, and AWS Batch EC2 GPU clusters).

---

## Architecture Diagram

```mermaid
graph TD
    Client([Web Client / External Consumer]) -->|REST API / Bearer JWT| Main[backend.app.main:app]

    subgraph "API Routing Layer (FastAPI v1)"
        Main --> AuthRouter[/api/v1/auth]
        Main --> ProjectRouter[/api/v1/projects]
        Main --> FileRouter[/api/v1/files]
        Main --> ECGRouter[/api/v1/ecg]
        Main --> ProteinRouter[/api/v1/protein]
        Main --> JobRouter[/api/v1/jobs]
        Main --> AdminRouter[/api/v1/admin]
        Main --> HealthRouter[/api/v1/health]
    end

    subgraph "Pluggable Adapters"
        StorageAdapter[StorageAdapter: LocalStorage / S3Storage]
        QueueAdapter[QueueAdapter: LocalQueue / SQSQueue]
        AuthAdapter[AuthAdapter: LocalAuth / CognitoAuth]
        BatchAdapter[BatchAdapter: LocalBatch / AWSBatch]
    end

    subgraph "Computational Processing Pipelines"
        ECGPipeline[ECG Processor: Butterworth 0.5-40Hz, Pan-Tompkins, Time/Freq HRV]
        ProteinPipeline[Protein Processor: IUPAC Validator, UniProt API, ESMFold / Fallback]
    end

    subgraph "Background Execution Workers"
        ECGWorker[ECG Worker Daemon]
        ProteinWorker[Protein Worker Daemon]
        SQSConsumer[SQS FIFO Consumer Worker]
    end

    subgraph "Persistence & Audit"
        DB[(Database: SQLite / Aurora PostgreSQL)]
        AuditLog[Tamper-Resistant Security Audit Trail]
    end

    ECGRouter --> ECGPipeline
    ProteinRouter --> ProteinPipeline
    ECGWorker --> ECGPipeline
    ProteinWorker --> ProteinPipeline
    SQSConsumer --> ECGPipeline
    SQSConsumer --> ProteinPipeline
    Main --> StorageAdapter
    Main --> QueueAdapter
    Main --> AuthAdapter
    Main --> BatchAdapter
    Main --> DB
    Main --> AuditLog
```

---

## Directory Structure

```text
backend/
├── alembic/                      # Database schema migration revisions
│   ├── env.py                    # Alembic execution environment
│   └── versions/                 # Versioned database migration scripts
├── alembic.ini                   # Alembic configuration
├── app/
│   ├── adapters/                 # Pluggable cloud abstraction layer
│   │   ├── auth/                 # Local JWT & Amazon Cognito RS256 JWKS
│   │   ├── batch/                # Local batch & AWS Batch GPU dispatch
│   │   ├── queue/                # Local async queue & AWS SQS FIFO adapter
│   │   └── storage/              # Local HMAC disk storage & AWS S3 SSE-KMS
│   ├── api/                      # REST API routing and dependencies
│   │   ├── deps.py               # Dependency injection (Auth, DB, Storage, Queue)
│   │   └── v1/                   # Versioned API routes
│   │       ├── admin.py          # User management, model toggle, audit logs
│   │       ├── auth.py           # Login, token refresh, user profile
│   │       ├── ecg.py            # ECG upload, synthetic generation, processing
│   │       ├── files.py          # Presigned upload/download ticket management
│   │       ├── health.py         # Liveness/readiness probes & dependency checks
│   │       ├── jobs.py           # Job status tracking, cancellation, and logs
│   │       ├── projects.py       # Multi-tenant research study project management
│   │       ├── protein.py        # IUPAC validation, UniProt lookup, folding jobs
│   │       └── storage.py        # Direct file download and ticket validation
│   ├── config.py                 # Pydantic v2 BaseSettings configuration
│   ├── database.py               # SQLAlchemy engine, session maker, DB connectivity
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── audit.py              # Security audit log table
│   │   ├── ecg.py                # ECG record metadata and analysis results
│   │   ├── job.py                # Asynchronous compute job state tracking
│   │   ├── project.py            # Research project entity
│   │   ├── protein.py            # Protein sequence metadata and PDB models
│   │   └── user.py               # User identity and role permissions
│   ├── pipelines/                # Core scientific and biomedical algorithms
│   │   ├── ecg/                  # Digital signal processing & arrhythmia rules
│   │   │   ├── plugins.py        # Arrhythmia rule plugins (Brady/Tachy/PVC)
│   │   │   ├── processor.py      # Butterworth, Pan-Tompkins, Welch HRV, 12-lead
│   │   │   ├── synthetic.py      # Synthetic 12-lead ECG generator
│   │   │   └── validator.py      # CSV/WFDB lead format validator
│   │   └── protein/              # Protein informatics & structure prediction
│   │       ├── esmfold.py        # ESMFold PyTorch GPU model & safe degradation
│   │       ├── references.py     # Verified structural benchmarks (1L2Y Trp-cage)
│   │       ├── uniprot.py        # UniProt REST API client & accession parser
│   │       └── validator.py      # FASTA format & strict IUPAC residue checker
│   ├── schemas/                  # Pydantic request/response schemas
│   ├── utils/                    # Common helpers, logging, security
│   ├── workers/                  # Background worker routines
│   │   ├── ecg_worker.py         # Dedicated ECG queue consumer worker
│   │   ├── protein_worker.py     # Dedicated protein queue consumer worker
│   │   └── sqs_consumer.py       # Amazon SQS FIFO consumer worker with DLQ routing
│   └── main.py                   # FastAPI application initialization & lifespan
├── requirements.txt              # Production Python package dependencies
└── tests/                        # Automated test suite (49 unit & integration tests)
```

---

## Dual Pipeline Scientific Foundations

### 1. Health Care: ECG Digital Signal Processing & HRV Analysis

Located in `backend/app/pipelines/ecg/processor.py`:

- **Bandpass Filtering**: 4th-order zero-phase Butterworth filter with a passband of **0.5 Hz – 40.0 Hz** (`scipy.signal.butter` + `filtfilt`), eliminating baseline wander (respiratory artifact) and high-frequency EMG muscle noise.
- **R-Peak Detection (Pan-Tompkins Algorithm)**:
  1. Derivative stage ($y[n] = \frac{1}{8}(2x[n] + x[n-1] - x[n-3] - 2x[n-4])$).
  2. Non-linear squaring ($y[n] = x^2[n]$) highlighting QRS complexes.
  3. Moving average integration window (150 ms window).
  4. Adaptive dual-threshold tracking for peak identification with refractory blanking (200 ms).
- **Time-Domain Heart Rate Variability (HRV)**:
  - **Mean Heart Rate**: Beats per minute ($60 / \overline{RR}$).
  - **Min / Max Heart Rate**: Physiological bounds.
  - **SDNN**: Standard deviation of all normal-to-normal RR intervals ($\sigma_{RR}$).
  - **RMSSD**: Root mean square of successive RR differences ($\sqrt{\frac{1}{N-1}\sum (RR_{i+1} - RR_i)^2}$).
  - **pNN50**: Percentage of adjacent RR intervals differing by $> 50\text{ ms}$.
- **Frequency-Domain HRV (Welch Periodogram)**:
  - **VLF Band**: $0.003\text{ Hz} - 0.04\text{ Hz}$ (long-term thermoregulatory / renin-angiotensin dynamics).
  - **LF Band**: $0.04\text{ Hz} - 0.15\text{ Hz}$ (sympathetic and parasympathetic mixed modulation).
  - **HF Band**: $0.15\text{ Hz} - 0.40\text{ Hz}$ (parasympathetic vagal tone and respiratory sinus arrhythmia).
  - **LF/HF Ratio**: Classical sympathetic-vagal autonomic balance index.
  - **Normalized Units (LFnu & HFnu)**: Normalized against $(\text{Total} - \text{VLF})$.
- **Signal Quality Index (SNR)**: In-band signal power divided by out-of-band noise power in decibels (dB).
- **12-Lead Multi-Lead Derivation**:
  - Direct 12-lead parsing or derivation of standard Einthoven limb leads ($I, II, III$), Goldberger augmented leads ($aVR, aVL, aVF$), and Wilson precordial leads ($V1-V6$).

---

### 2. Biology: Protein Structure Prediction & Validation

Located in `backend/app/pipelines/protein/`:

- **Strict IUPAC Validation (`validator.py`)**:
  - Enforces the 20 standard canonical amino acids: `A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, Y`.
  - Rejects ambiguous characters (`B, Z, X, J, U, O`) and numerical/punctuation pollution.
  - Calculates accurate molecular weight (Da), isoelectric points, and hydropathy scores.
- **Direct UniProt & PDB Integration (`uniprot.py`)**:
  - Instant live lookup by UniProt accession (e.g., `P01308`, `P04637`, `P68871`), gene symbol (`INS`, `TP53`, `HBB`), or PDB code (`1CRN`, `1UBQ`).
  - Fetches biological function annotations, organism taxonomy, sequence lengths, and canonical FASTA.
- **Scientific Integrity & Graceful Degradation (`esmfold.py`)**:
  - When real PyTorch ESMFold GPU weights are loaded, generates 3D atomic coordinates with per-residue pLDDT confidence scores.
  - **Strict Anti-Hallucination Policy**: If GPU weights are unconfigured, the pipeline **NEVER** fabricates or hallucinates fake 3D atomic coordinates. Instead, it transitions gracefully to `model_unavailable`, reporting detailed hardware requirements and documentation.
- **Verified Structural Benchmarks (`references.py`)**:
  - Provides pre-validated, experimentally determined structures for synthetic testing and validation:
    - **Trp-cage Fold (`1L2Y`)**: 20-residue benchmark (Mean pLDDT: 94.5, TM-Score: 0.91, 100% IUPAC valid).
    - **Insulin B-Chain (`1TRZ-B`)**: 30-residue benchmark.
    - **Crambin (`1CRN`)**: 46-residue plant defense benchmark.

---

## Pluggable Cloud Adapters

The backend abstracts all infrastructure primitives behind interfaces defined in `backend/app/adapters/`:

| Component | Interface | Local Dev Adapter (`LOCAL_DEV_MODE=true`) | AWS Production Adapter (`LOCAL_DEV_MODE=false`) |
| :--- | :--- | :--- | :--- |
| **Storage** | `StorageAdapter` | `LocalStorageAdapter`: Local disk with SHA-256 HMAC presigned upload/download tickets. | `S3StorageAdapter`: AWS S3 with Customer-Managed KMS Key (SSE-KMS) and presigned S3 URLs. |
| **Queue** | `QueueAdapter` | `LocalQueueAdapter`: In-memory `asyncio.Queue` with background task consumption. | `SQSQueueAdapter`: Amazon SQS FIFO queues with content-based deduplication and separate ECG/Protein queues. |
| **Authentication** | `AuthAdapter` | `LocalAuthAdapter`: HMAC-SHA256 JWT tokens with local bcrypt password hashing. | `CognitoAuthAdapter`: Amazon Cognito User Pool with RS256 JWKS public key verification. |
| **Batch Compute** | `BatchAdapter` | `LocalBatchAdapter`: Direct Python asynchronous process execution. | `AWSBatchAdapter`: AWS Batch GPU job submission (`g5.xlarge` EC2 compute environment). |

---

## REST API Specification

### Authentication & Users (`/api/v1/auth`)
- `POST /api/v1/auth/login`: Authenticate researcher or administrator with email & password. Returns JWT access token.
- `GET /api/v1/auth/me`: Retrieve currently authenticated user profile and roles.

### Projects & Studies (`/api/v1/projects`)
- `GET /api/v1/projects`: List active research study projects.
- `POST /api/v1/projects`: Create a new study project.
- `GET /api/v1/projects/{id}`: Retrieve project details, member access, and metadata.

### ECG Processing (`/api/v1/ecg`)
- `POST /api/v1/ecg/upload`: Upload raw ECG signal file (CSV/WFDB).
- `POST /api/v1/ecg/synthetic`: Generate synthetic 12-lead normal sinus rhythm or arrhythmic waveform.
- `POST /api/v1/ecg/process`: Dispatch asynchronous ECG filtering, Pan-Tompkins QRS detection, and HRV analysis.
- `GET /api/v1/ecg/{id}`: Retrieve filtered waveform samples, detected R-peaks, and autonomic metrics.

### Protein Prediction (`/api/v1/protein`)
- `POST /api/v1/protein/validate`: Validate amino acid sequence against strict IUPAC standard.
- `GET /api/v1/protein/lookup`: Fetch biological annotations by UniProt accession or gene symbol.
- `POST /api/v1/protein/predict`: Dispatch protein structure prediction job.
- `GET /api/v1/protein/{id}`: Retrieve predicted 3D structure, PDB file content, and per-residue pLDDT confidence.

### Asynchronous Jobs (`/api/v1/jobs`)
- `GET /api/v1/jobs`: List compute jobs with filtering by project, type, and status (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`).
- `GET /api/v1/jobs/{id}`: Retrieve real-time job execution status, progress percentage, and logs.
- `POST /api/v1/jobs/{id}/cancel`: Request cancellation of an active or queued job.

### System Administration (`/api/v1/admin`)
- `GET /api/v1/admin/users`: List registered users and roles (Admin only).
- `POST /api/v1/admin/users`: Provision a new user account (Admin only).
- `GET /api/v1/admin/models`: Inspect installed pipeline model versions.
- `POST /api/v1/admin/models/{id}/toggle`: Activate or deactivate pipeline models (Admin only).
- `GET /api/v1/admin/audit-logs`: Query tamper-resistant security audit trail (Admin only).

### Health & Liveness (`/api/v1/health`)
- `GET /api/v1/health`: Returns overall service health (`healthy`), database connectivity, storage status, and active mode (`local` vs. `aws`).

---

## Seed Accounts (Local Development)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Researcher** | `researcher@biocloud.local` | `Researcher123!` |
| **Administrator** | `admin@biocloud.local` | `AdminSecure2026!` |

---

## Local Development Setup

### 1. Environment & Dependencies

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # On Linux/macOS: source .venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 2. Run Database Migrations

```powershell
alembic upgrade head
```

### 3. Start API Server

```powershell
# Start FastAPI with auto-reload on port 8000
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

- API Base URL: `http://127.0.0.1:8000`
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc Documentation: `http://127.0.0.1:8000/redoc`

---

## Running the Automated Test Suite

BioCloud Workbench includes 49 comprehensive unit and integration tests covering security, authentication, DSP algorithms, IUPAC validation, S3 KMS ticket generation, and SQS consumer idempotency.

```powershell
# Run full backend test suite
python -m pytest backend/tests/ -v

# Run with coverage report
python -m pytest backend/tests/ --cov=backend/app --cov-report=term-missing
```

All tests execute against mock and local adapters with **zero cloud charges**.

---

## Offline AWS Cloud Emulation (Moto Server)

To validate AWS cloud adapters without incurring cloud charges, use the included local AWS emulator script:

```powershell
# 1. Start Moto emulator daemon on port 5000 (in separate terminal)
python -m moto.server -H 127.0.0.1 -p 5000

# 2. Provision emulated S3 bucket, KMS key, SQS FIFO queues, and Cognito user pool
python scripts/init_local_aws.py

# 3. Revert back to standard local mode when done
python scripts/init_local_aws.py --local
```

---

## Regulatory and Scientific Disclaimer

> [!WARNING]
> **RESEARCH USE ONLY (RUO)**:
> BioCloud Workbench is designed strictly as an investigative research tool and software demonstration platform. It has **NOT** been evaluated, cleared, or approved by the United States Food and Drug Administration (FDA), European Medicines Agency (EMA), or any other medical regulatory authority.
> 
> It is **NOT intended for use in the diagnosis, cure, mitigation, treatment, or prevention of disease** in humans or animals. Under no circumstances should algorithmic rhythm classifications or predicted protein coordinates be utilized as the basis for direct clinical decisions, patient triage, or prescribing therapy without independent physical validation.
