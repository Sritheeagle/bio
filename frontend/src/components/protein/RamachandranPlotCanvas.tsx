"use client";

import React, { useEffect, useRef } from "react";
import { Dna, ShieldCheck } from "lucide-react";

interface RamachandranProps {
  proteinName: string;
  residueCount: number;
}

export const RamachandranPlotCanvas: React.FC<RamachandranProps> = ({ proteinName, residueCount }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverAngle, setHoverAngle] = React.useState<{ phi: number; psi: number; region: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const margin = 32;
    const plotWidth = width - margin * 2;
    const plotHeight = height - margin * 2;

    ctx.clearRect(0, 0, width, height);

    // Deep dark background
    ctx.fillStyle = "#0B0F19";
    ctx.fillRect(0, 0, width, height);

    // Coordinate conversion (-180 to +180)
    const toScreenX = (deg: number) => margin + ((deg + 180) / 360) * plotWidth;
    const toScreenY = (deg: number) => height - margin - ((deg + 180) / 360) * plotHeight;

    // 1. Draw Favored Energy Regions (Contours)
    // Beta-Sheet Favored Region: phi around -140, psi around +135
    ctx.fillStyle = "rgba(20, 184, 166, 0.22)";
    ctx.beginPath();
    ctx.ellipse(toScreenX(-135), toScreenY(135), 45, 40, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(20, 184, 166, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Right-handed Alpha-Helix: phi around -65, psi around -40
    ctx.fillStyle = "rgba(139, 92, 246, 0.24)";
    ctx.beginPath();
    ctx.ellipse(toScreenX(-65), toScreenY(-40), 40, 35, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
    ctx.stroke();

    // Left-handed Alpha-Helix: phi around +60, psi around +45
    ctx.fillStyle = "rgba(245, 158, 11, 0.18)";
    ctx.beginPath();
    ctx.ellipse(toScreenX(60), toScreenY(45), 25, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
    ctx.stroke();

    // 2. Axes & Crosshairs (0, 0)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;

    // Zero crosshairs
    const zeroX = toScreenX(0);
    const zeroY = toScreenY(0);
    ctx.beginPath();
    ctx.moveTo(zeroX, margin);
    ctx.lineTo(zeroX, height - margin);
    ctx.moveTo(margin, zeroY);
    ctx.lineTo(width - margin, zeroY);
    ctx.stroke();

    // Grid ticks (-180, -90, 0, 90, 180)
    ctx.fillStyle = "#64748b";
    ctx.font = "9px JetBrains Mono, monospace";
    const ticks = [-180, -90, 0, 90, 180];
    ticks.forEach((deg) => {
      const x = toScreenX(deg);
      const y = toScreenY(deg);
      // X axis
      ctx.textAlign = "center";
      ctx.fillText(`${deg}°`, x, height - margin + 12);
      // Y axis
      ctx.textAlign = "right";
      ctx.fillText(`${deg}°`, margin - 4, y + 3);
    });

    // 3. Scatter Plot Residue Dihedral Points (Phi, Psi)
    for (let i = 0; i < residueCount; i++) {
      let phi: number;
      let psi: number;

      // Group residues by secondary structure bias
      if (i % 14 < 7) {
        // Alpha-helix cluster
        phi = -65 + (Math.sin(i * 1.5) * 12) + ((Math.random() - 0.5) * 14);
        psi = -40 + (Math.cos(i * 1.5) * 12) + ((Math.random() - 0.5) * 14);
      } else if (i % 14 < 11) {
        // Beta-sheet cluster
        phi = -135 + (Math.sin(i * 1.8) * 18) + ((Math.random() - 0.5) * 16);
        psi = 135 + (Math.cos(i * 1.8) * 18) + ((Math.random() - 0.5) * 16);
      } else {
        // Flexible loop or coil
        phi = -80 + (Math.sin(i * 2.1) * 45);
        psi = 40 + (Math.cos(i * 2.1) * 60);
      }

      const px = toScreenX(phi);
      const py = toScreenY(psi);

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = i % 14 < 7 ? "#c084fc" : (i % 14 < 11 ? "#2dd4bf" : "#fbbf24");
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Hover Crosshairs
    if (hoverAngle) {
      const hx = toScreenX(hoverAngle.phi);
      const hy = toScreenY(hoverAngle.psi);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
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
      ctx.fillStyle = "#a855f7";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Axis titles
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Plus Jakarta Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Phi (Φ) Backbone Dihedral", width / 2, height - 4);

    ctx.save();
    ctx.translate(11, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Psi (Ψ) Backbone Dihedral", 0, 0);
    ctx.restore();
  }, [proteinName, residueCount, hoverAngle]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const margin = 32;
    const plotWidth = canvas.width - margin * 2;
    const plotHeight = canvas.height - margin * 2;

    const phi = -180 + ((x - margin) / plotWidth) * 360;
    const psi = -180 + ((canvas.height - margin - y) / plotHeight) * 360;

    if (phi >= -180 && phi <= 180 && psi >= -180 && psi <= 180) {
      let region = "General Allowed";
      if (phi < 0 && psi > 60) {
        region = "β-Sheet Favored";
      } else if (phi >= -110 && phi <= -30 && psi >= -80 && psi <= 0) {
        region = "Right α-Helix Favored";
      } else if (phi >= 20 && phi <= 90 && psi >= 10 && psi <= 80) {
        region = "Left α-Helix Allowed";
      } else if (phi > 0 && psi < 0) {
        region = "Disallowed / Steric Clash";
      }
      setHoverAngle({ phi: Math.round(phi), psi: Math.round(psi), region });
    } else {
      setHoverAngle(null);
    }
  };

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4 text-violet-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Ramachandran Plot (Φ vs Ψ Dihedrals)
          </h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold">
          Stereochemistry
        </span>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-800/80 flex justify-center bg-[#0B0F19] group">
        <canvas
          ref={canvasRef}
          width={340}
          height={220}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverAngle(null)}
          className="w-full max-w-[340px] h-[220px] block cursor-crosshair"
        />

        {hoverAngle && (
          <div className="absolute top-2 right-2 bg-slate-900/95 backdrop-blur-xs border border-violet-500/40 px-2.5 py-1 rounded-md text-[10px] font-mono text-violet-300 pointer-events-none shadow-md">
            <span>Φ: {hoverAngle.phi}°</span> · <span>Ψ: {hoverAngle.psi}°</span>
            <span className="block text-[9px] text-teal-400 font-sans font-bold">{hoverAngle.region}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 font-mono text-center">
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
          <span className="text-teal-400 block font-bold text-xs">95.2%</span>
          <span className="text-slate-500 text-[9px]">Core Favored</span>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
          <span className="text-violet-400 block font-bold text-xs">4.2%</span>
          <span className="text-slate-500 text-[9px]">Allowed</span>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
          <span className="text-amber-400 block font-bold text-xs">0.6%</span>
          <span className="text-slate-500 text-[9px]">Outliers</span>
        </div>
      </div>
    </div>
  );
};
