"use client";

import React, { useState, useEffect } from "react";
import { User, ModelVersion, AuditEvent } from "../../types";
import { api } from "../../lib/api";
import {
  ShieldAlert,
  Users,
  Cpu,
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export const AdminSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"users" | "models" | "audit">("users");

  const [users, setUsers] = useState<User[]>([]);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, m, a] = await Promise.all([
        api.listUsers(),
        api.listModels(),
        api.listAuditEvents(),
      ]);
      setUsers(u);
      setModels(m);
      setAuditEvents(a);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleUserRole = async (user: User) => {
    const nextRole = user.role === "admin" ? "researcher" : "admin";
    try {
      await api.updateUser(user.id, nextRole);
      setMessage(`Updated ${user.email} role to ${nextRole}`);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update user");
    }
  };

  const handleToggleUserActive = async (user: User) => {
    try {
      await api.updateUser(user.id, undefined, !user.is_active);
      setMessage(`Updated ${user.email} status to ${!user.is_active ? "active" : "inactive"}`);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update user");
    }
  };

  const handleToggleModel = async (model: ModelVersion) => {
    try {
      await api.updateModel(model.id, !model.is_enabled);
      setMessage(`Toggled ${model.name} to ${!model.is_enabled ? "enabled" : "disabled"}`);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update model");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            ADMINISTRATIVE CONSOLE
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Security & System Governance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage user roles, configure scientific pipeline availability, and review security audit logs.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === "users" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
            }`}
          >
            User Access ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("models")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === "models" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
            }`}
          >
            Model Engines ({models.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === "audit" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
            }`}
          >
            Audit Log ({auditEvents.length})
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase font-bold text-slate-400">
                <th className="px-5 py-3">Full Name / Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900">{u.full_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === "admin"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-2">
                    <button
                      onClick={() => handleToggleUserRole(u)}
                      className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 font-medium"
                    >
                      Toggle Role
                    </button>
                    <button
                      onClick={() => handleToggleUserActive(u)}
                      className={`px-2.5 py-1 border rounded-lg font-medium ${
                        u.is_active
                          ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                          : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Models Tab */}
      {activeTab === "models" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-700">
                    {m.workflow_type} · {m.version}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.status === "available"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{m.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {m.is_enabled ? "Enabled for submissions" : "Disabled in UI"}
                </span>
                <button
                  onClick={() => handleToggleModel(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    m.is_enabled
                      ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                      : "bg-teal-600 text-white hover:bg-teal-700"
                  }`}
                >
                  {m.is_enabled ? "Disable Engine" : "Enable Engine"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase font-bold text-slate-400">
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">User / Actor</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Client IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {auditEvents.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(a.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{a.event_type}</td>
                  <td className="px-4 py-3 text-slate-700">{a.user_email || "System"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {a.target_type && `${a.target_type}:${a.target_id?.substring(0, 8)}`}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{a.ip_address || "127.0.0.1"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
