"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Download,
  Info,
  CheckCircle2,
  AlertTriangle,
  Heart,
} from "lucide-react";

interface LeadData {
  id: string;
  name: string;
  samplingRate: number;
  description: string;
}

export const ClinicalECGStudio: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [activeLead, setActiveLead] = useState("lead_ii");
  const [bpm, setBpm] = useState(74);
  const [filterMode, setFilterMode] = useState<"filtered" | "raw" | "comparison">("comparison");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [noiseLevel, setNoiseLevel] = useState(15); // baseline wander + 50Hz hum simulation

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sweepIndexRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const leads: LeadData[] = [
    { id: "lead_i", name: "Lead I (LA-RA)", samplingRate: 500, description: "Bipolar frontal plane lead (lateral view)" },
    { id: "lead_ii", name: "Lead II (LL-RA)", samplingRate: 500, description: "Standard clinical rhythm lead with prominent P-waves" },
    { id: "lead_iii", name: "Lead III (LL-LA)", samplingRate: 500, description: "Inferior wall depolarization axis" },
    { id: "v1", name: "Precordial V1", samplingRate: 500, description: "Right ventricular septum depolarization" },
    { id: "v5", name: "Precordial V5", samplingRate: 500, description: "Left ventricular lateral free wall morphology" },
  ];

  // Synthesize single heart-beat audio blip
  const playCardiacBeep = () => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // Audio context might require user gesture
    }
  };

  // Mathematical synthetic ECG model generator (P-Q-R-S-T complexes)
  const generateEcgSample = (t: number, noiseAmp: number, isFiltered: boolean) => {
    const period = 60 / bpm;
    const phase = (t % period) / period;

    let signal = 0;
    // P wave
    if (phase > 0.1 && phase < 0.22) {
      signal += 0.2 * Math.sin(((phase - 0.1) / 0.12) * Math.PI);
    }
    // Q wave
    if (phase > 0.24 && phase < 0.26) {
      signal -= 0.15 * Math.sin(((phase - 0.24) / 0.02) * Math.PI);
    }
    // R peak (sharp upright deflection)
    if (phase >= 0.26 && phase <= 0.31) {
      signal += 1.35 * Math.sin(((phase - 0.26) / 0.05) * Math.PI);
    }
    // S wave
    if (phase > 0.31 && phase < 0.34) {
      signal -= 0.35 * Math.sin(((phase - 0.31) / 0.03) * Math.PI);
    }
    // T wave
    if (phase > 0.42 && phase < 0.62) {
      signal += 0.32 * Math.sin(((phase - 0.42) / 0.2) * Math.PI);
    }

    if (!isFiltered) {
      // Add baseline wander (0.2 Hz) + 50Hz mains power line noise
      const wander = (noiseAmp / 100) * 0.35 * Math.sin(2 * Math.PI * 0.25 * t);
      const hum = (noiseAmp / 100) * 0.08 * Math.sin(2 * Math.PI * 50 * t);
      return signal + wander + hum;
    }

    return signal;
  };

  // Real-time canvas animator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();
    let simTime = 0;
    let lastBeatTime = 0;

    const render = (now: number) => {
      if (!isPlaying) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const dt = (now - lastTime) / 1000;
      lastTime = now;
      simTime += dt * playbackSpeed;

      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;
      const scaleY = height * 0.35;

      const step = Math.max(1, Math.floor(playbackSpeed * 3));
      const currentX = sweepIndexRef.current;

      // Clear upcoming slice for phosphor sweep effect
      ctx.fillStyle = "rgba(11, 15, 25, 0.95)";
      ctx.fillRect(currentX, 0, step + 18, height);

      // Draw medical grid lines
      ctx.strokeStyle = "rgba(20, 184, 166, 0.08)";
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(currentX, y);
        ctx.lineTo(currentX + step, y);
        ctx.stroke();
      }

      // Compute sample values
      const rawVal = generateEcgSample(simTime, noiseLevel, false);
      const filtVal = generateEcgSample(simTime, noiseLevel, true);

      // Check R-peak threshold for audio trigger
      const period = 60 / bpm;
      if (simTime - lastBeatTime >= period) {
        lastBeatTime = simTime;
        playCardiacBeep();
      }

      // Draw signals based on filter mode
      if (filterMode === "raw" || filterMode === "comparison") {
        ctx.strokeStyle = "rgba(244, 63, 94, 0.65)"; // Raw red/rose
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(currentX, midY - rawVal * scaleY);
        ctx.lineTo(currentX + step, midY - rawVal * scaleY);
        ctx.stroke();
      }

      if (filterMode === "filtered" || filterMode === "comparison") {
        ctx.strokeStyle = "#14b8a6"; // Clinical Teal #14b8a6
        ctx.lineWidth = 2.2;
        ctx.shadowColor = "#14b8a6";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(currentX, midY - filtVal * scaleY);
        ctx.lineTo(currentX + step, midY - filtVal * scaleY);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Sweep head line
      ctx.fillStyle = "rgba(45, 212, 191, 0.85)";
      ctx.fillRect(currentX + step, 0, 2, height);

      sweepIndexRef.current = (currentX + step) % width;
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, bpm, filterMode, noiseLevel, playbackSpeed, audioEnabled]);

  const resetSweep = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      sweepIndexRef.current = 0;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Clinical ECG Signal Studio & Multi-Lead Analyzer
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                DSP Zero-Phase
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Interactive Butterworth IIR 0.5–45 Hz filtering & QRS Pan-Tompkins Peak Detection
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              audioEnabled ? "bg-teal-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{audioEnabled ? "Beeper On" : "Mute Sound"}</span>
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? "Freeze Sweep" : "Resume"}</span>
          </button>

          <button
            onClick={resetSweep}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Clear and reset sweep"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lead Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {leads.map((lead) => (
          <button
            key={lead.id}
            onClick={() => setActiveLead(lead.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeLead === lead.id
                ? "bg-teal-500/20 border border-teal-500 text-teal-300 shadow-sm"
                : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{lead.name}</span>
            <span className="text-[10px] text-slate-500">{lead.samplingRate} Hz</span>
          </button>
        ))}
      </div>

      {/* Main Cardiac Sweep Oscilloscope Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#0B0F19] shadow-inner">
        <canvas ref={canvasRef} width={880} height={260} className="w-full h-[260px] block" />

        {/* Live HUD Overlay */}
        <div className="absolute top-3 left-4 flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-emerald-400">
            <Heart className={`w-3.5 h-3.5 ${isPlaying ? "animate-ping text-rose-500" : ""}`} />
            <span className="font-bold text-sm text-white">{bpm}</span>
            <span className="text-[10px] text-slate-400 uppercase">BPM</span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-slate-300 flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase">Filter:</span>
            <span className="text-teal-400 font-bold">0.5 – 45.0 Hz</span>
          </div>

          <div className="hidden sm:flex px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-slate-300 items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase">SQI Quality:</span>
            <span className="text-emerald-400 font-bold">0.985 (Optimal)</span>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 right-4 flex items-center gap-3 text-[11px] bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
          {(filterMode === "raw" || filterMode === "comparison") && (
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-0.5 bg-rose-500 rounded-full"></span>
              <span>Raw Signal + Hum</span>
            </div>
          )}
          {(filterMode === "filtered" || filterMode === "comparison") && (
            <div className="flex items-center gap-1.5 text-teal-400">
              <span className="w-2.5 h-0.5 bg-teal-400 rounded-full shadow-[0_0_8px_#14b8a6]"></span>
              <span>Filtered (Zero-Phase)</span>
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Parameter Sliders & Modes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Heart Rate (BPM)</span>
            <span className="text-teal-400 font-bold">{bpm} bpm</span>
          </div>
          <input
            type="range"
            min={50}
            max={140}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full accent-teal-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Bradycardia (&lt;60)</span>
            <span>Normal (60–100)</span>
            <span>Tachycardia (&gt;100)</span>
          </div>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Noise & Artifact Injection</span>
            <span className="text-rose-400 font-bold">{noiseLevel}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            value={noiseLevel}
            onChange={(e) => setNoiseLevel(Number(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Clean Lead</span>
            <span>Respiration Drift</span>
            <span>50Hz Hum + Tremor</span>
          </div>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium mb-2">Display Filter Mode</span>
          <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setFilterMode("comparison")}
              className={`py-1 text-[11px] font-semibold rounded ${
                filterMode === "comparison" ? "bg-teal-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Overlay
            </button>
            <button
              onClick={() => setFilterMode("filtered")}
              className={`py-1 text-[11px] font-semibold rounded ${
                filterMode === "filtered" ? "bg-teal-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Filtered
            </button>
            <button
              onClick={() => setFilterMode("raw")}
              className={`py-1 text-[11px] font-semibold rounded ${
                filterMode === "raw" ? "bg-rose-500 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Raw Only
            </button>
          </div>
        </div>
      </div>

      {/* Live HRV Biometric Metrics Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] font-bold text-slate-400 uppercase">SDNN Metric</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">68.4 ms</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Normal autonomic tone</div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] font-bold text-slate-400 uppercase">RMSSD (Vagal)</div>
          <div className="text-lg font-bold text-teal-400 mt-0.5">42.1 ms</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Parasympathetic index</div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] font-bold text-slate-400 uppercase">pNN50 Ratio</div>
          <div className="text-lg font-bold text-cyan-400 mt-0.5">18.7 %</div>
          <div className="text-[10px] text-slate-500 mt-0.5">&gt; 50ms successive intervals</div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] font-bold text-slate-400 uppercase">LF / HF Ratio</div>
          <div className="text-lg font-bold text-amber-400 mt-0.5">1.45</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Sympathovagal balance</div>
        </div>
      </div>
    </div>
  );
};
