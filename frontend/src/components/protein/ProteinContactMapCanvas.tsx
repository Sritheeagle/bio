"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Dna, Sliders, Info, Sparkles, Layers } from "lucide-react";

interface ResidueInfo {
  index: number;
  code: string;
  name: string;
  plddt: number;
  secStruct: "helix" | "sheet" | "coil";
}

interface ProteinContactMapCanvasProps {
  proteinName: string;
  residues: ResidueInfo[];
}

export const ProteinContactMapCanvas: React.FC<ProteinContactMapCanvasProps> = ({
  proteinName,
  residues,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [threshold, setThreshold] = useState<number>(8.0); // Standard 8.0 Angstrom contact cutoff
  const [viewMode, setViewMode] = useState<"distance" | "binary">("distance");
  const [hoveredPair, setHoveredPair] = useState<{
    i: number;
    j: number;
    dist: number;
    resI: ResidueInfo;
    resJ: ResidueInfo;
    type: string;
    canvasX: number;
    canvasY: number;
  } | null>(null);

  const N = residues.length;

  // Synthesize realistic 3D C-alpha backbone coordinates based on secondary structure & tertiary folding
  const coords3D = useMemo(() => {
    const coords: Array<{ x: number; y: number; z: number }> = [];
    let curX = 0;
    let curY = 0;
    let curZ = 0;

    // Globular core envelope simulation
    const coreRadius = Math.cbrt(N) * 2.8;

    for (let i = 0; i < N; i++) {
      const res = residues[i];
      const theta = (i / N) * 4 * Math.PI;
      const phi = (i / N) * 2 * Math.PI;

      if (res.secStruct === "helix") {
        // Alpha-helix: 3.6 residues per turn, 1.5 Angstroms translation per residue, 2.3 Angstroms radius
        const r = 2.3;
        const angle = i * ((2 * Math.PI) / 3.6);
        curX = (coreRadius * 0.6) * Math.cos(theta) + r * Math.cos(angle);
        curY = (coreRadius * 0.6) * Math.sin(theta) + r * Math.sin(angle);
        curZ = (i * 1.5) - (N * 0.75);
      } else if (res.secStruct === "sheet") {
        // Extended beta-strand: pleated sheet ~3.3 Angstroms per residue, alternate pleating
        const pleat = (i % 2 === 0 ? 1 : -1) * 0.8;
        curX = (coreRadius * 0.7) * Math.cos(theta * 0.8) + pleat;
        curY = (coreRadius * 0.7) * Math.sin(theta * 0.8) - pleat;
        curZ = (i * 3.2 * 0.6) - (N * 0.6);
      } else {
        // Random coil / flexible loop connecting motifs
        curX += (Math.sin(i * 1.3) * 3.8);
        curY += (Math.cos(i * 1.7) * 3.8);
        curZ += (Math.sin(i * 0.9) * 2.5);
      }

      // Compact into globular ellipsoid
      const distFromCenter = Math.sqrt(curX * curX + curY * curY + curZ * curZ);
      if (distFromCenter > coreRadius * 1.8) {
        const factor = (coreRadius * 1.8) / distFromCenter;
        curX *= factor;
        curY *= factor;
        curZ *= factor;
      }

      coords.push({ x: curX, y: curY, z: curZ });
    }
    return coords;
  }, [residues, N]);

  // Compute N x N distance matrix and contact metrics
  const matrixData = useMemo(() => {
    const distances: number[][] = [];
    let totalContacts = 0;
    let longRangeContacts = 0;
    let helixTurnContacts = 0;
    let betaContacts = 0;

    for (let i = 0; i < N; i++) {
      distances[i] = [];
      for (let j = 0; j < N; j++) {
        if (i === j) {
          distances[i][j] = 0;
          continue;
        }
        const dx = coords3D[i].x - coords3D[j].x;
        const dy = coords3D[i].y - coords3D[j].y;
        const dz = coords3D[i].z - coords3D[j].z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        distances[i][j] = Number(d.toFixed(2));

        if (i < j && d <= threshold) {
          totalContacts++;
          const seqSep = Math.abs(i - j);
          if (seqSep >= 12) longRangeContacts++;
          if (seqSep >= 3 && seqSep <= 4) helixTurnContacts++;
          if (residues[i].secStruct === "sheet" && residues[j].secStruct === "sheet" && seqSep >= 5) {
            betaContacts++;
          }
        }
      }
    }

    const possiblePairs = (N * (N - 1)) / 2;
    const contactDensity = possiblePairs > 0 ? (totalContacts / possiblePairs) * 100 : 0;
    const longRangeRatio = totalContacts > 0 ? (longRangeContacts / totalContacts) * 100 : 0;

    return {
      distances,
      totalContacts,
      contactDensity: Number(contactDensity.toFixed(1)),
      longRangeContacts,
      longRangeRatio: Number(longRangeRatio.toFixed(1)),
      helixTurnContacts,
      betaContacts,
    };
  }, [coords3D, N, threshold, residues]);

  // Render Matrix onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padLeft = 32;
    const padTop = 32;
    const padRight = 14;
    const padBottom = 14;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;
    const plotSize = Math.min(plotW, plotH);

    // Background
    ctx.fillStyle = "#020617"; // Slate 950
    ctx.fillRect(0, 0, w, h);

    const cellSize = plotSize / N;

    // Draw Heatmap Cells
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const d = matrixData.distances[i][j];
        const cellX = padLeft + j * cellSize;
        const cellY = padTop + i * cellSize;

        if (viewMode === "binary") {
          // Binary contact mode
          if (i === j) {
            ctx.fillStyle = "#ffffff";
          } else if (d <= threshold) {
            // Color based on sequence separation / contact class
            const sep = Math.abs(i - j);
            if (sep >= 12) ctx.fillStyle = "#f59e0b"; // Long-range: Amber
            else if (sep >= 3 && sep <= 4) ctx.fillStyle = "#a855f7"; // Helical turn: Purple
            else ctx.fillStyle = "#14b8a6"; // Local contact: Teal
          } else {
            ctx.fillStyle = "#090d16"; // Dark slate
          }
        } else {
          // Continuous distance heatmap (0 Angstroms to 24+ Angstroms)
          if (i === j) {
            ctx.fillStyle = "#ffffff";
          } else if (d <= 5.0) {
            ctx.fillStyle = "#22d3ee"; // Close core contact: Bright cyan
          } else if (d <= threshold) {
            ctx.fillStyle = "#0f766e"; // Intermediate contact: Teal
          } else if (d <= 14.0) {
            ctx.fillStyle = "#1e293b"; // Solvent separated: Slate
          } else {
            ctx.fillStyle = "#050811"; // Distant: Deep midnight
          }
        }

        ctx.fillRect(cellX, cellY, Math.max(1, cellSize), Math.max(1, cellSize));
      }
    }

    // Secondary Structure Color Bars along top and left axes
    for (let k = 0; k < N; k++) {
      const res = residues[k];
      let barColor = "#64748b"; // Coil: Slate
      if (res.secStruct === "helix") barColor = "#8b5cf6"; // Alpha-helix: Purple
      if (res.secStruct === "sheet") barColor = "#f59e0b"; // Beta-sheet: Amber

      // Top bar
      ctx.fillStyle = barColor;
      ctx.fillRect(padLeft + k * cellSize, padTop - 10, Math.max(1, cellSize), 6);

      // Left bar
      ctx.fillRect(padLeft - 10, padTop + k * cellSize, 6, Math.max(1, cellSize));
    }

    // Matrix Border
    ctx.strokeStyle = "rgba(71, 85, 105, 0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotSize, plotSize);

    // Diagonal reference line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft + plotSize, padTop + plotSize);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hover Crosshairs
    if (hoveredPair) {
      const hx = padLeft + hoveredPair.j * cellSize + cellSize / 2;
      const hy = padTop + hoveredPair.i * cellSize + cellSize / 2;

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, padTop + plotSize);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(padLeft, hy);
      ctx.lineTo(padLeft + plotSize, hy);
      ctx.stroke();

      ctx.setLineDash([]);

      // Highlight target cell
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(padLeft + hoveredPair.j * cellSize, padTop + hoveredPair.i * cellSize, Math.max(2, cellSize), Math.max(2, cellSize));
    }

    // Labels & Ticks
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("1", padLeft, padTop - 14);
    ctx.fillText(`${N}`, padLeft + plotSize, padTop - 14);

    ctx.textAlign = "right";
    ctx.fillText("1", padLeft - 14, padTop + 8);
    ctx.fillText(`${N}`, padLeft - 14, padTop + plotSize);

    // Axis Labels
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Residue Index j (N → C)", padLeft + plotSize / 2, padTop + plotSize + 12);
  }, [matrixData, viewMode, threshold, residues, N, hoveredPair]);

  // Handle Mouse Hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 32;
    const padTop = 32;
    const padRight = 14;
    const padBottom = 14;
    const plotSize = Math.min(rect.width - padLeft - padRight, rect.height - padTop - padBottom);

    if (x < padLeft || x > padLeft + plotSize || y < padTop || y > padTop + plotSize) {
      setHoveredPair(null);
      return;
    }

    const cellSize = plotSize / N;
    const j = Math.min(N - 1, Math.max(0, Math.floor((x - padLeft) / cellSize)));
    const i = Math.min(N - 1, Math.max(0, Math.floor((y - padTop) / cellSize)));

    const d = matrixData.distances[i][j];
    const resI = residues[i];
    const resJ = residues[j];
    const sep = Math.abs(i - j);

    let type = "Solvent-Exposed Distance";
    if (i === j) type = "Self Backbone (0.0 Å)";
    else if (d <= threshold) {
      if (sep >= 12) type = "Long-Range Tertiary Fold Contact";
      else if (sep >= 3 && sep <= 4) type = "Alpha-Helical Turn Contact (i → i+4)";
      else if (resI.secStruct === "sheet" && resJ.secStruct === "sheet") type = "Beta-Sheet Hairpin / Sheet Interface";
      else type = "Local Backbone Contact";
    }

    setHoveredPair({
      i: i + 1,
      j: j + 1,
      dist: d,
      resI,
      resJ,
      type,
      canvasX: x,
      canvasY: y,
    });
  };

  const handleMouseLeave = () => {
    setHoveredPair(null);
  };

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-white flex flex-col justify-between shadow-xl">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
              Residue Contact Matrix (Cα - Cα Map)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              2D Spatial Topology &bull; {N}&times;{N} Residue Pairs
            </span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode("distance")}
            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
              viewMode === "distance" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Continuous Heatmap
          </button>
          <button
            onClick={() => setViewMode("binary")}
            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
              viewMode === "binary" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            Contact Cutoff
          </button>
        </div>
      </div>

      {/* Threshold Slider Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800/80 mb-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[11px] font-medium">Distance Cutoff:</span>
          <span className="text-[11px] font-bold font-mono text-teal-400">{threshold.toFixed(1)} Å</span>
        </div>
        <input
          type="range"
          min="5.0"
          max="14.0"
          step="0.5"
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="w-36 accent-teal-400 cursor-pointer"
        />
        <div className="text-[10px] text-slate-400 hidden sm:block">
          Standard Cα contact: 8.0 Å
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full aspect-square max-h-[300px] rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-crosshair block"
        />

        {hoveredPair && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 border border-violet-500/50 rounded-lg p-2 text-[10px] shadow-xl backdrop-blur-xs font-mono"
            style={{
              left: Math.min(hoveredPair.canvasX + 12, 160),
              top: Math.max(10, hoveredPair.canvasY - 50),
            }}
          >
            <div className="text-violet-300 font-bold">{hoveredPair.type}</div>
            <div className="text-slate-200">
              #{hoveredPair.i} {hoveredPair.resI.name} ({hoveredPair.resI.code}) &harr; #{hoveredPair.j} {hoveredPair.resJ.name} ({hoveredPair.resJ.code})
            </div>
            <div className="text-teal-300 font-bold">
              Distance: <span className="text-white">{hoveredPair.dist} Å</span> {hoveredPair.dist <= threshold ? "(Contact)" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Topology Statistics Footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-900 text-[11px]">
        <div className="bg-slate-900/80 p-2 rounded-lg border border-teal-500/20">
          <div className="text-[9px] font-bold uppercase text-teal-300">Total Contacts</div>
          <div className="text-sm font-bold font-mono text-teal-200 mt-0.5">{matrixData.totalContacts}</div>
          <div className="text-[9px] text-slate-400">Density: {matrixData.contactDensity}%</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-lg border border-amber-500/20">
          <div className="text-[9px] font-bold uppercase text-amber-300">Long-Range Fold (|i-j|&ge;12)</div>
          <div className="text-sm font-bold font-mono text-amber-200 mt-0.5">{matrixData.longRangeContacts}</div>
          <div className="text-[9px] text-amber-400 font-mono">{matrixData.longRangeRatio}% of contacts</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-lg border border-purple-500/20">
          <div className="text-[9px] font-bold uppercase text-purple-300">Helical Turns (i&plusmn;4)</div>
          <div className="text-sm font-bold font-mono text-purple-200 mt-0.5">{matrixData.helixTurnContacts}</div>
          <div className="text-[9px] text-slate-400">Alpha-helical packing</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-lg border border-indigo-500/20">
          <div className="text-[9px] font-bold uppercase text-indigo-300">Beta-Sheet Contacts</div>
          <div className="text-sm font-bold font-mono text-indigo-200 mt-0.5">{matrixData.betaContacts}</div>
          <div className="text-[9px] text-slate-400">Pleated sheets</div>
        </div>
      </div>
    </div>
  );
};
