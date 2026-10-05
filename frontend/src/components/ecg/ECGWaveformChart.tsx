"use client";

import React, { useState, useRef, useMemo } from "react";
import { ZoomIn, ZoomOut, RotateCcw, LayoutGrid, Maximize2, Activity } from "lucide-react";

interface ECGWaveformChartProps {
  waveform: Array<{ t: number; val: number }>;
  rPeakTimes?: number[];
  samplingRate?: number;
  leadName?: string;
  leadPreviews?: Record<string, Array<{ t: number; val: number }>>;
  availableLeads?: string[];
}

const CANONICAL_12_LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];

const GRID_LAYOUT_3X4 = [
  ["I", "aVR", "V1", "V4"],
  ["II", "aVL", "V2", "V5"],
  ["III", "aVF", "V3", "V6"],
];

export const ECGWaveformChart: React.FC<ECGWaveformChartProps> = ({
  waveform,
  rPeakTimes = [],
  samplingRate = 250,
  leadName = "II",
  leadPreviews = {},
  availableLeads,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedLead, setSelectedLead] = useState<string>(() => {
    // Normalize initial lead name
    const clean = leadName.replace(/^lead_/i, "").toUpperCase();
    if (clean === "2") return "II";
    if (clean === "1") return "I";
    if (clean === "3") return "III";
    return leadName;
  });
  const [viewMode, setViewMode] = useState<"focused" | "grid12">("focused");
  const [paperAesthetic, setPaperAesthetic] = useState<"dark" | "clinical">("dark");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredPoint, setHoveredPoint] = useState<{ t: number; val: number; x: number; y: number } | null>(null);

  // Determine which waveform to display in focused mode
  const activeWaveform = useMemo(() => {
    if (leadPreviews && leadPreviews[selectedLead] && leadPreviews[selectedLead].length > 0) {
      return leadPreviews[selectedLead];
    }
    // Also check case-insensitive match
    if (leadPreviews) {
      const match = Object.keys(leadPreviews).find(
        (k) => k.toLowerCase() === selectedLead.toLowerCase()
      );
      if (match && leadPreviews[match]?.length > 0) {
        return leadPreviews[match];
      }
    }
    return waveform || [];
  }, [leadPreviews, selectedLead, waveform]);

  // Compute scale boundaries for focused view
  const { minVal, maxVal, duration, sampledPoints } = useMemo(() => {
    if (!activeWaveform || activeWaveform.length === 0) {
      return { minVal: -1, maxVal: 1, duration: 10, sampledPoints: [] };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const p of activeWaveform) {
      if (p.val < min) min = p.val;
      if (p.val > max) max = p.val;
    }
    const padding = Math.max(0.2, (max - min) * 0.15);
    const dur = activeWaveform[activeWaveform.length - 1].t;
    return {
      minVal: min - padding,
      maxVal: max + padding,
      duration: dur,
      sampledPoints: activeWaveform,
    };
  }, [activeWaveform]);

  // SVG dimensions for focused view
  const svgWidth = 1000 * zoomLevel;
  const svgHeight = 280;
  const paddingX = 40;
  const paddingY = 25;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;

  const getX = (t: number) => paddingX + (t / duration) * plotWidth;
  const getY = (val: number) => paddingY + plotHeight - ((val - minVal) / (maxVal - minVal)) * plotHeight;

  // Build SVG path for focused view
  const pathD = useMemo(() => {
    return sampledPoints.reduce((acc, p, idx) => {
      const x = getX(p.t);
      const y = getY(p.val);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, "");
  }, [sampledPoints, zoomLevel, minVal, maxVal, duration]);

  // Find nearest points for R peaks
  const rPeakCoords = useMemo(() => {
    // Only show R peaks on Lead II or when plotting default lead
    if (selectedLead !== "II" && selectedLead !== "lead_II") return [];
    return rPeakTimes.map((t) => {
      let nearest = sampledPoints[0];
      let minDiff = Math.abs(sampledPoints[0]?.t - t);
      for (const p of sampledPoints) {
        const diff = Math.abs(p.t - t);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = p;
        }
      }
      return {
        t,
        x: getX(t),
        y: getY(nearest ? nearest.val : 0),
      };
    });
  }, [rPeakTimes, sampledPoints, zoomLevel, minVal, maxVal, duration, selectedLead]);

  // Rhythm strip (Lead II) for bottom of 12-lead view
  const rhythmStrip = useMemo(() => {
    if (leadPreviews && leadPreviews["II"] && leadPreviews["II"].length > 0) {
      return leadPreviews["II"];
    }
    return waveform || [];
  }, [leadPreviews, waveform]);

  const leadsList = availableLeads || Object.keys(leadPreviews).length > 0 ? (availableLeads || Object.keys(leadPreviews)) : CANONICAL_12_LEADS;

  // Helper to render a mini lead SVG tile in 12-lead grid
  const renderMiniLeadTile = (lead: string) => {
    const pts = leadPreviews?.[lead] || [];
    if (!pts || pts.length === 0) {
      return (
        <div key={lead} className="h-28 bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-center text-xs text-slate-500">
          {lead}: No data
        </div>
      );
    }

    let min = Infinity;
    let max = -Infinity;
    for (const p of pts) {
      if (p.val < min) min = p.val;
      if (p.val > max) max = p.val;
    }
    const pad = Math.max(0.15, (max - min) * 0.15);
    const scaleMin = min - pad;
    const scaleMax = max + pad;
    const tileW = 280;
    const tileH = 110;
    const dur = pts[pts.length - 1].t || 10;

    const path = pts.reduce((acc, p, idx) => {
      const x = 25 + (p.t / dur) * (tileW - 35);
      const y = 15 + (tileH - 30) - ((p.val - scaleMin) / (scaleMax - scaleMin)) * (tileH - 30);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, "");

    const isSelected = selectedLead === lead;

    return (
      <div
        key={lead}
        onClick={() => {
          setSelectedLead(lead);
          setViewMode("focused");
        }}
        className={`group relative rounded-xl border cursor-pointer transition-all duration-150 overflow-hidden ${
          paperAesthetic === "clinical"
            ? "bg-[#fff5f5] border-rose-200 hover:border-rose-400"
            : "bg-slate-900 border-slate-800 hover:border-teal-500/50"
        } ${isSelected ? (paperAesthetic === "clinical" ? "ring-2 ring-rose-500" : "ring-2 ring-teal-400") : ""}`}
      >
        {/* Lead Badge Header */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
          <span
            className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded shadow-xs ${
              paperAesthetic === "clinical"
                ? "bg-rose-900 text-rose-100"
                : "bg-slate-950 text-teal-300 border border-slate-700"
            }`}
          >
            {lead}
          </span>
          <span className="text-[10px] opacity-0 group-hover:opacity-100 text-slate-400 font-sans transition-opacity flex items-center gap-0.5">
            <Maximize2 className="w-2.5 h-2.5" /> click to inspect
          </span>
        </div>

        {/* Mini SVG Trace */}
        <svg viewBox={`0 0 ${tileW} ${tileH}`} className="w-full h-28 block select-none">
          <defs>
            <pattern id={`miniGrid_${lead}`} width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke={paperAesthetic === "clinical" ? "#fed7d7" : "#1e293b"}
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width={tileW} height={tileH} fill={`url(#miniGrid_${lead})`} />

          {/* Standard Calibration Step at left */}
          <path
            d={`M 10 ${tileH / 2} L 14 ${tileH / 2} L 14 ${tileH / 2 - 20} L 20 ${tileH / 2 - 20} L 20 ${tileH / 2} L 24 ${tileH / 2}`}
            fill="none"
            stroke={paperAesthetic === "clinical" ? "#e53e3e" : "#475569"}
            strokeWidth="1"
          />

          {/* Waveform Trace */}
          <path
            d={path}
            fill="none"
            stroke={paperAesthetic === "clinical" ? "#9b2c2c" : "#2dd4bf"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Top Chart Toolbar */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Lead & View Mode Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="font-mono text-teal-300 font-bold uppercase text-sm">
              {viewMode === "grid12" ? "12-LEAD CLINICAL ECG" : `LEAD ${selectedLead}`}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 font-mono text-[11px]">{samplingRate} Hz</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 text-[11px]">{duration.toFixed(1)}s strip</span>
          </div>

          {/* View Mode Toggle Button */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("focused")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                viewMode === "focused" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Focused
            </button>
            <button
              onClick={() => setViewMode("grid12")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                viewMode === "grid12" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> 12-Lead Grid
            </button>
          </div>
        </div>

        {/* Paper style & Zoom controls */}
        <div className="flex items-center gap-3">
          {/* Aesthetic Toggle */}
          <button
            onClick={() => setPaperAesthetic((a) => (a === "dark" ? "clinical" : "dark"))}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
              paperAesthetic === "clinical"
                ? "bg-rose-100 text-rose-900 border-rose-300"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            {paperAesthetic === "clinical" ? "Pink ECG Paper" : "Dark Monitor"}
          </button>

          {viewMode === "focused" && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                disabled={zoomLevel <= 1}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-slate-400 font-mono text-[11px] px-1">{zoomLevel}x</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(4, z + 0.5))}
                disabled={zoomLevel >= 4}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 ml-0.5"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lead Selector Pills (in Focused View) */}
      {viewMode === "focused" && (
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Limb:</span>
            {["I", "II", "III"].map((ld) => (
              <button
                key={ld}
                onClick={() => setSelectedLead(ld)}
                className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold transition-all ${
                  selectedLead === ld
                    ? "bg-teal-500 text-slate-950 shadow-xs"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {ld}
              </button>
            ))}

            <span className="text-[11px] font-bold text-slate-500 uppercase ml-2 mr-1">Augmented:</span>
            {["aVR", "aVL", "aVF"].map((ld) => (
              <button
                key={ld}
                onClick={() => setSelectedLead(ld)}
                className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold transition-all ${
                  selectedLead === ld
                    ? "bg-teal-500 text-slate-950 shadow-xs"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {ld}
              </button>
            ))}

            <span className="text-[11px] font-bold text-slate-500 uppercase ml-2 mr-1">Precordial:</span>
            {["V1", "V2", "V3", "V4", "V5", "V6"].map((ld) => (
              <button
                key={ld}
                onClick={() => setSelectedLead(ld)}
                className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold transition-all ${
                  selectedLead === ld
                    ? "bg-teal-500 text-slate-950 shadow-xs"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {ld}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Calibration: 10 mm/mV • 25 mm/s
          </div>
        </div>
      )}

      {/* Main Content Area: 12-Lead Grid View OR Focused View */}
      {viewMode === "grid12" ? (
        <div className="p-4 space-y-4 bg-slate-950">
          {/* 3x4 Standard Clinical Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GRID_LAYOUT_3X4.flat().map((lead) => renderMiniLeadTile(lead))}
          </div>

          {/* Continuous Rhythm Strip Lead II (10-second recording) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-teal-300 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                RHYTHM STRIP (LEAD II) • CONTINUOUS 10-SEC RECORDING
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Pan-Tompkins DSP • Zero-Phase Butterworth (0.5–40 Hz)
              </span>
            </div>
            {/* Rhythm strip SVG */}
            <svg viewBox="0 0 1000 80" className="w-full h-20 block select-none">
              <defs>
                <pattern id="rhythmGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="1000" height="80" fill="url(#rhythmGrid)" />
              {/* Trace */}
              {rhythmStrip && rhythmStrip.length > 0 && (
                <path
                  d={rhythmStrip.reduce((acc, p, idx) => {
                    const dur = rhythmStrip[rhythmStrip.length - 1].t || 10;
                    const x = (p.t / dur) * 1000;
                    const y = 40 - p.val * 24;
                    return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
                  }, "")}
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>
        </div>
      ) : (
        /* Focused Single Lead Interactive SVG Viewer */
        <div
          ref={containerRef}
          className={`overflow-x-auto relative select-none cursor-crosshair ${
            paperAesthetic === "clinical" ? "bg-[#fff5f5]" : "bg-slate-900"
          }`}
          style={{ scrollbarColor: "#334155 #0f172a" }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <svg
            width={svgWidth}
            height={svgHeight}
            className="block"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const tMouse = ((mouseX - paddingX) / plotWidth) * duration;
              if (tMouse >= 0 && tMouse <= duration) {
                let closest = sampledPoints[0];
                let minDiff = Math.abs(sampledPoints[0].t - tMouse);
                for (const p of sampledPoints) {
                  const diff = Math.abs(p.t - tMouse);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closest = p;
                  }
                }
                setHoveredPoint({
                  t: closest.t,
                  val: closest.val,
                  x: getX(closest.t),
                  y: getY(closest.val),
                });
              }
            }}
          >
            <defs>
              <pattern id="ecgGridSmall" width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke={paperAesthetic === "clinical" ? "#fed7d7" : "#1e293b"}
                  strokeWidth="0.5"
                />
              </pattern>
              <pattern id="ecgGridLarge" width="50" height="50" patternUnits="userSpaceOnUse">
                <rect width="50" height="50" fill="url(#ecgGridSmall)" />
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke={paperAesthetic === "clinical" ? "#feb2b2" : "#334155"}
                  strokeWidth="0.8"
                />
              </pattern>
            </defs>

            {/* Grid Background */}
            <rect width={svgWidth} height={svgHeight} fill="url(#ecgGridLarge)" />

            {/* Standard Calibration Step (10 mm/mV = 1.0 mV square pulse) */}
            <g>
              <path
                d={`M 15 ${getY(0)} L 20 ${getY(0)} L 20 ${getY(1.0)} L 30 ${getY(1.0)} L 30 ${getY(0)} L 35 ${getY(0)}`}
                fill="none"
                stroke={paperAesthetic === "clinical" ? "#e53e3e" : "#64748b"}
                strokeWidth="1.5"
              />
              <text
                x="25"
                y={getY(1.0) - 5}
                fontSize="8"
                fill={paperAesthetic === "clinical" ? "#9b2c2c" : "#94a3b8"}
                fontFamily="monospace"
                textAnchor="middle"
              >
                1mV
              </text>
            </g>

            {/* Zero baseline */}
            {minVal <= 0 && maxVal >= 0 && (
              <line
                x1={paddingX}
                y1={getY(0)}
                x2={svgWidth - paddingX}
                y2={getY(0)}
                stroke={paperAesthetic === "clinical" ? "#feb2b2" : "#475569"}
                strokeDasharray="4,4"
                strokeWidth="1"
              />
            )}

            {/* ECG Trace Path */}
            <path
              d={pathD}
              fill="none"
              stroke={paperAesthetic === "clinical" ? "#9b2c2c" : "#2dd4bf"}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Detected R-peaks Markers (on Lead II) */}
            {rPeakCoords.map((peak, idx) => (
              <g key={idx}>
                <line
                  x1={peak.x}
                  y1={peak.y - 18}
                  x2={peak.x}
                  y2={peak.y}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="2,2"
                />
                <circle cx={peak.x} cy={peak.y} r="3.5" fill="#f43f5e" stroke="#fff" strokeWidth="1.2" />
                <text
                  x={peak.x}
                  y={peak.y - 20}
                  fill={paperAesthetic === "clinical" ? "#9b2c2c" : "#fda4af"}
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  R{idx + 1}
                </text>
              </g>
            ))}

            {/* Hover Crosshair & Tooltip */}
            {hoveredPoint && (
              <g>
                <line
                  x1={hoveredPoint.x}
                  y1={paddingY}
                  x2={hoveredPoint.x}
                  y2={svgHeight - paddingY}
                  stroke={paperAesthetic === "clinical" ? "#718096" : "#94a3b8"}
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="4"
                  fill="#38bdf8"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              </g>
            )}
          </svg>

          {hoveredPoint && (
            <div
              className="absolute pointer-events-none bg-slate-950/90 text-white text-[11px] font-mono px-2.5 py-1 rounded-md border border-slate-700 shadow-lg"
              style={{
                left: Math.min(hoveredPoint.x + 10, svgWidth - 110),
                top: Math.max(10, hoveredPoint.y - 35),
              }}
            >
              <div>Lead: {selectedLead}</div>
              <div>t: {hoveredPoint.t.toFixed(3)}s</div>
              <div className="text-teal-400 font-bold">V: {hoveredPoint.val.toFixed(3)} mV</div>
            </div>
          )}
        </div>
      )}

      {/* Chart Footer with Standard Metadata */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span>Standard 12-Lead ECG • 25 mm/s • 10 mm/mV</span>
          <span>•</span>
          <span>Butterworth 0.5–40 Hz Zero-Phase Filter</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span
              className={`w-2 h-0.5 inline-block ${paperAesthetic === "clinical" ? "bg-red-800" : "bg-teal-400"}`}
            ></span>{" "}
            Voltage Trace
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Detected R-peaks
          </span>
        </div>
      </div>
    </div>
  );
};
