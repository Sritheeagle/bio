"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  LayoutDashboard,
  Activity,
  Dna,
  History,
  Settings,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRight,
  Sparkles,
  Command,
  X,
} from "lucide-react";
import { NavView } from "./Sidebar";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: NavView) => void;
  onToggleSidebar: () => void;
  onOpenCopilot: () => void;
  isSidebarCollapsed: boolean;
}

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Real-Time Studios" | "Tools & AI" | "Controls";
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onToggleSidebar,
  onOpenCopilot,
  isSidebarCollapsed,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: "nav-overview",
      title: "Overview Dashboard",
      category: "Navigation",
      icon: <LayoutDashboard className="w-4 h-4 text-slate-400" />,
      shortcut: "1",
      action: () => {
        onNavigate("overview");
        onClose();
      },
    },
    {
      id: "nav-ecg-studio",
      title: "Clinical ECG Live Studio (500Hz DSP & Poincaré & Welch PSD)",
      category: "Real-Time Studios",
      icon: <Activity className="w-4 h-4 text-teal-400" />,
      shortcut: "2",
      action: () => {
        onNavigate("ecg-studio");
        onClose();
      },
    },
    {
      id: "nav-protein-studio",
      title: "Protein 3D Structure Studio (Mol* & Ramachandran & Contact Matrix)",
      category: "Real-Time Studios",
      icon: <Dna className="w-4 h-4 text-violet-400" />,
      shortcut: "3",
      action: () => {
        onNavigate("protein-studio");
        onClose();
      },
    },
    {
      id: "nav-ecg-batch",
      title: "ECG Batch Analytics & Arrhythmia Classification",
      category: "Navigation",
      icon: <Activity className="w-4 h-4 text-teal-500" />,
      shortcut: "4",
      action: () => {
        onNavigate("ecg");
        onClose();
      },
    },
    {
      id: "nav-protein-batch",
      title: "Protein Structure Pipeline (ESMFold & AlphaFold)",
      category: "Navigation",
      icon: <Dna className="w-4 h-4 text-violet-500" />,
      shortcut: "5",
      action: () => {
        onNavigate("protein");
        onClose();
      },
    },
    {
      id: "nav-jobs",
      title: "Job History & Provenance Audit Logs",
      category: "Navigation",
      icon: <History className="w-4 h-4 text-amber-400" />,
      shortcut: "6",
      action: () => {
        onNavigate("jobs");
        onClose();
      },
    },
    {
      id: "tool-copilot",
      title: "Open BioCopilot AI Research Assistant",
      category: "Tools & AI",
      icon: <Bot className="w-4 h-4 text-cyan-400" />,
      shortcut: "Ctrl+J",
      action: () => {
        onOpenCopilot();
        onClose();
      },
    },
    {
      id: "ctrl-toggle-sidebar",
      title: isSidebarCollapsed ? "Expand Sidebar (Open)" : "Collapse Sidebar (Close)",
      category: "Controls",
      icon: isSidebarCollapsed ? (
        <PanelLeftOpen className="w-4 h-4 text-teal-400" />
      ) : (
        <PanelLeftClose className="w-4 h-4 text-slate-400" />
      ),
      shortcut: "Ctrl+B",
      action: () => {
        onToggleSidebar();
        onClose();
      },
    },
    {
      id: "nav-settings",
      title: "Architecture & Infrastructure Settings",
      category: "Navigation",
      icon: <Settings className="w-4 h-4 text-slate-400" />,
      action: () => {
        onNavigate("settings");
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation within palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <Search className="w-5 h-5 text-teal-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or jump to studio... (Press Esc to close)"
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-hidden"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching commands found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? "bg-teal-500/20 text-white border border-teal-500/40"
                      : "text-slate-300 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">{cmd.icon}</span>
                    <div className="truncate">
                      <div className="font-semibold text-slate-100 truncate">{cmd.title}</div>
                      <div className="text-[10px] text-slate-400">{cmd.category}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cmd.shortcut && (
                      <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? "text-teal-400" : "text-transparent"}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">Enter</kbd> select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">Esc</kbd> close
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-teal-400 font-semibold">
            <Command className="w-3.5 h-3.5" />
            <span>BioCloud Spotlight</span>
          </div>
        </div>
      </div>
    </div>
  );
};
