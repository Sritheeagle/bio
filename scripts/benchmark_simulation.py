"""
BioCloud Workbench - Performance Benchmarking & Load Simulation Suite

Executes automated load testing and latency benchmarks across:
1. REST API Throughput & Latency (RPS, p50, p95, p99)
2. ECG DSP Pipeline Throughput (Samples/sec, Butterworth, Pan-Tompkins, Welch Periodogram)
3. Protein Pipeline Validation Throughput (Sequences/sec, IUPAC, MW calculation)
4. Concurrent Asynchronous Job Queueing and State Transition Stress Testing
"""

import sys
import time
import json
import statistics
import concurrent.futures
from pathlib import Path
from typing import List, Dict, Any

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

try:
    import requests
except ImportError:
    print("[ERROR] requests library is required. Run: pip install requests")
    sys.exit(1)

BASE_URL = "http://127.0.0.1:8000"
API_V1 = f"{BASE_URL}/api/v1"


class BenchmarkRunner:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        self.token = None
        self.session = requests.Session()
        self.project_id = None
        self.results = {}

    def authenticate(self) -> bool:
        """Authenticate with default researcher credentials and get active project."""
        try:
            resp = self.session.post(
                f"{self.api_url}/auth/login",
                json={"email": "researcher@biocloud.local", "password": "Researcher123!"},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("access_token")
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})

                # Fetch available projects
                proj_resp = self.session.get(f"{self.api_url}/projects", timeout=5)
                if proj_resp.status_code == 200:
                    projects = proj_resp.json()
                    if projects:
                        self.project_id = projects[0]["id"]
                return True
            return False
        except Exception as e:
            print(f"[ERROR] Authentication failed: {e}")
            return False

    def benchmark_health_api(self, num_requests: int = 100, concurrency: int = 10) -> Dict[str, Any]:
        """Benchmark lightweight health probe endpoint."""
        latencies = []
        errors = 0

        def single_request():
            t0 = time.perf_counter()
            try:
                r = requests.get(f"{self.api_url}/health", timeout=3)
                dt = (time.perf_counter() - t0) * 1000.0
                return (r.status_code == 200, dt)
            except Exception:
                return (False, 0.0)

        t_start = time.perf_counter()
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(single_request) for _ in range(num_requests)]
            for f in concurrent.futures.as_completed(futures):
                success, latency = f.result()
                if success:
                    latencies.append(latency)
                else:
                    errors += 1
        total_time = time.perf_counter() - t_start

        latencies.sort()
        n = len(latencies)
        p50 = statistics.median(latencies) if n else 0.0
        p95 = latencies[int(n * 0.95)] if n else 0.0
        p99 = latencies[int(n * 0.99)] if n else 0.0
        mean = statistics.mean(latencies) if n else 0.0
        rps = num_requests / total_time if total_time > 0 else 0.0

        return {
            "name": "REST API Health Probe (/api/v1/health)",
            "num_requests": num_requests,
            "concurrency": concurrency,
            "total_time_sec": round(total_time, 3),
            "throughput_rps": round(rps, 1),
            "errors": errors,
            "success_rate_pct": round((num_requests - errors) / num_requests * 100.0, 1),
            "mean_ms": round(mean, 2),
            "p50_ms": round(p50, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "min_ms": round(min(latencies) if latencies else 0.0, 2),
            "max_ms": round(max(latencies) if latencies else 0.0, 2),
        }

    def benchmark_ecg_dsp_pipeline(self, num_trials: int = 50) -> Dict[str, Any]:
        """Benchmark synthetic ECG generation, parsing, and signal processing."""
        from backend.app.pipelines.ecg.synthetic import generate_synthetic_ecg
        from backend.app.pipelines.ecg.validator import validate_and_parse_ecg
        from backend.app.pipelines.ecg.processor import process_ecg_signal
        import numpy as np

        trial_times = []
        samples_processed = []
        r_peaks_detected = []

        for i in range(num_trials):
            # Generate 10 seconds of 12-lead ECG at 250 Hz (2,500 samples per lead, 30,000 data points total)
            csv_str = generate_synthetic_ecg(
                pattern="normal_sinus",
                duration_sec=10.0,
                fs=250.0,
                multi_lead=True,
                seed=42 + i
            )
            raw_bytes = csv_str.encode("utf-8")

            t0 = time.perf_counter()
            # 1. Parse CSV
            sig, fs, ch_name, avail_ch, all_channels = validate_and_parse_ecg(
                raw_bytes, preferred_channel="II", return_all_channels=True
            )
            # 2. Process DSP (Butterworth, Pan-Tompkins, Welch periodogram, 12-lead derivations)
            results = process_ecg_signal(
                raw_signal=sig,
                fs=fs,
                lead_name=ch_name,
                all_channels=all_channels
            )
            dt = (time.perf_counter() - t0) * 1000.0
            
            trial_times.append(dt)
            samples_processed.append(len(sig))
            r_peaks_detected.append(results["detected_beats_count"])

        total_samples = sum(samples_processed)
        total_time_sec = sum(trial_times) / 1000.0
        samples_per_sec = total_samples / total_time_sec if total_time_sec > 0 else 0.0

        trial_times.sort()
        n = len(trial_times)

        return {
            "name": "ECG Ingestion & DSP (CSV Parse + Butterworth + Pan-Tompkins + Welch HRV)",
            "num_trials": num_trials,
            "duration_per_trial_sec": 10.0,
            "sampling_rate_hz": 250.0,
            "total_samples_processed": total_samples,
            "total_time_sec": round(total_time_sec, 3),
            "throughput_samples_per_sec": round(samples_per_sec, 1),
            "throughput_seconds_of_ecg_per_sec": round(samples_per_sec / 250.0, 1),
            "mean_execution_ms": round(statistics.mean(trial_times), 2),
            "p50_ms": round(statistics.median(trial_times), 2),
            "p95_ms": round(trial_times[int(n * 0.95)], 2),
            "p99_ms": round(trial_times[int(n * 0.99)], 2),
            "min_ms": round(min(trial_times), 2),
            "max_ms": round(max(trial_times), 2),
            "avg_r_peaks_found": round(statistics.mean(r_peaks_detected), 1),
        }

    def benchmark_protein_validation(self, num_sequences: int = 500) -> Dict[str, Any]:
        """Benchmark IUPAC validation and physicochemical property calculations."""
        from backend.app.pipelines.protein.validator import parse_and_validate_fasta
        import random

        amino_acids = "ACDEFGHIKLMNPQRSTVWY"
        
        # Pre-generate varying-length protein sequences (50 to 500 aa)
        test_sequences = [
            "".join(random.choices(amino_acids, k=random.randint(50, 500)))
            for _ in range(num_sequences)
        ]

        t0 = time.perf_counter()
        latencies = []
        valid_count = 0
        total_residues = 0

        for i, seq in enumerate(test_sequences):
            t_single = time.perf_counter()
            try:
                fasta_str = f">test_seq_{i}\n{seq}"
                clean_seq, header, meta = parse_and_validate_fasta(fasta_str)
                valid_count += 1
                total_residues += len(clean_seq)
            except Exception:
                pass
            dt = (time.perf_counter() - t_single) * 1000.0
            latencies.append(dt)

        total_time_sec = time.perf_counter() - t0
        seq_per_sec = num_sequences / total_time_sec if total_time_sec > 0 else 0.0
        residues_per_sec = total_residues / total_time_sec if total_time_sec > 0 else 0.0

        latencies.sort()
        n = len(latencies)

        return {
            "name": "Protein IUPAC Validator & Physicochemical Property Engine",
            "num_sequences": num_sequences,
            "total_residues": total_residues,
            "valid_sequences": valid_count,
            "total_time_sec": round(total_time_sec, 3),
            "throughput_seq_per_sec": round(seq_per_sec, 1),
            "throughput_residues_per_sec": round(residues_per_sec, 1),
            "mean_ms": round(statistics.mean(latencies), 3),
            "p50_ms": round(statistics.median(latencies), 3),
            "p95_ms": round(latencies[int(n * 0.95)], 3),
            "p99_ms": round(latencies[int(n * 0.99)], 3),
            "min_ms": round(min(latencies), 3),
            "max_ms": round(max(latencies), 3),
        }

    def benchmark_concurrent_jobs(self, num_jobs: int = 20, concurrency: int = 5) -> Dict[str, Any]:
        """Benchmark concurrent asynchronous job dispatch and database persistence."""
        if not self.token or not self.project_id:
            return {"error": "Not authenticated or no project available"}

        def dispatch_job(index: int):
            t0 = time.perf_counter()
            try:
                payload = {
                    "project_id": self.project_id,
                    "workflow_type": "protein",
                    "name": f"benchmark_protein_job_{index}_{int(time.time()*1000)}",
                    "parameters": {
                        "sequence": "NLYIQWLKDGGPSSGRPPPS", # Trp-cage fold
                        "model_id": "esmfold_v1",
                        "num_recycles": 3
                    }
                }
                r = self.session.post(f"{self.api_url}/jobs", json=payload, timeout=10)
                dt = (time.perf_counter() - t0) * 1000.0
                return (r.status_code in [200, 201], dt, r.json() if r.status_code in [200, 201] else {})
            except Exception as e:
                return (False, 0.0, {"error": str(e)})

        t_start = time.perf_counter()
        latencies = []
        created_job_ids = []
        errors = 0

        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(dispatch_job, i) for i in range(num_jobs)]
            for f in concurrent.futures.as_completed(futures):
                success, latency, data = f.result()
                if success:
                    latencies.append(latency)
                    created_job_ids.append(data.get("id"))
                else:
                    errors += 1

        total_time = time.perf_counter() - t_start
        latencies.sort()
        n = len(latencies)

        return {
            "name": "Concurrent Asynchronous Job Dispatch & State Persistence",
            "num_jobs": num_jobs,
            "concurrency": concurrency,
            "total_time_sec": round(total_time, 3),
            "throughput_jobs_per_sec": round(num_jobs / total_time if total_time > 0 else 0.0, 1),
            "errors": errors,
            "success_rate_pct": round((num_jobs - errors) / num_jobs * 100.0, 1),
            "mean_dispatch_ms": round(statistics.mean(latencies) if n else 0.0, 2),
            "p50_ms": round(statistics.median(latencies) if n else 0.0, 2),
            "p95_ms": round(latencies[int(n * 0.95)] if n else 0.0, 2),
            "p99_ms": round(latencies[int(n * 0.99)] if n else 0.0, 2),
            "min_ms": round(min(latencies) if n else 0.0, 2),
            "max_ms": round(max(latencies) if n else 0.0, 2),
        }

    def run_all(self):
        print("=======================================================")
        print("  BioCloud Workbench - Load & Benchmark Suite")
        print("=======================================================\n")

        print("[*] 1. Authenticating with API...")
        if self.authenticate():
            print(f"    [PASS] Authenticated as researcher (Project: {self.project_id}).\n")
        else:
            print("    [WARN] Authentication failed, continuing with unauthenticated tests.\n")

        print("[*] 2. Benchmarking REST API Health Probe (100 requests, 10 concurrent)...")
        res_health = self.benchmark_health_api(num_requests=100, concurrency=10)
        self.results["api_health"] = res_health
        print(f"    Throughput : {res_health['throughput_rps']} requests/sec")
        print(f"    Latency    : Mean={res_health['mean_ms']}ms | p50={res_health['p50_ms']}ms | p95={res_health['p95_ms']}ms | p99={res_health['p99_ms']}ms")
        print(f"    Success    : {res_health['success_rate_pct']}% ({res_health['errors']} errors)\n")

        print("[*] 3. Benchmarking ECG Ingestion & DSP (50 trials of 10s 12-lead @ 250Hz)...")
        res_ecg = self.benchmark_ecg_dsp_pipeline(num_trials=50)
        self.results["ecg_dsp"] = res_ecg
        print(f"    Total Processed: {res_ecg['total_samples_processed']:,} signal samples in {res_ecg['total_time_sec']}s")
        print(f"    Throughput     : {res_ecg['throughput_samples_per_sec']:,.0f} samples/sec ({res_ecg['throughput_seconds_of_ecg_per_sec']}x Real-Time)")
        print(f"    Latency / Lead : Mean={res_ecg['mean_execution_ms']}ms | p50={res_ecg['p50_ms']}ms | p95={res_ecg['p95_ms']}ms\n")

        print("[*] 4. Benchmarking Protein Validation Engine (500 variable sequences)...")
        res_protein = self.benchmark_protein_validation(num_sequences=500)
        self.results["protein_validation"] = res_protein
        print(f"    Total Processed: {res_protein['num_sequences']} sequences ({res_protein['total_residues']:,} amino acids)")
        print(f"    Throughput     : {res_protein['throughput_seq_per_sec']:,.0f} seq/sec | {res_protein['throughput_residues_per_sec']:,.0f} residues/sec")
        print(f"    Latency / Seq  : Mean={res_protein['mean_ms']}ms | p50={res_protein['p50_ms']}ms | p95={res_protein['p95_ms']}ms\n")

        print("[*] 5. Benchmarking Concurrent Job Dispatch (20 jobs, 5 concurrent workers)...")
        res_jobs = self.benchmark_concurrent_jobs(num_jobs=20, concurrency=5)
        self.results["concurrent_jobs"] = res_jobs
        print(f"    Throughput : {res_jobs['throughput_jobs_per_sec']} jobs/sec")
        print(f"    Latency    : Mean={res_jobs['mean_dispatch_ms']}ms | p50={res_jobs['p50_ms']}ms | p95={res_jobs['p95_ms']}ms")
        print(f"    Success    : {res_jobs['success_rate_pct']}%\n")

        print("=======================================================")
        print("  Benchmark Suite Completed Successfully")
        print("=======================================================\n")

        return self.results


if __name__ == "__main__":
    runner = BenchmarkRunner()
    results = runner.run_all()
    
    # Save output JSON
    output_path = ROOT_DIR / "data" / "benchmark_results.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"[+] Detailed JSON results exported to: {output_path}")
