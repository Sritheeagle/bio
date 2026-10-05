"use client";

import React, { useState, useEffect } from "react";
import { Project, Job, SyntheticPattern, ECGAnalysisResult } from "../../types";
import { api } from "../../lib/api";
import { ECGWaveformChart } from "./ECGWaveformChart";
import {
  Activity,
  UploadCloud,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Info,
  Clock,
  Sparkles,
  FileText,
  Sliders,
  XCircle,
} from "lucide-react";

interface ECGSectionProps {
  activeProject: Project | null;
  onJobStarted: (job: Job) => void;
}

export const ECGSection: React.FC<ECGSectionProps> = ({
  activeProject,
  onJobStarted,
}) => {
  const [activeTab, setActiveTab] = useState<"new" | "results">("new");
  const [inputMode, setInputMode] = useState<"synthetic" | "upload">("synthetic");

  // Synthetic patterns
  const [patterns, setPatterns] = useState<SyntheticPattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<string>("normal_sinus");

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  // Parameters
  const [analysisName, setAnalysisName] = useState("Resting ECG Telemetry Run");
  const [samplingRate, setSamplingRate] = useState<number>(250);
  const [channelName, setChannelName] = useState<string>("lead_II");
  const [lowCut, setLowCut] = useState<number>(0.5);
  const [highCut, setHighCut] = useState<number>(40.0);
  const [applyArrhythmia, setApplyArrhythmia] = useState(true);

  // Active Job & Results
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch synthetic patterns on mount
  useEffect(() => {
    api.getSyntheticPatterns().then((data) => {
      setPatterns(data);
      if (data.length > 0) setSelectedPattern(data[0].id);
    }).catch(console.error);
  }, []);

  // Poll current job if processing or queued
  useEffect(() => {
    if (!currentJob || ["completed", "failed", "cancelled"].includes(currentJob.status)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await api.getJob(currentJob.id);
        setCurrentJob(updated);
      } catch (e) {
        console.error("Job poll error:", e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentJob]);

  // Handle direct file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setError(null);
    setPreviewData(null);
    setUploadedFileId(null);

    if (!activeProject) {
      setError("Please create or select an active project first.");
      return;
    }

    // Direct object storage upload flow with short-lived ticket
    try {
      setUploading(true);
      setUploadProgress(20);

      // Step 1: Request short-lived upload ticket
      const ticket = await api.requestUploadTicket(
        activeProject.id,
        "ecg",
        file.name,
        file.size,
        file.type || "text/csv"
      );

      setUploadProgress(50);

      // Step 2: Upload directly to storage URL
      await api.uploadToStorageUrl(ticket.upload_url, file, ticket.headers);
      setUploadProgress(80);

      setUploadedFileId(ticket.file_id);

      // Step 3: Run quick validation preview
      const preview = await api.validatePreviewEcg(ticket.file_id);
      setPreviewData(preview);
      if (preview.selected_channel) setChannelName(preview.selected_channel);
      if (preview.sampling_rate_hz) setSamplingRate(preview.sampling_rate_hz);

      setUploadProgress(100);
    } catch (err: any) {
      setError(err.message || "Failed to upload and validate ECG file.");
    } finally {
      setUploading(false);
    }
  };

  // Submit ECG Job
  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) {
      setError("Please select or create an active project first.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const params: Record<string, any> = {
        sampling_rate_hz: Number(samplingRate) || 250,
        channel_name: channelName,
        low_cut_hz: Number(lowCut) || 0.5,
        high_cut_hz: Number(highCut) || 40.0,
        apply_arrhythmia_screening: applyArrhythmia,
      };

      if (inputMode === "synthetic") {
        params.synthetic_pattern = selectedPattern;
      }

      const job = await api.createJob(
        activeProject.id,
        "ecg",
        analysisName.trim() || "ECG Analysis Run",
        inputMode === "upload" ? uploadedFileId || undefined : undefined,
        params
      );

      setCurrentJob(job);
      onJobStarted(job);
      setActiveTab("results");
    } catch (err: any) {
      setError(err.message || "Failed to start ECG analysis pipeline.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async () => {
    if (!currentJob) return;
    try {
      const updated = await api.cancelJob(currentJob.id);
      setCurrentJob(updated);
    } catch (err: any) {
      setError(err.message || "Failed to cancel job.");
    }
  };

  const handleRetryJob = async () => {
    if (!currentJob) return;
    try {
      const updated = await api.retryJob(currentJob.id);
      setCurrentJob(updated);
    } catch (err: any) {
      setError(err.message || "Failed to retry job.");
    }
  };

  const ecgResult: ECGAnalysisResult | undefined = currentJob?.result;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            SECTION A · HEALTH CARE SIGNAL PROCESSING
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-teal-600" />
            ECG Analysis in the Cloud
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Reproducible digital signal processing pipeline with Pan-Tompkins R-peak detection, Butterworth bandpass filtering (0.5–40 Hz), HRV metric extraction, and versioned rhythm screening.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab("new")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === "new" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Configure & Run
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "results" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>Live Analysis & Results</span>
            {currentJob && ["queued", "processing"].includes(currentJob.status) && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">×</button>
        </div>
      )}

      {/* Tab 1: Configure & Run */}
      {activeTab === "new" && (
        <form onSubmit={handleSubmitJob} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Input Selection & File Upload */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  ECG Telemetry Input Source
                </h2>
                <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setInputMode("synthetic")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      inputMode === "synthetic" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Synthetic Test Datasets
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("upload")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      inputMode === "upload" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Upload ECG File
                  </button>
                </div>
              </div>

              {inputMode === "synthetic" ? (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Select a representative synthetic cardiac waveform for local validation. Labeled strictly as synthetic data:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {patterns.map((p) => {
                      const selected = selectedPattern === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPattern(p.id);
                            setAnalysisName(`Synthetic Analysis: ${p.name}`);
                          }}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            selected
                              ? "border-teal-500 bg-teal-50/50 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-900">{p.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              {p.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">{p.description}</p>
                          <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center gap-3">
                            <span>HR: ~{p.heart_rate_bpm} bpm</span>
                            <span>{p.sampling_rate_hz} Hz</span>
                            <span>{p.duration_s}s</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Upload Dropzone */}
                  <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50">
                    <input
                      type="file"
                      accept=".csv,.txt,.dat"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <UploadCloud className="w-8 h-8 text-teal-600 mb-2" />
                    <span className="text-xs font-semibold text-slate-800">
                      {uploadFile ? uploadFile.name : "Choose CSV, TXT, or DAT file or drag & drop"}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Supports comma, tab, or whitespace delimited numbers · Max 50 MB
                    </span>
                  </label>

                  {uploading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Uploading to private storage…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {previewData && (
                    <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between font-semibold text-teal-900">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-teal-600" /> Input Validated
                        </span>
                        <span>{previewData.total_samples} samples ({previewData.duration_seconds}s)</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-teal-800 pt-1">
                        <div>Detected lead: <b>{previewData.selected_channel}</b></div>
                        <div>Sampling rate: <b>{previewData.sampling_rate_hz} Hz</b></div>
                        <div>Available: <b>{previewData.available_channels?.join(", ")}</b></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Analysis details */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Analysis Metadata</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Workflow Run Name</label>
                <input
                  type="text"
                  required
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  placeholder="e.g. Lead II Resting Analysis Batch 01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Right Col: Signal Processing Parameters */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sliders className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">Pipeline Parameters</h2>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sampling Frequency (Hz)
                </label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  value={samplingRate}
                  onChange={(e) => setSamplingRate(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Standard clinical rates: 250, 360, 500, or 1000 Hz
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Channel / Lead Identifier
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="lead_II, MLII, V1…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    High-Pass Cut (Hz)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={lowCut}
                    onChange={(e) => setLowCut(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                  <span className="text-[9px] text-slate-400">Baseline wander</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low-Pass Cut (Hz)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={highCut}
                    onChange={(e) => setHighCut(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                  <span className="text-[9px] text-slate-400">Muscle artifact</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyArrhythmia}
                    onChange={(e) => setApplyArrhythmia(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-medium text-slate-800">
                    Apply Rhythm Classification Plugin (v1.2)
                  </span>
                </label>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Descriptive research rule-engine. Not a clinical diagnostic decision.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || uploading || (inputMode === "upload" && !uploadedFileId)}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" /> Starting Pipeline…
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Execute ECG Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Live Analysis & Results */}
      {activeTab === "results" && (
        <div className="space-y-6">
          {currentJob ? (
            <div className="space-y-6">
              {/* Job Status Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        currentJob.status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : currentJob.status === "failed"
                          ? "bg-rose-100 text-rose-800"
                          : currentJob.status === "cancelled"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-amber-100 text-amber-800 animate-pulse"
                      }`}
                    >
                      {currentJob.status}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{currentJob.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Stage: {currentJob.stage}</span>
                    <span>•</span>
                    <span>Created: {new Date(currentJob.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {["queued", "processing"].includes(currentJob.status) && (
                    <button
                      onClick={handleCancelJob}
                      className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-500" /> Cancel Run
                    </button>
                  )}
                  {["failed", "cancelled"].includes(currentJob.status) && (
                    <button
                      onClick={handleRetryJob}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Retry Pipeline
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {["queued", "processing"].includes(currentJob.status) && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{currentJob.stage}</span>
                    <span className="font-mono text-teal-600 font-bold">{currentJob.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 transition-all duration-300"
                      style={{ width: `${currentJob.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Completed Results Display */}
              {currentJob.status === "completed" && ecgResult && (
                <div className="space-y-6">
                  {/* Interactive Waveform Chart */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Interactive 12-Lead Cardiac Waveform & Peak Detection
                        </h2>
                        <p className="text-xs text-slate-500">
                          Clinical 12-lead view & Pan-Tompkins R-peak detection (Butterworth 0.5–40 Hz)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {ecgResult.lead_previews && Object.keys(ecgResult.lead_previews).length >= 12 && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                            12-Lead Complete
                          </span>
                        )}
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                          {ecgResult.detected_beats_count} Beats Identified
                        </span>
                      </div>
                    </div>

                    <ECGWaveformChart
                      waveform={ecgResult.waveform_preview || []}
                      rPeakTimes={ecgResult.r_peak_times || []}
                      samplingRate={ecgResult.sampling_rate_hz}
                      leadName={ecgResult.lead_name}
                      leadPreviews={ecgResult.lead_previews}
                      availableLeads={ecgResult.available_leads}
                    />
                  </div>

                  {/* Scientific Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">MEAN HEART RATE</div>
                      <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                        {ecgResult.mean_hr_bpm} <span className="text-xs font-normal text-slate-400">bpm</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Min {ecgResult.min_hr_bpm} / Max {ecgResult.max_hr_bpm}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">MEAN RR INTERVAL</div>
                      <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                        {ecgResult.mean_rr_ms} <span className="text-xs font-normal text-slate-400">ms</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Cardiac cycle timing</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">SDNN (HRV)</div>
                      <div className="text-xl font-bold text-teal-700 mt-1 font-mono">
                        {ecgResult.sdnn_ms} <span className="text-xs font-normal text-slate-400">ms</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Overall HRV variance</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">RMSSD</div>
                      <div className="text-xl font-bold text-teal-700 mt-1 font-mono">
                        {ecgResult.rmssd_ms} <span className="text-xs font-normal text-slate-400">ms</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Parasympathetic activity</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">pNN50</div>
                      <div className="text-xl font-bold text-teal-700 mt-1 font-mono">
                        {ecgResult.pnn50_percent} <span className="text-xs font-normal text-slate-400">%</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Intervals &gt; 50 ms</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">SIGNAL QUALITY</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        {ecgResult.signal_quality}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">SNR: {ecgResult.snr_db} dB</div>
                    </div>
                  </div>

                  {/* Frequency-Domain HRV & Autonomic Modulation Card */}
                  {ecgResult.frequency_hrv && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-teal-600" />
                            <h3 className="text-sm font-bold text-slate-900">
                              Frequency-Domain HRV & Autonomic Nervous Balance
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Power Spectral Density (Welch Periodogram) • VLF (0.003–0.04 Hz), LF (0.04–0.15 Hz), HF (0.15–0.40 Hz)
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              ecgResult.frequency_hrv.lf_hf_ratio > 2.5
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : ecgResult.frequency_hrv.lf_hf_ratio < 0.8
                                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                : "bg-teal-50 text-teal-800 border-teal-200"
                            }`}
                          >
                            {ecgResult.frequency_hrv.autonomic_balance}
                          </span>
                        </div>
                      </div>

                      {/* Spectral Power Metrics Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">LF/HF RATIO</div>
                          <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                            {ecgResult.frequency_hrv.lf_hf_ratio}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Autonomic index (1.0–2.5)</div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="text-[10px] font-bold text-teal-600 uppercase">LF POWER (0.04–0.15 Hz)</div>
                          <div className="text-lg font-bold text-teal-700 mt-0.5 font-mono">
                            {ecgResult.frequency_hrv.lf_power_ms2} <span className="text-xs font-normal text-slate-400">ms²</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{ecgResult.frequency_hrv.lf_nu}% LFnu (Symp/Vagal)</div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="text-[10px] font-bold text-indigo-600 uppercase">HF POWER (0.15–0.40 Hz)</div>
                          <div className="text-lg font-bold text-indigo-700 mt-0.5 font-mono">
                            {ecgResult.frequency_hrv.hf_power_ms2} <span className="text-xs font-normal text-slate-400">ms²</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{ecgResult.frequency_hrv.hf_nu}% HFnu (Parasympathetic)</div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">TOTAL POWER</div>
                          <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                            {ecgResult.frequency_hrv.total_power_ms2} <span className="text-xs font-normal text-slate-400">ms²</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">VLF: {ecgResult.frequency_hrv.vlf_power_ms2} ms²</div>
                        </div>
                      </div>

                      {/* Spectral Distribution Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>Spectral Power Distribution</span>
                          <span>LF: {ecgResult.frequency_hrv.lf_nu}% • HF: {ecgResult.frequency_hrv.hf_nu}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div style={{ width: `${ecgResult.frequency_hrv.lf_nu}%` }} className="bg-teal-500 h-full"></div>
                          <div style={{ width: `${ecgResult.frequency_hrv.hf_nu}%` }} className="bg-indigo-500 h-full"></div>
                        </div>
                      </div>
                    </div>
                  )}


                  {/* Arrhythmia Screening Plugin Card */}
                  {ecgResult.arrhythmia_details && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-teal-600" />
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                            Rhythm Classifier Plugin ({ecgResult.arrhythmia_details.plugin_version})
                          </h3>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {ecgResult.arrhythmia_details.regulatory_status}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {ecgResult.arrhythmia_details.classification}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {ecgResult.arrhythmia_details.description}
                          </div>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-teal-100 text-teal-800">
                          Confidence: {ecgResult.arrhythmia_details.confidence}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Provenance & Export Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-3">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Scientific Provenance & Audit Metadata</span>
                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(ecgResult, null, 2)], {
                            type: "application/json",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `ecg_analysis_${currentJob.id}.json`;
                          a.click();
                        }}
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 font-semibold shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Metrics JSON
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-500">
                      <div>Input SHA-256: {currentJob.provenance?.input_sha256 || "Synthetic Pattern Generated"}</div>
                      <div>DSP Pipeline: {currentJob.provenance?.pipeline_version || "scipy-dsp-v2.1.0"}</div>
                      <div>Duration Processed: {ecgResult.duration_seconds}s @ {ecgResult.sampling_rate_hz} Hz</div>
                      <div>Completed At: {currentJob.completed_at ? new Date(currentJob.completed_at).toISOString() : ""}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
              <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Active Analysis Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Configure a synthetic test signal or upload an ECG file to view live waveform filtering, peak detection, and HRV statistics.
              </p>
              <button
                onClick={() => setActiveTab("new")}
                className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold"
              >
                Configure New Run
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
