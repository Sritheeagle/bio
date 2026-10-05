"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Zap, HelpCircle, Activity } from "lucide-react";

interface EcgFrequencySpectrumCanvasProps {
  bpm?: number;
  noiseLevel?: number;
  showHelpTooltip?: boolean;
}

export const EcgFrequencySpectrumCanvas: React.FC<EcgFrequencySpectrumCanvasProps> = ({
  bpm = 74,
  noiseLevel = 15,
  showHelpTooltip = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    freq: number;
    power: number;
    band: string;
    x: number;
    y: number;
  } | null>(null);

  // Compute Welch PSD frequency curve and power values
  const spectrumData = useMemo(() => {
    const points: Array<{ f: number; p: number }> = [];
    const df = 0.002;
    const maxF = 0.50;

    // Respiration frequency linked to BPM (~1 breath per 4-5 heart beats)
    const respFreq = Math.min(0.35, Math.max(0.18, (bpm / 60) * 0.22));
    const baroFreq = 0.095; // Mayer wave ~ 0.1 Hz

    let totalPower = 0;
    let vlfPower = 0;
    let lfPower = 0;
    let hfPower = 0;

    for (let f = 0.002; f <= maxF; f += df) {
      // 1/f pink noise baseline in VLF
      const vlfBase = 320 / (1 + Math.pow(f / 0.02, 1.8));

      // LF gaussian peak around baroreflex frequency (0.09-0.10 Hz)
      const lfWidth = 0.025;
      const lfAmp = 750 + (noiseLevel * 6);
      const lfPeak = lfAmp * Math.exp(-Math.pow(f - baroFreq, 2) / (2 * Math.pow(lfWidth, 2)));

      // HF gaussian peak around respiratory frequency (0.22-0.28 Hz)
      const hfWidth = 0.035;
      const hfAmp = 520 + ((75 - bpm) * 8);
      const hfPeak = hfAmp * Math.exp(-Math.pow(f - respFreq, 2) / (2 * Math.pow(hfWidth, 2)));

      // High frequency noise tail
      const noise = (noiseLevel * 0.8) * Math.sin(f * 80) * Math.cos(f * 45);

      const p = Math.max(8, vlfBase + lfPeak + hfPeak + noise);
      points.push({ f, p });

      // Integrate discrete power bands
      const bandPower = p * df * 1000; // scaling to ms^2
      totalPower += bandPower;
      if (f < 0.04) {
        vlfPower += bandPower;
      } else if (f < 0.15) {
        lfPower += bandPower;
      } else if (f <= 0.40) {
        hfPower += bandPower;
      }
    }

    const lfHfRatio = hfPower > 0 ? lfPower / hfPower : 1.0;
    const lfNu = (lfPower / (totalPower - vlfPower)) * 100;
    const hfNu = (hfPower / (totalPower - vlfPower)) * 100;

    return {
      points,
      totalPower: Math.round(totalPower),
      vlfPower: Math.round(vlfPower),
      lfPower: Math.round(lfPower),
      hfPower: Math.round(hfPower),
      lfHfRatio: Number(lfHfRatio.toFixed(2)),
      lfNu: Number(lfNu.toFixed(1)),
      hfNu: Number(hfNu.toFixed(1)),
      peakLf: baroFreq,
      peakHf: Number(respFreq.toFixed(3)),
    };
  }, [bpm, noiseLevel]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Retina DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padLeft = 46;
    const padRight = 16;
    const padTop = 22;
    const padBottom = 34;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const maxF = 0.50;
    const maxP = 1200;

    const xToPx = (f: number) => padLeft + (f / maxF) * plotW;
    const yToPx = (p: number) => padTop + plotH - (p / maxP) * plotH;

    // Background
    ctx.fillStyle = "#020617"; // Slate 950
    ctx.fillRect(0, 0, w, h);

    // Frequency Band Shaded Regions
    // VLF (0.0033 to 0.04 Hz)
    const x0 = xToPx(0);
    const xVlf = xToPx(0.04);
    const xLf = xToPx(0.15);
    const xHf = xToPx(0.40);
    const xEnd = xToPx(maxF);

    ctx.fillStyle = "rgba(99, 102, 241, 0.12)"; // Indigo VLF
    ctx.fillRect(x0, padTop, xVlf - x0, plotH);

    ctx.fillStyle = "rgba(20, 184, 166, 0.15)"; // Teal LF
    ctx.fillRect(xVlf, padTop, xLf - xVlf, plotH);

    ctx.fillStyle = "rgba(16, 185, 129, 0.12)"; // Emerald HF
    ctx.fillRect(xLf, padTop, xHf - xLf, plotH);

    ctx.fillStyle = "rgba(100, 116, 139, 0.05)"; // High-freq tail
    ctx.fillRect(xHf, padTop, xEnd - xHf, plotH);

    // Band Divider Lines & Labels
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.setLineDash([4, 4]);
    [xVlf, xLf, xHf].forEach((xPos) => {
      ctx.beginPath();
      ctx.moveTo(xPos, padTop);
      ctx.lineTo(xPos, padTop + plotH);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Band Titles Top
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#818cf8"; // Indigo text
    ctx.fillText("VLF (0-0.04)", (x0 + xVlf) / 2, padTop - 6);

    ctx.fillStyle = "#2dd4bf"; // Teal text
    ctx.fillText("LF (0.04-0.15)", (xVlf + xLf) / 2, padTop - 6);

    ctx.fillStyle = "#34d399"; // Emerald text
    ctx.fillText("HF (0.15-0.40)", (xLf + xHf) / 2, padTop - 6);

    ctx.fillStyle = "#64748b";
    ctx.fillText("VHF", (xHf + xEnd) / 2, padTop - 6);

    // Grid lines
    ctx.strokeStyle = "rgba(51, 65, 85, 0.35)";
    ctx.lineWidth = 1;
    // Horizontal power grid
    [200, 400, 600, 800, 1000].forEach((pVal) => {
      const yPos = yToPx(pVal);
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(w - padRight, yPos);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${pVal}`, padLeft - 6, yPos + 3);
    });

    // Vertical frequency grid
    [0.1, 0.2, 0.3, 0.4].forEach((fVal) => {
      const xPos = xToPx(fVal);
      ctx.beginPath();
      ctx.moveTo(xPos, padTop);
      ctx.lineTo(xPos, padTop + plotH);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${fVal}Hz`, xPos, padTop + plotH + 14);
    });

    // Outer border
    ctx.strokeStyle = "rgba(51, 65, 85, 0.8)";
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // Draw Filled Area under Power Spectral Density curve
    if (spectrumData.points.length > 1) {
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
      grad.addColorStop(0, "rgba(45, 212, 191, 0.45)");
      grad.addColorStop(1, "rgba(45, 212, 191, 0.02)");

      ctx.beginPath();
      ctx.moveTo(xToPx(spectrumData.points[0].f), yToPx(0));
      spectrumData.points.forEach((pt) => {
        ctx.lineTo(xToPx(pt.f), yToPx(pt.p));
      });
      ctx.lineTo(xToPx(spectrumData.points[spectrumData.points.length - 1].f), yToPx(0));
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke PSD line
      ctx.beginPath();
      spectrumData.points.forEach((pt, i) => {
        const x = xToPx(pt.f);
        const y = yToPx(pt.p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#2dd4bf"; // Bright teal
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Peak markers
    // LF Peak
    const lfPeakX = xToPx(spectrumData.peakLf);
    const lfPt = spectrumData.points.find((p) => Math.abs(p.f - spectrumData.peakLf) < 0.005);
    if (lfPt) {
      const lfPeakY = yToPx(lfPt.p);
      ctx.beginPath();
      ctx.arc(lfPeakX, lfPeakY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "#f59e0b"; // Amber marker
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // HF Peak
    const hfPeakX = xToPx(spectrumData.peakHf);
    const hfPt = spectrumData.points.find((p) => Math.abs(p.f - spectrumData.peakHf) < 0.005);
    if (hfPt) {
      const hfPeakY = yToPx(hfPt.p);
      ctx.beginPath();
      ctx.arc(hfPeakX, hfPeakY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "#10b981"; // Emerald marker
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Interactive Hover Crosshair
    if (hoveredPoint) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "#38bdf8"; // Sky blue crosshair
      ctx.lineWidth = 1;

      // Vertical
      ctx.beginPath();
      ctx.moveTo(hoveredPoint.x, padTop);
      ctx.lineTo(hoveredPoint.x, padTop + plotH);
      ctx.stroke();

      // Horizontal
      ctx.beginPath();
      ctx.moveTo(padLeft, hoveredPoint.y);
      ctx.lineTo(padLeft + plotW, hoveredPoint.y);
      ctx.stroke();

      ctx.setLineDash([]);

      // Point circle
      ctx.beginPath();
      ctx.arc(hoveredPoint.x, hoveredPoint.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Axis Labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Frequency (Hz)", padLeft + plotW / 2, h - 6);

    // Y Axis rotated
    ctx.save();
    ctx.translate(12, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Power (ms²/Hz)", 0, 0);
    ctx.restore();
  }, [spectrumData, hoveredPoint]);

  // Mouse move handler for live inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 46;
    const padRight = 16;
    const padTop = 22;
    const padBottom = 34;
    const plotW = rect.width - padLeft - padRight;
    const plotH = rect.height - padTop - padBottom;

    if (x < padLeft || x > padLeft + plotW || y < padTop || y > padTop + plotH) {
      setHoveredPoint(null);
      return;
    }

    const maxF = 0.50;
    const maxP = 1200;
    const freq = ((x - padLeft) / plotW) * maxF;

    // Find nearest point
    let nearest = spectrumData.points[0];
    let minDiff = 999;
    for (const pt of spectrumData.points) {
      const diff = Math.abs(pt.f - freq);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = pt;
      }
    }

    let band = "High Frequency Tail";
    if (nearest.f < 0.04) band = "VLF (Very Low Frequency)";
    else if (nearest.f < 0.15) band = "LF (Low Frequency - Baroreflex)";
    else if (nearest.f <= 0.40) band = "HF (High Frequency - Vagal/RSA)";

    setHoveredPoint({
      freq: Number(nearest.f.toFixed(3)),
      power: Math.round(nearest.p),
      band,
      x,
      y: padTop + plotH - (nearest.p / maxP) * plotH,
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const interpretation = useMemo(() => {
    const ratio = spectrumData.lfHfRatio;
    if (ratio < 0.9) return { label: "Parasympathetic Dominance", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (ratio <= 2.2) return { label: "Balanced Autonomic Tone", color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" };
    return { label: "Sympathetic Dominance / Stress", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
  }, [spectrumData.lfHfRatio]);

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-white flex flex-col justify-between shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
              HRV Spectral Power (Welch Periodogram)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              Frequency Domain Analysis &bull; 0.00 to 0.50 Hz
            </span>
          </div>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${interpretation.bg} ${interpretation.color}`}>
          {interpretation.label}
        </span>
      </div>

      {/* Main Canvas with interactive hover */}
      <div className="relative w-full h-56 rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-crosshair block"
        />

        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 border border-teal-500/50 rounded-lg p-2 text-[10px] shadow-xl backdrop-blur-xs font-mono"
            style={{
              left: Math.min(hoveredPoint.x + 12, 170),
              top: Math.max(10, hoveredPoint.y - 45),
            }}
          >
            <div className="text-teal-300 font-bold">{hoveredPoint.band}</div>
            <div className="text-slate-200">f: <span className="text-white font-bold">{hoveredPoint.freq} Hz</span></div>
            <div className="text-slate-200">PSD: <span className="text-amber-400 font-bold">{hoveredPoint.power} ms²/Hz</span></div>
          </div>
        )}
      </div>

      {/* HRV Frequency-Domain Spectral Power Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-900 text-[11px]">
        <div className="bg-slate-900/80 p-2 rounded-lg border border-indigo-500/20">
          <div className="text-[9px] font-bold uppercase text-indigo-300">VLF Power (&lt;0.04Hz)</div>
          <div className="text-sm font-bold font-mono text-indigo-200 mt-0.5">{spectrumData.vlfPower} ms²</div>
          <div className="text-[9px] text-slate-400">Thermoregulation</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-lg border border-teal-500/20">
          <div className="text-[9px] font-bold uppercase text-teal-300">LF Power (0.04-0.15Hz)</div>
          <div className="text-sm font-bold font-mono text-teal-200 mt-0.5">{spectrumData.lfPower} ms²</div>
          <div className="text-[9px] text-teal-400 font-mono">LFnu: {spectrumData.lfNu}%</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-lg border border-emerald-500/20">
          <div className="text-[9px] font-bold uppercase text-emerald-300">HF Power (0.15-0.40Hz)</div>
          <div className="text-sm font-bold font-mono text-emerald-200 mt-0.5">{spectrumData.hfPower} ms²</div>
          <div className="text-[9px] text-emerald-400 font-mono">HFnu: {spectrumData.hfNu}% (Vagal)</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-lg border border-amber-500/20">
          <div className="text-[9px] font-bold uppercase text-amber-300">LF / HF Ratio</div>
          <div className="text-sm font-bold font-mono text-amber-200 mt-0.5">{spectrumData.lfHfRatio}</div>
          <div className="text-[9px] text-slate-400">Target: 1.0 - 2.0</div>
        </div>
      </div>
    </div>
  );
};
