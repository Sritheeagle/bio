"use client";

import React from "react";
import { User, Project } from "../../types";
import {
  LayoutDashboard,
  Activity,
  Dna,
  History,
  Settings,
  ShieldAlert,
  Server,
} from "lucide-react";

export type NavView = "overview" | "ecg" | "protein" | "jobs" | "settings" | "admin";

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  currentUser: User | null;
  activeProject: Project | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  activeProject,
}) => {
  const isAdmin = currentUser?.role === "admin";

  const navItems: Array<{ id: NavView; label: string; icon: React.ReactNode; badge?: string; badgeColor?: string }> = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "ecg",
      label: "ECG Analysis",
      icon: <Activity className="w-4 h-4" />,
      badge: "Health Care",
      badgeColor: "bg-teal-500/10 text-teal-400 border border-teal-500/20",
    },
    {
      id: "protein",
      label: "Protein Prediction",
      icon: <Dna className="w-4 h-4" />,
      badge: "Biology",
      badgeColor: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    },
    {
      id: "jobs",
      label: "Job History & Audit",
      icon: <History className="w-4 h-4" />,
    },
    {
      id: "settings",
      label: "Architecture & Config",
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  if (isAdmin) {
    navItems.push({
      id: "admin",
      label: "Administration",
      icon: <ShieldAlert className="w-4 h-4" />,
      badge: "Admin",
      badgeColor: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    });
  }

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand */}
      <div className="h-16 px-5 border-b border-slate-900 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-base shadow-sm">
          B
        </div>
        <div>
          <div className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
            biocloud
            <span className="text-[10px] uppercase font-bold text-teal-400 bg-teal-950/80 px-1.5 py-0.2 rounded border border-teal-800">
              v1.0
            </span>
          </div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            RESEARCH WORKBENCH
          </div>
        </div>
      </div>

      {/* Shared Active Project Indicator */}
      <div className="px-4 py-3 border-b border-slate-900 bg-slate-900/40">
        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
          ACTIVE PROJECT
        </div>
        <div className="text-xs font-semibold text-slate-100 truncate mt-0.5">
          {activeProject ? activeProject.name : "No active project"}
        </div>
        <div className="text-[10px] text-slate-300 mt-0.5 flex items-center gap-2">
          <span>{activeProject ? `${activeProject.job_count} jobs logged` : "Create or open a project"}</span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
          WORKBENCH SECTIONS
        </div>
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                active
                  ? "bg-slate-800 text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={active ? "text-teal-400" : "text-slate-500"}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Info / Status */}
      <div className="p-4 border-t border-slate-900 bg-slate-900/30 text-xs">
        <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
          <span className="flex items-center gap-1.5">
            <Server className="w-3 h-3 text-emerald-400" /> Services Ready
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">Local Dev</span>
        </div>
        <div className="text-[10px] text-slate-300">
          FastAPI Backend + SQLite/Postgres
        </div>
      </div>
    </aside>
  );
};
