# BioCloud Workbench: Frontend Web Application

The BioCloud Workbench frontend is an enterprise research user interface engineered with **Next.js 16 (React 19)**, **Tailwind CSS 4**, and **TypeScript**. It provides high-performance interactive visualizers for clinical 12-lead electrocardiography (ECG) and computational molecular biology (3D protein structure prediction).

---

## Key Features & Visual Capabilities

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BioCloud Workbench                              │
├─────────────┬───────────────────────────────────────────────────────────────┤
│             │  [ Overview Dashboard ]                                       │
│  Navigation │  • KPI Summary: Total ECGs, Proteins, Active Jobs, Latency    │
│  ────────── │  • Active Study Project Context Card                          │
│  Overview   │  • Real-time Compute Pipeline Queue Table                     │
│  ECG Lab    ├───────────────────────────────────────────────────────────────┤
│  Protein Lab│  [ 12-Lead Clinical ECG Lab ]                                 │
│  Jobs       │  • Standard 3x4 Clinical Layout + Continuous Lead II Strip    │
│  Settings   │  • Medical Grid: 1 mm / 5 mm, 1.0 mV Square Calibration Pulse │
│  Admin      │  • Pan-Tompkins R-Peak Detection Markers                      │
│             │  • Interactive Pan / Zoom / Crosshair Millivolt Tooltips      │
│             │  • Aesthetics: Classic Pink ECG Paper vs. Dark Monitor Mode   │
│             │  • Autonomic HRV: Time-Domain (SDNN/RMSSD) + Welch (LF/HF)    │
│             ├───────────────────────────────────────────────────────────────┤
│             │  [ 3D Molecular Protein Lab ]                                 │
│             │  • Strict IUPAC Sequence Validation with Instant Feedback     │
│             │  • Live UniProt / PDB Accession Lookup (P01308, P04637, etc.) │
│             │  • 3D Ribbon Molecular Viewer with Mouse Orbit & Auto-Spin    │
│             │  • Per-Residue pLDDT Confidence Color Spectrum (>90, 70, 50)  │
│             ├───────────────────────────────────────────────────────────────┤
│             │  [ Administration & Audit Trails ]                            │
│             │  • Role-Based Access Control (Researcher vs. Administrator)   │
│             │  • Pipeline Model Activation Toggles                          │
│             │  • Tamper-Resistant Security Audit Log Viewer                 │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```text
frontend/src/
├── app/
│   ├── globals.css               # Tailwind CSS 4 theme and medical grid styles
│   ├── layout.tsx                # Root layout, HTML headers, font configuration
│   └── page.tsx                  # Main client-side single page app orchestrator
├── components/
│   ├── admin/
│   │   └── AdminSection.tsx      # User management, model toggles, audit logs
│   ├── auth/
│   │   └── AuthModal.tsx         # Sign-in dialog with quick-login seed chips
│   ├── dashboard/
│   │   └── OverviewDashboard.tsx # Metric cards, recent jobs, and launch actions
│   ├── ecg/
│   │   ├── ECGSection.tsx        # ECG signal submission, synthetic, results
│   │   └── ECGWaveformChart.tsx  # High-performance 12-lead medical grid viewer
│   ├── jobs/
│   │   └── JobsTable.tsx         # Real-time job status table & detail modal
│   ├── layout/
│   │   ├── Header.tsx            # App bar, project selector, user badge
│   │   └── Sidebar.tsx           # Primary navigation rail
│   ├── projects/
│   │   └── ProjectsModal.tsx     # Study project switcher & creation dialog
│   ├── protein/
│   │   ├── MolecularViewer.tsx   # WebGL-style 3D molecular ribbon visualizer
│   │   └── ProteinSection.tsx    # FASTA input, UniProt lookup, prediction jobs
│   └── settings/
│       └── SettingsSection.tsx   # System config inspector and seed accounts
├── lib/
│   └── api.ts                    # Centralized REST API client with Bearer auth
└── types/
    └── index.ts                  # Shared TypeScript interfaces and enums
```

---

## Detailed Component Specifications

### 1. 12-Lead ECG Visualizer (`ECGWaveformChart.tsx`)
- **12-Lead Clinical Grid**: Standard 3x4 clinical layout:
  - Column 1: Leads `I`, `aVR`, `V1`, `V4`
  - Column 2: Leads `II`, `aVL`, `V2`, `V5`
  - Column 3: Leads `III`, `aVF`, `V3`, `V6`
  - Bottom strip: Continuous 10-second Lead `II` rhythm strip.
