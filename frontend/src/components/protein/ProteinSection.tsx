"use client";

import React, { useState, useEffect } from "react";
import { Project, Job, ProteinBenchmark, ProteinPredictionResult } from "../../types";
import { api } from "../../lib/api";
import { MolecularViewer } from "./MolecularViewer";
import {
  Dna,
  UploadCloud,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Clock,
  Sparkles,
  FileCode,
  Settings,
  HelpCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

interface ProteinSectionProps {
  activeProject: Project | null;
  onJobStarted: (job: Job) => void;
}

export const ProteinSection: React.FC<ProteinSectionProps> = ({
  activeProject,
  onJobStarted,
}) => {
  const [activeTab, setActiveTab] = useState<"new" | "results">("new");
  const [inputMode, setInputMode] = useState<"benchmark" | "uniprot" | "paste" | "upload">("benchmark");

  // UniProt / PDB direct lookup state
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Benchmarks
  const [benchmarks, setBenchmarks] = useState<ProteinBenchmark[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>("insulin");

  // Manual sequence input
  const [sequenceText, setSequenceText] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [validationData, setValidationData] = useState<any>(null);

  const handleLookupProtein = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await api.lookupProtein(trimmed);
      setLookupResult(res);
      setSequenceText(res.sequence);
      setHeaderText(res.fasta_header);
      setJobName(`${res.protein_name} Structure Prediction`);
      const val = await api.validateFasta(res.sequence);
      setValidationData(val);
      setError(null);
    } catch (err: any) {
      setLookupError(err.message || "Failed to resolve protein accession.");
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  // Upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);

  // Model parameters
  const [jobName, setJobName] = useState("Target Protein Folding Run");
  const [selectedModel, setSelectedModel] = useState("esmfold_v1");
  const [numRecycles, setNumRecycles] = useState<number>(4);

  // Job & Results
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch benchmarks on mount
  useEffect(() => {
    api.getProteinBenchmarks().then((data) => {
      setBenchmarks(data);
      if (data.length > 0) setSelectedBenchmark(data[0].id);
    }).catch(console.error);
  }, []);

  // Poll current job
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

  // Live validate sequence on change
  const handleValidateSequence = async (seq: string) => {
    setSequenceText(seq);
    if (!seq.trim() || seq.trim().length < 10) {
      setValidationData(null);
      return;
    }
    try {
      const data = await api.validateFasta(seq.trim());
      setValidationData(data);
      setError(null);
    } catch (err: any) {
      setValidationData(null);
    }
  };

  // Direct file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setError(null);
    setUploadedFileId(null);

    if (!activeProject) {
      setError("Please create or select an active project first.");
      return;
    }

    try {
      setUploading(true);
      const ticket = await api.requestUploadTicket(
        activeProject.id,
        "protein",
        file.name,
        file.size,
        "text/plain"
      );
      await api.uploadToStorageUrl(ticket.upload_url, file, ticket.headers);
      setUploadedFileId(ticket.file_id);

      // Validate uploaded FASTA
      const data = await api.validateFasta(undefined, ticket.file_id);
      setValidationData(data);
    } catch (err: any) {
      setError(err.message || "Failed to upload and validate protein sequence file.");
    } finally {
      setUploading(false);
    }
  };

  // Submit Protein Job
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
        model_name: selectedModel,
        num_recycles: Number(numRecycles) || 4,
      };

      if (inputMode === "benchmark") {
        params.reference_benchmark = selectedBenchmark;
        const b = benchmarks.find((x) => x.id === selectedBenchmark);
        if (b) params.sequence = b.sequence;
      } else if (inputMode === "uniprot") {
        if (!sequenceText.trim()) {
          setError("Please lookup a valid UniProt accession or PDB ID first.");
          setLoading(false);
          return;
        }
        params.sequence = sequenceText.trim();
        params.header = headerText.trim() || "uniprot_protein";
        if (lookupResult?.identifier === "P01308") {
          params.reference_benchmark = "insulin";
        }
      } else if (inputMode === "paste") {
        params.sequence = sequenceText.trim();
        params.header = headerText.trim() || "target_protein";
      }

      const job = await api.createJob(
        activeProject.id,
        "protein",
        jobName.trim() || "Protein Structure Prediction",
        inputMode === "upload" ? uploadedFileId || undefined : undefined,
        params
      );

      setCurrentJob(job);
      onJobStarted(job);
      setActiveTab("results");
    } catch (err: any) {
      setError(err.message || "Failed to submit protein structure prediction.");
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

  const proteinResult: ProteinPredictionResult | undefined = currentJob?.result;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-violet-700 uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-violet-500"></span>
            SECTION B · BIOLOGY STRUCTURE PREDICTION
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Dna className="w-6 h-6 text-violet-600" />
            Protein Structure Prediction
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Atomic 3D coordinate prediction from primary amino acid sequence with per-residue pLDDT confidence scoring and interactive molecular visualization.
          </p>
        </div>

        {/* Tab Switch */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab("new")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === "new" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Submit Sequence
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "results" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>Structure & Viewer</span>
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

      {/* Tab 1: Submit Sequence */}
      {activeTab === "new" && (
        <form onSubmit={handleSubmitJob} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Input Selection & Sequence */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-violet-600" />
                  Primary Sequence Input
                </h2>
                <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setInputMode("benchmark")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      inputMode === "benchmark" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Reference Benchmarks
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("uniprot")}
                    className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                      inputMode === "uniprot" ? "bg-white text-violet-900 shadow-xs font-bold" : "text-slate-500"
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-violet-600" /> UniProt / PDB
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("paste")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      inputMode === "paste" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Paste Sequence
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("upload")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      inputMode === "upload" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Upload FASTA
                  </button>
                </div>
              </div>

              {/* Benchmark Option */}
              {inputMode === "benchmark" && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Pre-validated benchmark structures for immediate 3D visualization without requiring local NVIDIA GPU hardware:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {benchmarks.map((b) => {
                      const selected = selectedBenchmark === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            setSelectedBenchmark(b.id);
                            setJobName(`Benchmark Fold: ${b.name}`);
                          }}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            selected
                              ? "border-violet-500 bg-violet-50/50 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-900">{b.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                              {b.sequence_length} aa
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 truncate mb-2">
                            {b.sequence}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-between">
                            <span>Organism: {b.organism}</span>
                            <span className="font-bold text-teal-700">pLDDT: {b.mean_plddt}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* UniProt / PDB Direct Lookup Option */}
              {inputMode === "uniprot" && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-2">
                      Search directly by UniProt accession (e.g. <code className="text-violet-700 bg-violet-50 px-1 py-0.5 rounded font-mono">P01308</code>), gene symbol (<code className="text-violet-700 bg-violet-50 px-1 py-0.5 rounded font-mono">TP53</code>, <code className="text-violet-700 bg-violet-50 px-1 py-0.5 rounded font-mono">HBB</code>), or PDB ID (<code className="text-violet-700 bg-violet-50 px-1 py-0.5 rounded font-mono">1CRN</code>, <code className="text-violet-700 bg-violet-50 px-1 py-0.5 rounded font-mono">1UBQ</code>):
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={lookupQuery}
                        onChange={(e) => setLookupQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleLookupProtein(lookupQuery);
                          }
                        }}
                        placeholder="Enter UniProt ID (e.g. P01308, P04637) or PDB ID (e.g. 1CRN)..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleLookupProtein(lookupQuery)}
                        disabled={lookupLoading || !lookupQuery.trim()}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        {lookupLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Lookup
                      </button>
                    </div>
                  </div>

                  {/* Quick Chips */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-2">Featured Targets:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {[
                        { label: "Human Insulin (P01308)", id: "P01308" },
                        { label: "p53 Tumor Suppressor (P04637)", id: "P04637" },
                        { label: "Hemoglobin Beta (P68871)", id: "P68871" },
                        { label: "KRas GTPase (P01116)", id: "P01116" },
                        { label: "Crambin 0.54Å (1CRN)", id: "1CRN" },
                        { label: "Ubiquitin (1UBQ)", id: "1UBQ" },
                      ].map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            setLookupQuery(chip.id);
                            handleLookupProtein(chip.id);
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-slate-700 border border-slate-200 transition-colors"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {lookupError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                      {lookupError}
                    </div>
                  )}

                  {/* Live Target Card */}
                  {lookupResult && (
                    <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/40 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-violet-600 text-white font-mono text-xs font-bold">
                              {lookupResult.identifier}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{lookupResult.protein_name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Gene: <span className="font-semibold text-slate-700">{lookupResult.gene_name}</span> • Organism:{" "}
                            <span className="italic text-slate-700">{lookupResult.organism}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white text-violet-800 border border-violet-200">
                            {lookupResult.sequence_length} aa
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            {lookupResult.molecular_weight_kda} kDa
                          </span>
                        </div>
                      </div>

                      {lookupResult.function_summary && (
                        <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">BIOLOGICAL FUNCTION</div>
                          {lookupResult.function_summary}
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Primary Amino Acid Sequence (IUPAC Validated)</span>
                          {lookupResult.pdb_ids && lookupResult.pdb_ids.length > 0 && (
                            <span className="font-mono text-[10px]">
                              PDB Structures: {lookupResult.pdb_ids.join(", ")}
                            </span>
                          )}
                        </div>
                        <div className="p-2.5 bg-slate-900 text-teal-300 font-mono text-[11px] rounded-lg break-all max-h-24 overflow-y-auto select-all">
                          {lookupResult.sequence}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Paste Sequence Option */}
              {inputMode === "paste" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">FASTA Header (Optional)</label>
                    <input
                      type="text"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="e.g. sp|P01308|INS_HUMAN Insulin B-chain"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amino Acid Sequence (IUPAC 20 Standard Symbols)
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={sequenceText}
                      onChange={(e) => handleValidateSequence(e.target.value)}
                      placeholder="e.g. FVNQHLCGSHLVEALYLVCGERGFFYTPKT…"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:ring-2 focus:ring-violet-500 uppercase"
                    />
                  </div>
                </div>
              )}

              {/* Upload Option */}
              {inputMode === "upload" && (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-slate-300 hover:border-violet-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50">
                    <input
                      type="file"
                      accept=".fasta,.fa,.fna,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <UploadCloud className="w-8 h-8 text-violet-600 mb-2" />
                    <span className="text-xs font-semibold text-slate-800">
                      {uploadFile ? uploadFile.name : "Choose FASTA file or drop it here"}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Supported: .fasta, .fa, .fna, .txt · Max 10 MB
                    </span>
                  </label>
                </div>
              )}

              {/* Live Sequence Validation Badge */}
              {validationData && (
                <div className="p-4 bg-violet-50/60 border border-violet-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-violet-900">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-violet-600" /> Sequence Validated
                    </span>
                    <span>Length: <b>{validationData.sequence_length} residues</b> (~{validationData.molecular_weight_kda} kDa)</span>
                  </div>
                  <div className="text-[11px] text-violet-800 font-mono truncate">
                    {validationData.sequence}
                  </div>
                </div>
              )}
            </div>

            {/* Run details */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Workflow Run Details</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Name</label>
                <input
                  type="text"
                  required
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g. Kinase Domain Structural Modeling"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
          </div>

          {/* Right Col: Model & Engine Parameters */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Settings className="w-4 h-4 text-violet-600" />
                <h2 className="text-sm font-bold text-slate-900">Prediction Engine</h2>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Structure Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                >
                  <option value="esmfold_v1">Meta ESMFold v1.0 (Direct Language Model)</option>
                  <option value="alphafold2">AlphaFold2 Monomer (AWS Batch GPU)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  ESMFold outputs atomic PDB coords directly from sequence without MSAs.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recycle Iterations (1–10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numRecycles}
                  onChange={(e) => setNumRecycles(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Higher recycles improve refine accuracy on flexible loops.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" /> Model Availability Notice
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Real model execution requires PyTorch with NVIDIA GPU or configured remote container. For testing without GPU, select a reference benchmark above.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || uploading || (inputMode === "paste" && !sequenceText.trim()) || (inputMode === "upload" && !uploadedFileId)}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" /> Enqueuing Structure Run…
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Start Structure Prediction
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Structure & Viewer */}
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
                          ? "bg-amber-100 text-amber-800"
                          : currentJob.status === "cancelled"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-violet-100 text-violet-800 animate-pulse"
                      }`}
                    >
                      {currentJob.status === "failed" && currentJob.stage.includes("Unavailable")
                        ? "Model Unavailable"
                        : currentJob.status}
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
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Retry Run
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {["queued", "processing"].includes(currentJob.status) && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{currentJob.stage}</span>
                    <span className="font-mono text-violet-600 font-bold">{currentJob.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 transition-all duration-300"
                      style={{ width: `${currentJob.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Model Unavailable Actionable Card */}
              {currentJob.status === "failed" && proteinResult?.model_status === "model_unavailable" && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-950">
                        Structure Prediction Model Execution Unavailable
                      </h3>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Strict scientific integrity policy: BioCloud Workbench will never fabricate fake or simulated 3D coordinates.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white/80 rounded-xl border border-amber-200/60 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {proteinResult.setup_instructions}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setInputMode("benchmark");
                        setActiveTab("new");
                      }}
                      className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      Test with Reference Benchmark (Insulin / Trp-cage)
                    </button>
                  </div>
                </div>
              )}

              {/* Completed Results Display with 3D Viewer */}
              {currentJob.status === "completed" && proteinResult && proteinResult.pdb_content && (
                <div className="space-y-6">
                  {/* Molecular Viewer */}
                  <MolecularViewer
                    pdbContent={proteinResult.pdb_content}
                    meanPlddt={proteinResult.mean_plddt}
                    ptmScore={proteinResult.ptm_score}
                    title={proteinResult.header}
                  />

                  {/* Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">MEAN pLDDT CONFIDENCE</div>
                      <div className="text-2xl font-bold text-teal-700 mt-1 font-mono">
                        {proteinResult.mean_plddt?.toFixed(1) || "N/A"}{" "}
                        <span className="text-xs font-normal text-slate-400">/ 100</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Per-residue B-factor metric</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">pTM SCORE</div>
                      <div className="text-2xl font-bold text-violet-700 mt-1 font-mono">
                        {proteinResult.ptm_score?.toFixed(2) || "N/A"}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Predicted TM alignment</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">SEQUENCE LENGTH</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                        {proteinResult.sequence_length}{" "}
                        <span className="text-xs font-normal text-slate-400">aa</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        ~{proteinResult.molecular_weight_kda} kDa mass
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">EXECUTION BACKEND</div>
                      <div className="text-sm font-bold text-slate-900 mt-2 truncate">
                        {proteinResult.execution_device}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {proteinResult.model_name} ({proteinResult.model_version})
                      </div>
                    </div>
                  </div>

                  {/* Provenance & Export Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-3">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Structure Provenance & Export</span>
                      <button
                        onClick={() => {
                          const blob = new Blob([proteinResult.pdb_content || ""], {
                            type: "chemical/x-pdb",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${currentJob.output_filename || "predicted_structure.pdb"}`;
                          a.click();
                        }}
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 font-semibold shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Atomic Structure (.PDB)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-500">
                      <div>Input SHA-256: {currentJob.provenance?.input_sha256 || "Validated FASTA"}</div>
                      <div>Model Engine: {proteinResult.model_name} ({proteinResult.model_version})</div>
                      <div>Benchmark Flag: {proteinResult.is_reference_benchmark ? "Verified Reference" : "Computed Model"}</div>
                      <div>Completed At: {currentJob.completed_at ? new Date(currentJob.completed_at).toISOString() : ""}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
              <Dna className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Active Structure Prediction Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Submit an amino acid sequence or select a reference benchmark to inspect 3D atomic coordinates and confidence metrics.
              </p>
              <button
                onClick={() => setActiveTab("new")}
                className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold"
              >
                Submit New Sequence
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
