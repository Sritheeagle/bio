"use client";

import React, { useState } from "react";
import { api } from "../../lib/api";
import { User } from "../../types";
import { X, Lock, Mail, Shield, User as UserIcon, AlertCircle } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const targetEmail = customEmail || email;
    const targetPassword = customPassword || password;

    try {
      await api.login(targetEmail, targetPassword);
      const user = await api.getMe();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sign in to BioCloud Workbench</h2>
            <p className="text-xs text-slate-500 mt-0.5">Access your research projects and analysis pipelines</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200/60 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Demo Logins */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Quick Local Development Sign-in
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleLogin(undefined, "researcher@biocloud.local", "Researcher123!")}
                className="p-3 text-left rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-50 transition-all text-teal-950 group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserIcon className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold">Researcher</span>
                </div>
                <div className="text-[11px] text-teal-700 truncate">Dr. Jane Doe</div>
                <div className="text-[10px] text-teal-600/80 mt-1">Submit & view jobs</div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleLogin(undefined, "admin@biocloud.local", "Admin123!")}
                className="p-3 text-left rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50 transition-all text-indigo-950 group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-indigo-700" />
                  <span className="text-xs font-bold">Administrator</span>
                </div>
                <div className="text-[11px] text-indigo-700 truncate">BioCloud Admin</div>
                <div className="text-[10px] text-indigo-600/80 mt-1">Manage users & audit</div>
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 mx-3 text-[11px] text-slate-400 uppercase tracking-wider font-medium">Or enter credentials</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? "Authenticating…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