- **Single-Lead Focused View**: Focus on any individual lead with high-resolution inspection.
- **Medical Calibration**: 1.0 mV square calibration pulse at 25 mm/s and 10 mm/mV standard scaling.
- **Interactive Controls**: Drag to pan across time, mouse wheel to zoom, and precision crosshairs displaying exact milliseconds (ms) and millivolts (mV).
- **Aesthetic Modes**:
  - *Classic Pink ECG Paper*: Standard medical millimeter graph paper.
  - *Dark Modern Monitor*: Sleek high-contrast cardiac ICU telemetry aesthetic.

### 2. 3D Molecular Structure Visualizer (`MolecularViewer.tsx`)
- **Interactive 3D Orbiting**: Mouse click-and-drag rotation, scroll zoom, and optional auto-spin toggle.
- **pLDDT Confidence Color Scheme**:
  - <span style="color:#0053D6; font-weight:bold;">Very High Confidence (>90)</span>: Dark Blue
  - <span style="color:#64C6EB; font-weight:bold;">Confident (70–90)</span>: Cyan / Light Blue
  - <span style="color:#FED634; font-weight:bold;">Low Confidence (50–70)</span>: Yellow
  - <span style="color:#FF7D45; font-weight:bold;">Very Low Confidence (<50)</span>: Orange / Red
- **PDB Structure Export**: Direct download button to export `.pdb` coordinate files for external visualization in PyMOL, ChimeraX, or VMD.

### 3. Protein Sequence Lab (`ProteinSection.tsx`)
- **IUPAC Validation**: Real-time sequence validator verifying standard 20 amino acids and calculating molecular weight (Da).
- **Direct UniProt & PDB Search**: Enter any UniProt accession (e.g. `P01308` Insulin, `P04637` p53, `P68871` Hemoglobin) or gene symbol (`INS`, `TP53`, `KRAS`) to automatically populate FASTA sequences and metadata.
- **Verified Benchmark Testing**: Quick-fill buttons for scientifically validated structures:
  - Trp-cage fold (`1L2Y` - 20 aa)
  - Insulin B-chain (`1TRZ-B` - 30 aa)
  - Crambin (`1CRN` - 46 aa)

### 4. Jobs & Real-Time Monitoring (`JobsTable.tsx`)
- Auto-polling state machine (`QUEUED` ➔ `PROCESSING` ➔ `COMPLETED` / `FAILED`).
- Job inspection modal displaying processing durations, algorithmic outputs, and raw worker execution logs.
- Export results as JSON or CSV.

---

## Seed Accounts (Quick-Login)

The application provides quick-login chips on the authentication dialog for local development:

| Role | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- |
| **Researcher** | `researcher@biocloud.local` | `Researcher123!` | Standard project creation, file upload, job dispatch, results analysis |
| **Administrator** | `admin@biocloud.local` | `AdminSecure2026!` | User management, pipeline model version toggle, security audit logs |

---

## Local Development Setup

### 1. Prerequisites
- Node.js 18.0.0 or higher (Node.js 20+ recommended)
- Fast-running BioCloud Backend API on port 8000 (`http://127.0.0.1:8000`)

### 2. Install Dependencies

```powershell
cd frontend
npm install
```

### 3. Environment Configuration

Create or update `.env.local` inside the `frontend/` directory:

```ini
# Backend API Base URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Start Development Server

```powershell
npm run dev
```

Open `http://localhost:3000` in your web browser.

### 5. Production Build & Execution

To test the optimized production bundle:

```powershell
# Build production bundle
npm run build

# Start production server on port 3000
npm run start
```

---

## REST API Client Architecture

All network requests flow through `src/lib/api.ts`:
- **Bearer Token Injection**: Automatically attaches `Authorization: Bearer <token>` to all authenticated endpoints.
- **Automatic Token Storage**: Stores session tokens securely in browser `localStorage`.
- **Response Validation**: Normalizes API responses and provides typed errors.

---

## Regulatory and Scientific Disclaimer

> [!WARNING]
> **RESEARCH USE ONLY (RUO)**:
> BioCloud Workbench is designed strictly as an investigative research tool and software demonstration platform. It has **NOT** been evaluated, cleared, or approved by the United States Food and Drug Administration (FDA), European Medicines Agency (EMA), or any other medical regulatory authority.
> 
> It is **NOT intended for use in the diagnosis, cure, mitigation, treatment, or prevention of disease** in humans or animals. Under no circumstances should algorithmic rhythm classifications or predicted protein coordinates be utilized as the basis for direct clinical decisions, patient triage, or prescribing therapy without independent physical validation.
