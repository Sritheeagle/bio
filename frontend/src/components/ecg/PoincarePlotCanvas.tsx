"use client";

import React, { useEffect, useRef } from "react";
import { Activity, Sparkles, Info } from "lucide-react";

interface PoincarePlotProps {
  bpm: number;
  noiseLevel: number;
}

export const PoincarePlotCanvas: React.FC<PoincarePlotProps> = ({ bpm, noiseLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hoverCoord, setHoverCoord] = React.useState<{ rrN: number; rrNext: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const margin = 35;
    const plotWidth = width - margin * 2;
    const plotHeight = height - margin * 2;

    ctx.clearRect(0, 0, width, height);

    // Dark grid background
    ctx.fillStyle = "#0B0F19";
    ctx.fillRect(0, 0, width, height);

    // Axes bounds (400ms to 1200ms)
    const minRR = 450;
    const maxRR = 1150;
    const toScreenX = (rr: number) => margin + ((rr - minRR) / (maxRR - minRR)) * plotWidth;
    const toScreenY = (rr: number) => height - margin - ((rr - minRR) / (maxRR - minRR)) * plotHeight;

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let rr = 500; rr <= 1100; rr += 150) {
      const x = toScreenX(rr);
      const y = toScreenY(rr);
      // Vertical
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = "#64748b";
      ctx.font = "9px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${rr}`, x, height - margin + 14);
      ctx.textAlign = "right";
      ctx.fillText(`${rr}`, margin - 6, y + 3);
    }

    // Identity line (y = x)
    ctx.strokeStyle = "rgba(45, 212, 191, 0.25)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toScreenX(minRR), toScreenY(minRR));
    ctx.lineTo(toScreenX(maxRR), toScreenY(maxRR));
    ctx.stroke();
    ctx.setLineDash([]);

    // Generate RR intervals based on BPM and noise/arrhythmia dispersion
    const meanRR = (60 / bpm) * 1000;
    const rrPoints: number[] = [];
    const count = 120;

    let curr = meanRR;
    for (let i = 0; i < count; i++) {
      const variability = (noiseLevel / 100) * 180;
      const step = (Math.sin(i * 0.3) * 35) + ((Math.random() - 0.5) * variability);
      curr = Math.max(minRR + 50, Math.min(maxRR - 50, meanRR + step));
      rrPoints.push(curr);
    }

    // Draw Poincaré scatter points (RR_n vs RR_n+1)
    for (let i = 0; i < rrPoints.length - 1; i++) {
      const xVal = rrPoints[i];
      const yVal = rrPoints[i + 1];
      const px = toScreenX(xVal);
      const py = toScreenY(yVal);

      // Gradient color based on distance from identity line
      const dist = Math.abs(xVal - yVal);
      const alpha = Math.max(0.4, 1.0 - dist / 200);

      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(20, 184, 166, ${alpha})`;
      ctx.shadowColor = "#14b8a6";
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // SD1 and SD2 fitted ellipse graphic
    const centerX = toScreenX(meanRR);
    const centerY = toScreenY(meanRR);
    const sd1 = 28 + (noiseLevel / 100) * 45; // Transverse (short-term)
    const sd2 = 65 + (noiseLevel / 100) * 75; // Longitudinal (long-term)

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-Math.PI / 4); // 45 degree tilt along identity line

    ctx.beginPath();
    ctx.ellipse(0, 0, sd2, sd1, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(244, 63, 94, 0.85)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Fill with subtle translucent glow
    ctx.fillStyle = "rgba(244, 63, 94, 0.08)";
    ctx.fill();

    // Draw Orthogonal SD1 and SD2 Axes
    ctx.lineWidth = 1.5;
    // SD2 Longitudinal axis (along identity line)
    ctx.beginPath();
    ctx.moveTo(-sd2, 0);
    ctx.lineTo(sd2, 0);
    ctx.strokeStyle = "rgba(244, 63, 94, 0.9)";
    ctx.stroke();

    // SD1 Transverse axis (perpendicular to identity line)
    ctx.beginPath();
    ctx.moveTo(0, -sd1);
    ctx.lineTo(0, sd1);
    ctx.strokeStyle = "rgba(45, 212, 191, 0.9)";
    ctx.stroke();

    ctx.restore();

    // Hover crosshair and indicator
    if (hoverCoord) {
      const hx = toScreenX(hoverCoord.rrN);
      const hy = toScreenY(hoverCoord.rrNext);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, margin);
      ctx.lineTo(hx, height - margin);
      ctx.moveTo(margin, hy);
      ctx.lineTo(width - margin, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Axis titles
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Plus Jakarta Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RR[n] Interval (ms)", width / 2, height - 6);

    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("RR[n+1] Interval (ms)", 0, 0);
    ctx.restore();
  }, [bpm, noiseLevel, hoverCoord]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const margin = 35;
    const plotWidth = canvas.width - margin * 2;
    const plotHeight = canvas.height - margin * 2;

    const minRR = 450;
    const maxRR = 1150;
    const rrN = minRR + ((x - margin) / plotWidth) * (maxRR - minRR);
    const rrNext = minRR + ((canvas.height - margin - y) / plotHeight) * (maxRR - minRR);

    if (rrN >= minRR && rrN <= maxRR && rrNext >= minRR && rrNext <= maxRR) {
      setHoverCoord({ rrN: Math.round(rrN), rrNext: Math.round(rrNext) });
    } else {
      setHoverCoord(null);
    }
  };

  const calculatedSd1 = 32 + Math.round(noiseLevel * 0.4);
  const calculatedSd2 = 78 + Math.round(noiseLevel * 0.8);
  const autonomicRatio = (calculatedSd2 / calculatedSd1).toFixed(2);

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Poincaré Phase-Space Map (RR[n] vs RR[n+1])
          </h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold">
          SD1 / SD2 Ellipse
        </span>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-800/80 flex justify-center bg-[#0B0F19] group">
        <canvas
          ref={canvasRef}
          width={340}
          height={220}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCoord(null)}
          className="w-full max-w-[340px] h-[220px] block cursor-crosshair"
        />

        {hoverCoord && (
          <div className="absolute top-2 right-2 bg-slate-900/90 backdrop-blur-xs border border-cyan-500/40 px-2 py-1 rounded-md text-[10px] font-mono text-cyan-300 pointer-events-none shadow-md">
            <span>RR[n]: {hoverCoord.rrN}ms</span> · <span>RR[n+1]: {hoverCoord.rrNext}ms</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 font-mono">
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 text-center">
          <span className="text-slate-500 block text-[9px]">SD1 (Parasympathetic):</span>
          <span className="text-teal-300 font-bold text-xs">{calculatedSd1} ms</span>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 text-center">
          <span className="text-slate-500 block text-[9px]">SD2 (Sympathetic):</span>
          <span className="text-rose-400 font-bold text-xs">{calculatedSd2} ms</span>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 text-center">
          <span className="text-slate-500 block text-[9px]">SD2/SD1 Ratio:</span>
          <span className="text-amber-400 font-bold text-xs">{autonomicRatio}</span>
        </div>
      </div>
    </div>
  );
};
