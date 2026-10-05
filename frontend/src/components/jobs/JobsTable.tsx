"use client";

import React, { useState } from "react";
import { Job, Project } from "../../types";
import {
  Activity,
  Dna,
  RefreshCw,
  Search,
  Filter,
  Eye,
  RotateCw,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface JobsTableProps {
  jobs: Job[];
  activeProject: Project | null;
  onRefresh: () => void;
  onSelectJob: (job: Job) => void;
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
}

export const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  activeProject,
  onRefresh,
  onSelectJob,
  onCancelJob,
  onRetryJob,
}) => {
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filtered = jobs.filter((j) => {
    if (workflowFilter !== "all" && j.workflow_type !== workflowFilter) return false;
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        j.name.toLowerCase().includes(q) ||
        j.stage.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Workflow Filter */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setWorkflowFilter("all")}
              className={`px-3 py-1 rounded-md transition-colors ${
                workflowFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
              }`}
            >
              All Workflows
            </button>
            <button
              onClick={() => setWorkflowFilter("ecg")}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                workflowFilter === "ecg" ? "bg-white text-teal-900 shadow-2xs font-bold" : "text-slate-500"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-teal-600" /> ECG
            </button>
            <button
              onClick={() => setWorkflowFilter("protein")}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                workflowFilter === "protein" ? "bg-white text-violet-900 shadow-2xs font-bold" : "text-slate-500"
              }`}
            >
              <Dna className="w-3.5 h-3.5 text-violet-600" /> Protein
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search analyses…"
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg w-44 sm:w-56 text-slate-800"
            />
          </div>
          <button
            onClick={onRefresh}
            className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600"
            title="Refresh jobs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-5 py-3">Analysis Name</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress / Stage</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                          j.workflow_type === "ecg"
                            ? "bg-teal-50 text-teal-600"
                            : "bg-violet-50 text-violet-600"
                        }`}
                      >
                        {j.workflow_type === "ecg" ? <Activity className="w-3.5 h-3.5" /> : <Dna className="w-3.5 h-3.5" />}
                      </span>
                      <span className="truncate max-w-xs">{j.name}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 capitalize font-medium text-slate-600">
                    {j.workflow_type === "ecg" ? "ECG Analysis" : "Protein Prediction"}
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        j.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : j.status === "failed"
                          ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                          : j.status === "cancelled"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60 animate-pulse"
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="max-w-[180px]">
                      <div className="text-[11px] text-slate-700 truncate font-medium">{j.stage}</div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full ${
                            j.status === "completed"
                              ? "bg-emerald-500"
                              : j.status === "failed"
                              ? "bg-rose-500"
                              : "bg-teal-500"
                          }`}
                          style={{ width: `${j.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                    {new Date(j.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onSelectJob(j)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {["queued", "processing"].includes(j.status) && (
                        <button
                          onClick={() => onCancelJob(j.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50"
                          title="Cancel Job"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {["failed", "cancelled"].includes(j.status) && (
                        <button
                          onClick={() => onRetryJob(j.id)}
                          className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100"
                          title="Retry Job"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic">
                    No matching analysis runs found.
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
