"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User, Project, Job, HealthInfo } from "../types";
import { api } from "../lib/api";
import { Header } from "../components/layout/Header";
import { Sidebar, NavView } from "../components/layout/Sidebar";
import { OverviewDashboard } from "../components/dashboard/OverviewDashboard";
import { ECGSection } from "../components/ecg/ECGSection";
import { ProteinSection } from "../components/protein/ProteinSection";
import { JobsTable } from "../components/jobs/JobsTable";
import { AdminSection } from "../components/admin/AdminSection";
import { SettingsSection } from "../components/settings/SettingsSection";
import { AuthModal } from "../components/auth/AuthModal";
import { ProjectModal } from "../components/projects/ProjectModal";
import { JobDetailModal } from "../components/jobs/JobDetailModal";
import { ClinicalECGStudio } from "../components/ecg/ClinicalECGStudio";
import { Protein3DStudio } from "../components/protein/Protein3DStudio";
import { BioCopilotModal } from "../components/copilot/BioCopilotModal";
import { CommandPaletteModal } from "../components/layout/CommandPaletteModal";
import { Bot } from "lucide-react";

export default function WorkbenchPage() {
  const [currentView, setCurrentView] = useState<NavView>("overview");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);

  // Collapsible Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("biocloud_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("biocloud_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);

  // Global Keyboard Shortcuts (Ctrl+B / Cmd+B for sidebar, Ctrl+K / Cmd+K for command palette, Ctrl+J for copilot)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      // Ctrl+B or Cmd+B to toggle sidebar collapse
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleSidebar();
        return;
      }

      // Ctrl+K or Cmd+K to toggle Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl+J or Cmd+J to toggle BioCopilot
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
        return;
      }

      // Quick numbers 1-6 when not focused on an input field
      if (!isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "1") setCurrentView("overview");
        else if (e.key === "2") setCurrentView("ecg-studio");
        else if (e.key === "3") setCurrentView("protein-studio");
        else if (e.key === "4") setCurrentView("ecg");
        else if (e.key === "5") setCurrentView("protein");
        else if (e.key === "6") setCurrentView("jobs");
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Load initial health, user, and projects
  const initSession = useCallback(async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch (e) {
      console.error("Health check error:", e);
    }

    try {
      const user = await api.getMe();
      setCurrentUser(user);
    } catch {
      // If no valid session, auto-login default researcher in local dev mode
      try {
        await api.login("researcher@biocloud.local", "Researcher123!");
        const user = await api.getMe();
        setCurrentUser(user);
      } catch (err) {
        console.error("Default researcher auto-login error:", err);
      }
    }

    try {
      const pList = await api.listProjects();
      setProjects(pList);
      if (pList.length > 0) {
        setActiveProject(pList[0]);
      }
    } catch (e) {
      console.error("Projects load error:", e);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Load jobs whenever active project changes
  const reloadJobs = useCallback(async () => {
    if (!activeProject) return;
    try {
      const jList = await api.listJobs(activeProject.id);
      setJobs(jList);
    } catch (e) {
      console.error("Jobs load error:", e);
    }
  }, [activeProject]);

  useEffect(() => {
    reloadJobs();
    const interval = setInterval(reloadJobs, 4000);
    return () => clearInterval(interval);
  }, [reloadJobs]);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setIsAuthOpen(true);
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await api.cancelJob(jobId);
      reloadJobs();
    } catch (err: any) {
      alert(err.message || "Failed to cancel job");
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.retryJob(jobId);
      reloadJobs();
    } catch (err: any) {
      alert(err.message || "Failed to retry job");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        currentUser={currentUser}
        activeProject={activeProject}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentUser={currentUser}
          projects={projects}
          activeProject={activeProject}
          onSelectProject={(p) => setActiveProject(p)}
          onOpenNewProject={() => setIsProjectModalOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
          onOpenCopilot={() => setIsCopilotOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          storageType={health?.storage.type || "local"}
          health={health}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {currentView === "overview" && (
              <OverviewDashboard
                jobs={jobs}
                projects={projects}
                activeProject={activeProject}
                health={health}
                onNavigate={(v) => setCurrentView(v)}
                onSelectJob={(j) => setDetailJob(j)}
              />
            )}

            {currentView === "ecg-studio" && <ClinicalECGStudio />}

            {currentView === "ecg" && (
              <ECGSection
                activeProject={activeProject}
                onJobStarted={() => reloadJobs()}
              />
            )}

            {currentView === "protein-studio" && <Protein3DStudio />}

            {currentView === "protein" && (
              <ProteinSection
                activeProject={activeProject}
                onJobStarted={() => reloadJobs()}
              />
            )}

            {currentView === "jobs" && (
              <JobsTable
                jobs={jobs}
                activeProject={activeProject}
                onRefresh={reloadJobs}
                onSelectJob={(j) => setDetailJob(j)}
                onCancelJob={handleCancelJob}
                onRetryJob={handleRetryJob}
              />
            )}

            {currentView === "settings" && <SettingsSection health={health} />}

            {currentView === "admin" && <AdminSection />}
          </div>
        </main>
      </div>

      {/* Floating BioCopilot Trigger Button */}
      <button
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3.5 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-slate-950 font-bold shadow-2xl flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
        title="Open BioCopilot AI Research Assistant"
      >
        <Bot className="w-5 h-5" />
        <span className="text-xs font-extrabold pr-1 hidden sm:inline">BioCopilot AI</span>
        <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
      </button>

      {/* BioCopilot Modal */}
      <BioCopilotModal isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          initSession();
        }}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onProjectCreated={(newProj) => {
          setProjects((prev) => [newProj, ...prev]);
          setActiveProject(newProj);
        }}
      />

      <JobDetailModal
        job={detailJob}
        onClose={() => setDetailJob(null)}
        onCancelJob={handleCancelJob}
        onRetryJob={handleRetryJob}
      />

      {/* Spotlight Command Palette */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(v) => setCurrentView(v)}
        onToggleSidebar={handleToggleSidebar}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        isSidebarCollapsed={isSidebarCollapsed}
      />
    </div>
  );
}
