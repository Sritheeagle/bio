"use client";

import React from "react";
import { Job } from "../../types";
import { X, Clock, Download, RotateCw, XCircle, Activity, Dna, FileText } from "lucide-react";

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onCancelJob,
  onRetryJob,
}) => {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                job.workflow_type === "ecg"
                  ? "bg-teal-100 text-teal-700"
                  : "bg-violet-100 text-violet-700"
              }`}
            >
              {job.workflow_type === "ecg" ? <Activity className="w-5 h-5" /> : <Dna className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{job.name}</h2>
              <div className="text-xs text-slate-500 font-mono">Job ID: {job.id}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Status & Timing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">STATUS</div>
              <div className="text-sm font-bold capitalize text-slate-800 mt-0.5">{job.status}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">WORKFLOW</div>
              <div className="text-sm font-bold uppercase text-slate-800 mt-0.5">{job.workflow_type}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">PROGRESS</div>
              <div className="text-sm font-bold text-teal-700 mt-0.5">{job.progress}%</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">CREATED</div>
              <div className="text-xs font-medium text-slate-700 mt-0.5">
                {new Date(job.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>

          {/* Current Stage */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">CURRENT STAGE</span>
              <div className="text-xs font-semibold text-slate-800 mt-0.5">{job.stage}</div>
            </div>
            {job.error_message && (
              <div className="text-xs text-rose-600 font-medium max-w-xs text-right">
                {job.error_message}
              </div>
            )}
          </div>

          {/* Parameters JSON */}
          {job.parameters && (
            <div>
              <div className="font-bold text-slate-700 mb-1">Execution Parameters</div>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(job.parameters, null, 2)}
              </pre>
            </div>
          )}

          {/* ECG Structured Metrics Cards */}
          {job.workflow_type === "ecg" && job.result?.metrics && (
            <div className="space-y-2">
              <div className="font-bold text-slate-700 flex items-center justify-between">
                <span>Extracted Biomarkers & HRV Metrics</span>
                <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  Pan-Tompkins QRS DSP
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Heart Rate</span>
                  <span className="text-base font-bold text-teal-900 font-mono">
                    {Math.round(job.result.metrics.mean_hr_bpm || job.result.metrics.heart_rate || 0)} <span className="text-xs font-normal">BPM</span>
                  </span>
                </div>
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">SDNN (Autonomic)</span>
                  <span className="text-base font-bold text-teal-900 font-mono">
                    {(job.result.metrics.sdnn_ms || 0).toFixed(1)} <span className="text-xs font-normal">ms</span>
                  </span>
                </div>
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">RMSSD (Vagal)</span>
                  <span className="text-base font-bold text-teal-900 font-mono">
                    {(job.result.metrics.rmssd_ms || 0).toFixed(1)} <span className="text-xs font-normal">ms</span>
                  </span>
                </div>
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">pNN50</span>
                  <span className="text-base font-bold text-teal-900 font-mono">
                    {(job.result.metrics.pnn50_pct || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">R-Peaks Detected</span>
                  <span className="text-base font-bold text-teal-900 font-mono">
                    {job.result.metrics.r_peaks_count || job.result.metrics.num_beats || 0}
                  </span>
                </div>
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Duration</span>
                  <span className="text-base font-bold text-teal-900 font-mono">
                    {(job.result.metrics.signal_length_seconds || 0).toFixed(1)} <span className="text-xs font-normal">sec</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Protein Structured Fold Cards */}
          {job.workflow_type === "protein" && job.result && (
            <div className="space-y-2">
              <div className="font-bold text-slate-700 flex items-center justify-between">
                <span>Predicted Atomic Conformation</span>
                <span className="text-[10px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                  Meta ESMFold v1.0
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Mean pLDDT Score</span>
                  <span className="text-base font-bold text-violet-900 font-mono">
                    {(job.result.mean_plddt || 0).toFixed(1)} <span className="text-xs font-normal">/ 100</span>
                  </span>
                </div>
                <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Confidence Level</span>
                  <span className="text-sm font-bold text-violet-900">
                    {(job.result.mean_plddt || 0) >= 90
                      ? "Very High Confidence"
                      : (job.result.mean_plddt || 0) >= 70
                      ? "Confident Backbone"
                      : "Low / Flexible"}
                  </span>
                </div>
                <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-200/60">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Residue Count</span>
                  <span className="text-base font-bold text-violet-900 font-mono">
                    {job.result.residue_count || job.parameters?.sequence?.length || 0} <span className="text-xs font-normal">AA</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Result JSON Summary */}
          {job.result && (
            <div>
              <div className="font-bold text-slate-700 mb-1">Raw Result Payload (Audit)</div>
              <pre className="p-3 bg-slate-900 text-teal-300 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(job.result).filter(([k]) => k !== "waveform_preview" && k !== "pdb_content")
                  ),
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          {/* Provenance */}
          {job.provenance && (
            <div>
              <div className="font-bold text-slate-700 mb-1">Scientific Provenance & Checksums</div>
              <pre className="p-3 bg-slate-100 text-slate-700 rounded-xl font-mono text-[10px] overflow-x-auto">
                {JSON.stringify(job.provenance, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {["queued", "processing"].includes(job.status) && (
              <button
                onClick={() => {
                  onCancelJob(job.id);
                  onClose();
                }}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-500" /> Cancel Job
              </button>
            )}
            {["failed", "cancelled"].includes(job.status) && (
              <button
                onClick={() => {
                  onRetryJob(job.id);
                  onClose();
                }}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                <RotateCw className="w-3.5 h-3.5" /> Retry Job
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
