export type UserRole = "researcher" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  job_count: number;
  file_count: number;
}

export interface UploadedFile {
  id: string;
  project_id: string;
  user_id: string;
  workflow_type: "ecg" | "protein";
  original_name: string;
  file_size: number;
  content_type?: string;
  sha256_checksum?: string;
  is_validated: boolean;
  created_at: string;
}

export interface UploadTicketResponse {
  file_id: string;
  upload_url: string;
  storage_key: string;
  expires_in: number;
  headers?: Record<string, string>;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface ECGAnalysisResult {
  total_samples: number;
  duration_seconds: number;
  sampling_rate_hz: number;
  lead_name: string;
  signal_quality: string;
  snr_db: number;
  detected_beats_count: number;
  mean_hr_bpm: number;
  min_hr_bpm: number;
  max_hr_bpm: number;
  mean_rr_ms: number;
  sdnn_ms: number;
  rmssd_ms: number;
  pnn50_percent: number;
  arrhythmia_classification?: string;
  arrhythmia_details?: {
    plugin_name: string;
    plugin_version: string;
    classification: string;
    confidence: string;
    description: string;
    regulatory_status: string;
  };
  available_channels?: string[];
  r_peaks: number[];
  r_peak_times: number[];
  waveform_preview: Array<{ t: number; val: number }>;
  lead_previews?: Record<string, Array<{ t: number; val: number }>>;
  available_leads?: string[];
  frequency_hrv?: {
    vlf_power_ms2: number;
    lf_power_ms2: number;
    hf_power_ms2: number;
    total_power_ms2: number;
    lf_hf_ratio: number;
    lf_nu: number;
    hf_nu: number;
    autonomic_balance: string;
    psd_curve: Array<{ f: number; psd: number }>;
  };
  lf_power_ms2?: number;
  hf_power_ms2?: number;
  lf_hf_ratio?: number;
  autonomic_balance?: string;
  research_disclaimer: string;
}

export interface ProteinPredictionResult {
  header: string;
  sequence_length: number;
  molecular_weight_kda: number;
  model_name: string;
  model_version: string;
  execution_device: string;
  mean_plddt?: number;
  ptm_score?: number;
  per_residue_plddt?: number[];
  secondary_structure_summary?: Record<string, number>;
  pdb_content?: string;
  is_reference_benchmark: boolean;
  model_status: "completed" | "model_unavailable" | "failed";
  setup_instructions?: string;
  research_disclaimer: string;
}

export interface Job {
  id: string;
  project_id: string;
  user_id: string;
  workflow_type: "ecg" | "protein";
  name: string;
  status: JobStatus;
  progress: number;
  stage: string;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  input_file_id?: string;
  parameters?: Record<string, any>;
  result?: ECGAnalysisResult | ProteinPredictionResult | any;
  provenance?: Record<string, any>;
  output_storage_key?: string;
  output_filename?: string;
}

export interface SyntheticPattern {
  id: string;
  name: string;
  heart_rate_bpm: number;
  duration_s: number;
  sampling_rate_hz: number;
  description: string;
  label: string;
}

export interface ProteinBenchmark {
  id: string;
  name: string;
  header: string;
  sequence: string;
  sequence_length: number;
  organism: string;
  mean_plddt: number;
  ptm: number;
  label: string;
}

export interface ModelVersion {
  id: string;
  workflow_type: string;
  name: string;
  version: string;
  status: string;
  description?: string;
  is_enabled: boolean;
  runtime_availability?: boolean;
  runtime_status?: string;
  runtime_details?: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  user_id?: string;
  user_email?: string;
  event_type: string;
  target_type?: string;
  target_id?: string;
  details_json?: string;
  ip_address?: string;
  created_at: string;
}

export interface HealthInfo {
  status: string;
  service: string;
  version: string;
  environment: string;
  local_dev_mode: boolean;
  aws_connected?: boolean;
  aws_emulator_mode?: boolean;
  config_valid?: boolean;
  config_errors?: string[];
  auth_provider?: string;
  storage: {
    type: string;
    bucket: string;
    region?: string | null;
    kms_encrypted?: boolean;
  };
  queue: {
    type: string;
    ecg_queue_configured?: boolean;
    protein_queue_configured?: boolean;
    batch_configured?: boolean;
  };
  database?: {
    engine: string;
  };
  workers: {
    ecg_dsp_worker: string;
    protein_structure_worker: string;
    esmfold_runtime: string;
  };
}

