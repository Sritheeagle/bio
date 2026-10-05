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

export default function WorkbenchPage() {
  const [currentView, setCurrentView] = useState<NavView>("overview");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);

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
          storageType={health?.storage.type || "local"}
          health={health}
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

            {currentView === "ecg" && (
              <ECGSection
                activeProject={activeProject}
                onJobStarted={() => reloadJobs()}
              />
            )}

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
    </div>
  );
}
