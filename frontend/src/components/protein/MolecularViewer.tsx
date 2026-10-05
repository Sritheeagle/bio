"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { RotateCcw, Eye, Play, Pause, Download } from "lucide-react";

interface MolecularViewerProps {
  pdbContent: string;
  meanPlddt?: number;
  ptmScore?: number;
  title?: string;
}

interface AtomRecord {
  serial: number;
  name: string;
  resName: string;
  chain: string;
  resSeq: number;
  x: number;
  y: number;
  z: number;
  bFactor: number; // pLDDT score
}

export const MolecularViewer: React.FC<MolecularViewerProps> = ({
  pdbContent,
  meanPlddt,
  ptmScore,
  title = "Predicted 3D Structure",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderMode, setRenderMode] = useState<"cartoon" | "trace" | "spheres">("cartoon");
  const [isRotating, setIsRotating] = useState(true);

  // Rotation angles (radians)
  const [rotX, setRotX] = useState(0.3);
  const [rotY, setRotY] = useState(0.4);
  const [zoom, setZoom] = useState(1.0);

  const isDragging = useRef(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Parse PDB ATOM records
  const { atoms, center, caAtoms } = useMemo(() => {
    if (!pdbContent) return { atoms: [], center: { x: 0, y: 0, z: 0 }, caAtoms: [] };
    const parsed: AtomRecord[] = [];
    const caOnly: AtomRecord[] = [];

    let sumX = 0, sumY = 0, sumZ = 0;

    for (const line of pdbContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ATOM") || trimmed.startsWith("HETATM")) {
        try {
          const serial = parseInt(line.substring(6, 11).trim(), 10);
          const name = line.substring(12, 16).trim();
          const resName = line.substring(17, 20).trim();
          const chain = line.substring(21, 22).trim();
          const resSeq = parseInt(line.substring(22, 26).trim(), 10);
          const x = parseFloat(line.substring(30, 38).trim());
          const y = parseFloat(line.substring(38, 46).trim());
          const z = parseFloat(line.substring(46, 54).trim());
          const bFactor = parseFloat(line.substring(60, 66).trim()) || 75.0;

          const atom: AtomRecord = { serial, name, resName, chain, resSeq, x, y, z, bFactor };
          parsed.push(atom);
          if (name === "CA") {
            caOnly.push(atom);
          }
          sumX += x;
          sumY += y;
          sumZ += z;
        } catch {
          // ignore malformed line
        }
      }
    }

    const count = parsed.length || 1;
    return {
      atoms: parsed,
      caAtoms: caOnly.length > 0 ? caOnly : parsed,
      center: { x: sumX / count, y: sumY / count, z: sumZ / count },
    };
  }, [pdbContent]);

  // Color mapping based on pLDDT (AlphaFold standard)
  const getPlddtColor = (plddt: number): string => {
    if (plddt >= 90) return "#1e3a8a"; // Very high: dark blue
    if (plddt >= 70) return "#0284c7"; // High: light blue / cyan
    if (plddt >= 50) return "#facc15"; // Low: yellow
    return "#f97316"; // Very low: orange
  };

  // Render loop using high-precision Canvas 2D orthographic projection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const scale = Math.min(width, height) * 0.035 * zoom;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // Project atoms
      const projected = (renderMode === "spheres" ? atoms : caAtoms).map((a) => {
        // Centered coordinates
        const cx = a.x - center.x;
        const cy = a.y - center.y;
        const cz = a.z - center.z;

        // Rotate Y then X
        const x1 = cx * cosY + cz * sinY;
        const z1 = -cx * sinY + cz * cosY;
        const y2 = cy * cosX - z1 * sinX;
        const z2 = cy * sinX + z1 * cosX;

        const screenX = width / 2 + x1 * scale;
        const screenY = height / 2 - y2 * scale;

        return {
          ...a,
          screenX,
          screenY,
          depth: z2,
        };
      });

      // Sort by depth for correct 3D occlusions
      projected.sort((a, b) => a.depth - b.depth);

      if (renderMode === "cartoon" || renderMode === "trace") {
        // Draw backbone ribbon connect lines
        ctx.beginPath();
        for (let i = 0; i < projected.length; i++) {
          const p = projected[i];
          if (i === 0) {
            ctx.moveTo(p.screenX, p.screenY);
          } else {
            ctx.lineTo(p.screenX, p.screenY);
          }
        }
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = renderMode === "cartoon" ? 6 : 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Draw backbone nodes with pLDDT colors
        for (const p of projected) {
          const color = getPlddtColor(p.bFactor);
          ctx.beginPath();
          const r = renderMode === "cartoon" ? 5.5 : 3.5;
          ctx.arc(p.screenX, p.screenY, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        // Spheres mode
        for (const p of projected) {
          const color = getPlddtColor(p.bFactor);
          ctx.beginPath();
          const r = Math.max(2, 4 + p.depth * 0.1);
          ctx.arc(p.screenX, p.screenY, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      if (isRotating && !isDragging.current) {
        setRotY((r) => r + 0.008);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [atoms, caAtoms, center, rotX, rotY, zoom, renderMode, isRotating]);

  // Mouse drag handlers for 3D rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setRotY((r) => r + dx * 0.01);
    setRotX((r) => r + dy * 0.01);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.4, Math.min(3.0, z - e.deltaY * 0.0015)));
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg select-none">
      {/* Viewer Header */}
      <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-900/80">
        <div>
          <div className="font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-violet-400" />
            {title}
          </div>
          <div className="text-[11px] text-slate-400">
            {caAtoms.length} Residues · {atoms.length} Atoms · Click and drag to rotate
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Representation Selector */}
          <div className="flex items-center p-0.5 bg-slate-800 rounded-lg text-[11px] font-semibold text-slate-300">
            <button
              onClick={() => setRenderMode("cartoon")}
              className={`px-2 py-1 rounded-md transition-colors ${
                renderMode === "cartoon" ? "bg-slate-700 text-white font-bold" : "hover:text-white"
              }`}
            >
              Ribbon
            </button>
            <button
              onClick={() => setRenderMode("trace")}
              className={`px-2 py-1 rounded-md transition-colors ${
                renderMode === "trace" ? "bg-slate-700 text-white font-bold" : "hover:text-white"
              }`}
            >
              Backbone
            </button>
            <button
              onClick={() => setRenderMode("spheres")}
              className={`px-2 py-1 rounded-md transition-colors ${
                renderMode === "spheres" ? "bg-slate-700 text-white font-bold" : "hover:text-white"
              }`}
            >
              Atoms
            </button>
          </div>

          <button
            onClick={() => setIsRotating(!isRotating)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title={isRotating ? "Pause Spin" : "Auto Spin"}
          >
            {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => {
              setRotX(0.3);
              setRotY(0.4);
              setZoom(1.0);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Reset Orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        className="relative h-[360px] flex items-center justify-center cursor-grab active:cursor-grabbing bg-gradient-to-b from-slate-950 to-slate-900"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="w-full h-full block"
        />

        {/* Quality Badges Overlay */}
        {(meanPlddt !== undefined || ptmScore !== undefined) && (
          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-xs border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono space-y-0.5">
            {meanPlddt !== undefined && (
              <div className="text-teal-300 flex items-center gap-1.5">
                <span>Mean pLDDT:</span> <b className="text-white">{meanPlddt.toFixed(1)}</b>
              </div>
            )}
            {ptmScore !== undefined && (
              <div className="text-violet-300 flex items-center gap-1.5">
                <span>pTM Score:</span> <b className="text-white">{ptmScore.toFixed(2)}</b>
              </div>
            )}
          </div>
        )}
      </div>

      {/* pLDDT Confidence Color Spectrum Legend */}
      <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold text-slate-300">Model Confidence (pLDDT):</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#1e3a8a] border border-slate-700"></span> Very High (&gt;90)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#0284c7] border border-slate-700"></span> Confident (70–90)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#facc15] border border-slate-700"></span> Low (50–70)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#f97316] border border-slate-700"></span> Very Low (&lt;50)
          </span>
        </div>
      </div>
    </div>
  );
};
