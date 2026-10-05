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
  ChevronLeft,
  ChevronRight,
  Folder,
} from "lucide-react";

export type NavView = "overview" | "ecg" | "ecg-studio" | "protein" | "protein-studio" | "jobs" | "settings" | "admin";

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  currentUser: User | null;
  activeProject: Project | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  activeProject,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const isAdmin = currentUser?.role === "admin";

  const navItems: Array<{ id: NavView; label: string; icon: React.ReactNode; badge?: string; badgeColor?: string }> = [
    {
      id: "overview",
      label: "Overview Dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "ecg-studio",
      label: "ECG Live Studio",
      icon: <Activity className="w-4 h-4 text-teal-400" />,
      badge: "Real-Time",
      badgeColor: "bg-teal-500/20 text-teal-300 border border-teal-500/40",
    },
    {
      id: "ecg",
      label: "ECG Batch Analytics",
      icon: <Activity className="w-4 h-4" />,
      badge: "DSP",
      badgeColor: "bg-teal-500/10 text-teal-400 border border-teal-500/20",
    },
    {
      id: "protein-studio",
      label: "Protein 3D Studio",
      icon: <Dna className="w-4 h-4 text-violet-400" />,
      badge: "3D Mol*",
      badgeColor: "bg-violet-500/20 text-violet-300 border border-violet-500/40",
    },
    {
      id: "protein",
      label: "Protein Pipeline",
      icon: <Dna className="w-4 h-4" />,
      badge: "ESMFold",
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
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-64"
      } bg-slate-950 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none transition-all duration-300 ease-in-out relative z-20`}
    >
      {/* Brand Header & Collapse Toggle */}
      <div className={`h-16 ${isCollapsed ? "px-2" : "px-4"} border-b border-slate-900 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={onToggleCollapse}
            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-base shadow-sm shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            title={isCollapsed ? "Open / Expand sidebar" : "BioCloud Workbench"}
          >
            B
          </button>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                biocloud
                <span className="text-[10px] uppercase font-bold text-teal-400 bg-teal-950/80 px-1.5 py-0.2 rounded border border-teal-800">
                  v1.0
                </span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
                RESEARCH WORKBENCH
              </div>
            </div>
          )}
        </div>

        {onToggleCollapse && !isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors shrink-0 cursor-pointer"
            title="Collapse sidebar (Close)"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active Project Indicator */}
      {!isCollapsed ? (
        <div className="px-4 py-3 border-b border-slate-900 bg-slate-900/40">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            ACTIVE PROJECT
          </div>
          <div className="text-xs font-semibold text-slate-100 truncate mt-0.5">
            {activeProject ? activeProject.name : "No active project"}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
            <span>{activeProject ? `${activeProject.job_count} jobs logged` : "Create or open a project"}</span>
          </div>
        </div>
      ) : (
        <div
          className="px-2 py-3 border-b border-slate-900 bg-slate-900/40 flex justify-center cursor-pointer"
          title={`Active Project: ${activeProject ? activeProject.name : "None selected"}`}
        >
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Folder className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Nav Menu */}
      <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            WORKBENCH SECTIONS
          </div>
        )}
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={isCollapsed ? `${item.label} ${item.badge ? `(${item.badge})` : ""}` : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2"
              } rounded-xl text-xs font-medium transition-all group ${
                active
                  ? "bg-slate-800 text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`${active ? "text-teal-400 scale-110" : "text-slate-500 group-hover:text-slate-300"} transition-transform`}>
                  {item.icon}
                </span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>

              {!isCollapsed && item.badge && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor} shrink-0`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Info / Status */}
      <div className="p-3 border-t border-slate-900 bg-slate-900/30 text-xs">
        {!isCollapsed ? (
          <div>
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span className="flex items-center gap-1.5">
                <Server className="w-3 h-3 text-emerald-400" /> Services Ready
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">Local Dev</span>
            </div>
            <div className="text-[10px] text-slate-500">
              FastAPI + PostgreSQL / SQLite
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Services Ready (Local Dev / Cloud)"></span>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Open sidebar (Expand)"
                aria-label="Open sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
