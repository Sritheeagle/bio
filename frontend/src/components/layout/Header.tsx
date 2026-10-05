"use client";

import React, { useState } from "react";
import { User, Project, HealthInfo } from "../../types";
import { Folder, ChevronDown, Plus, Shield, User as UserIcon, LogOut, Database, AlertCircle, Cloud, AlertTriangle, Layers } from "lucide-react";

interface HeaderProps {
  currentUser: User | null;
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (project: Project) => void;
  onOpenNewProject: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenCopilot?: () => void;
  storageType?: string;
  health?: HealthInfo | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  onOpenAuth,
  onLogout,
  onOpenCopilot,
  storageType = "local",
  health,
}) => {
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);


  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* Sample Data & Research Disclaimer Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-900 flex items-center justify-between font-medium">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            <b>DEMONSTRATION & RESEARCH WORKBENCH:</b> Signal processing and structure prediction models are investigational tools for exploratory analysis only. Never upload identifiable patient data.
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded font-bold">
          Research Use Only
        </span>
      </div>

      <div className="px-6 h-16 flex items-center justify-between">
        {/* Left: Active Project Selector */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors text-sm text-slate-800 font-medium"
            >
              <div className="w-6 h-6 rounded bg-teal-600/10 text-teal-700 flex items-center justify-center font-bold text-xs">
                <Folder className="w-3.5 h-3.5" />
              </div>
              <span className="max-w-[220px] truncate">
                {activeProject ? activeProject.name : "Select a project…"}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {projectDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Projects
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectProject(p);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        activeProject?.id === p.id ? "bg-teal-50/70 text-teal-900 font-semibold" : "text-slate-700"
                      }`}
                    >
                      <span className="truncate pr-2">{p.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {p.job_count} jobs
                      </span>
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400 italic">No projects found.</div>
                  )}
                </div>
                <div className="border-t border-slate-100 mt-1 pt-1 px-1">
                  <button
                    onClick={() => {
                      setProjectDropdownOpen(false);
                      onOpenNewProject();
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-teal-700 hover:bg-teal-50 rounded-lg flex items-center gap-2 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create New Project
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Environment, Storage & Queue Status Badges */}
          <div className="hidden md:flex items-center gap-2">
            {!health ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                CONNECTING…
              </span>
            ) : health.local_dev_mode ? (
              <span
                title="Running locally: SQLite database, local disk storage, in-memory queue, and local mock JWT auth."
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200/80 px-2.5 py-1 rounded-full"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                LOCAL DEV MODE
              </span>
            ) : health.aws_connected ? (
              <span
                title="Production AWS backend configured: Amazon S3 (KMS), Aurora PostgreSQL, Amazon SQS FIFO, and Amazon Cognito."
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full shadow-2xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                AWS CONFIGURED
              </span>
            ) : health.aws_emulator_mode ? (
              <span
                title="Running with offline local AWS emulator (moto_server / LocalStack)."
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-300 px-2.5 py-1 rounded-full"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                AWS EMULATOR
              </span>
            ) : (
              <span
                title={health.config_errors?.join("; ") || "AWS mode requested but required cloud settings are missing."}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full"
              >
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                AWS CONFIG MISSING
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
              <Database className="w-3 h-3 text-slate-500" />
              {health?.storage.type === "s3" ? "S3 (KMS)" : "LOCAL DISK"}
            </span>

            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
              <Layers className="w-3 h-3 text-slate-500" />
              {health?.queue.type === "sqs" ? "SQS FIFO" : "LOCAL QUEUE"}
            </span>
          </div>

        </div>

        {/* Right: BioCopilot Button & User Menu */}
        <div className="flex items-center gap-3">
          {onOpenCopilot && (
            <button
              onClick={onOpenCopilot}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Open BioCopilot AI Assistant"
            >
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
              <span>BioCopilot AI</span>
            </button>
          )}

          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  {currentUser.full_name ? currentUser.full_name[0].toUpperCase() : "U"}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {currentUser.full_name}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 capitalize">
                    {currentUser.role === "admin" && <Shield className="w-2.5 h-2.5 text-indigo-600" />}
                    {currentUser.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-900">{currentUser.full_name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                    <div className="mt-1">
                      <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        Role: {currentUser.role}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <UserIcon className="w-3.5 h-3.5" /> Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
