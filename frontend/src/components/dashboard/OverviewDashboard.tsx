"use client";

import React from "react";
import { Job, Project, HealthInfo } from "../../types";
import {
  Activity,
  Dna,
  ArrowRight,
  Database,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";

interface OverviewDashboardProps {
  jobs: Job[];
  projects: Project[];
  activeProject: Project | null;
  health: HealthInfo | null;
  onNavigate: (view: "ecg" | "protein" | "jobs") => void;
  onSelectJob: (job: Job) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  jobs,
  projects,
  activeProject,
  health,
  onNavigate,
  onSelectJob,
}) => {
  const processingCount = jobs.filter((j) => ["queued", "processing"].includes(j.status)).length;
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const ecgCount = jobs.filter((j) => j.workflow_type === "ecg").length;
  const proteinCount = jobs.filter((j) => j.workflow_type === "protein").length;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            RESEARCH & COMPUTATIONAL WORKBENCH
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            BioCloud Workbench
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Integrated high-performance workspace combining biomedical ECG digital signal processing with deep learning protein structure prediction.
          </p>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-teal-500/10 to-transparent pointer-events-none"></div>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>ACTIVE PROJECTS</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {projects.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Current: {activeProject?.name || "None selected"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>TOTAL ANALYSES</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {jobs.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {processingCount} Active · {completedCount} Completed
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>WORKFLOW SPLIT</span>
            <Activity className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {ecgCount} / {proteinCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ECG Analyses / Protein Folds
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>STORAGE BACKEND</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono uppercase">
            {health?.storage.type || "LOCAL"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {health?.storage.bucket || "Private local storage"}
          </div>
        </div>
      </div>

      {/* Two Main Workflows Launch Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Primary Computational Sections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A: ECG */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:border-teal-300 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  WORKFLOW 01 · HEALTH CARE
                </span>
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                ECG Analysis in the Cloud
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload ECG signal files (CSV, WFDB-compatible) or load synthetic rhythm patterns. Run 0.5–40 Hz Butterworth filtering, Pan-Tompkins R-peak detection, and extract heart rate variability (HRV) metrics.
              </p>
            </div>

            <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Pan-Tompkins DSP Engine (v2.1)
              </div>
              <button
                onClick={() => onNavigate("ecg")}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                Launch ECG Section <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card B: Protein */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:border-violet-300 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  WORKFLOW 02 · BIOLOGY
                </span>
                <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center font-bold">
                  <Dna className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
                Protein Structure Prediction
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Submit amino acid sequences (FASTA) or explore verified reference benchmarks. Generate atomic 3D coordinates, inspect interactive ribbon cartoons, and review per-residue pLDDT confidence scores.
              </p>
            </div>

            <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Meta ESMFold (v1.0) / AlphaFold2
              </div>
              <button
                onClick={() => onNavigate("protein")}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                Launch Protein Section <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Analyses Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Recent Analysis Activity
          </h2>
          <button
            onClick={() => onNavigate("jobs")}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
          >
            View all history <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-slate-100">
              {jobs.slice(0, 5).map((j) => (
                <tr
                  key={j.id}
                  onClick={() => onSelectJob(j)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-semibold text-slate-900 flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        j.workflow_type === "ecg" ? "bg-teal-50 text-teal-600" : "bg-violet-50 text-violet-600"
                      }`}
                    >
                      {j.workflow_type === "ecg" ? <Activity className="w-3.5 h-3.5" /> : <Dna className="w-3.5 h-3.5" />}
                    </span>
                    <span className="truncate max-w-sm">{j.name}</span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-500 capitalize">{j.workflow_type}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        j.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : j.status === "failed"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px] text-right">
                    {new Date(j.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 italic">
                    No jobs recorded yet in this project.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
