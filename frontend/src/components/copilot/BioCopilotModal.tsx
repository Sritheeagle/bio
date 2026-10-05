"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Activity,
  Dna,
  ShieldCheck,
  HelpCircle,
  Copy,
  Check,
  Minimize2,
  Maximize2,
  Volume2,
  VolumeX,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  category?: "ecg" | "protein" | "compliance" | "general";
  metadata?: Record<string, any>;
}

export const BioCopilotModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "copilot",
      text: "Hello! I am your **BioCloud AI Research Copilot**. I can assist with clinical ECG rhythm interpretation, HRV risk stratification, ESMFold protein structural confidence analysis, and AWS cloud pipeline diagnostics.\n\nHow can I assist your biomedical research today?",
      timestamp: "Just now",
      category: "general",
    },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const speakText = (text: string) => {
    if (!soundEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`]/g, "");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech error:", e);
    }
  };

  const handleSend = (userQuestion?: string) => {
    const q = (userQuestion || input).trim();
    if (!q) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userQuestion) setInput("");
    setIsTyping(true);

    // Intelligent context-aware clinical response simulation
    setTimeout(() => {
      let reply = "";
      let cat: "ecg" | "protein" | "compliance" | "general" = "general";

      const lower = q.toLowerCase();
      if (lower.includes("ecg") || lower.includes("tachycardia") || lower.includes("arrhythmia") || lower.includes("hrv") || lower.includes("butterworth")) {
        cat = "ecg";
        if (lower.includes("tachycardia")) {
          reply = "### Sinus Tachycardia Diagnostic Profile\n- **Rate**: Sustained ventricular rate > 100 bpm with normal upright P waves in Lead II.\n- **HRV Impact**: Typically presents with reduced SDNN (< 30ms) and elevated LF/HF sympathetic dominance.\n- **Clinical Recommendation**: Correlate with patient metabolic state, fever, or adrenergic stimulus. Verify QTc interval is < 460ms (Bazett's correction) to rule out secondary repolarization prolongation.";
        } else if (lower.includes("butterworth") || lower.includes("filter")) {
          reply = "### Butterworth Bandpass Filter Architecture\n- **Bandwidth**: 0.5 Hz to 45.0 Hz (2nd Order Zero-Phase IIR).\n- **High-pass 0.5 Hz**: Suppresses respiration-induced baseline wander.\n- **Low-pass 45.0 Hz**: Filters high-frequency EMG muscle artifacts and 50/60 Hz powerline hum.\n- **Zero-Phase**: Implemented via forward-backward filtering (`scipy.signal.filtfilt`) ensuring zero phase distortion of QRS morphological complexes.";
        } else {
          reply = "### Heart Rate Variability (HRV) Clinical Reference\n- **SDNN**: Normal standard deviation of NN intervals is 50-100 ms. Values < 50ms indicate impaired cardiac autonomic regulation.\n- **RMSSD**: Root mean square of successive differences (> 30 ms reflects robust parasympathetic vagal tone).\n- **pNN50**: Percentage of adjacent intervals differing by > 50 ms.\n- **Signal Quality Metric (SQI)**: Calculated using skewness and kurtosis of the detected QRS window.";
        }
      } else if (lower.includes("protein") || lower.includes("plddt") || lower.includes("esmfold") || lower.includes("alphafold") || lower.includes("structure")) {
        cat = "protein";
        if (lower.includes("plddt")) {
          reply = "### ESMFold pLDDT Structural Confidence Scale\n- **pLDDT > 90 (Dark Blue)**: High accuracy; backbone and side-chain orientations are highly reliable for docking analysis.\n- **70 ≤ pLDDT < 90 (Cyan)**: Confident backbone trace; secondary structure elements (alpha-helices, beta-strands) are well resolved.\n- **50 ≤ pLDDT < 70 (Yellow)**: Low confidence; potential flexible loops or surface loops.\n- **pLDDT < 50 (Orange/Red)**: Very low confidence; frequently correlates with Intrinsically Disordered Regions (IDRs).";
        } else {
          reply = "### ESMFold Deep Learning Inference Pipeline\n- **Model**: ESM-2 (650M - 3B parameters) transformer language model with ESMFold structure module.\n- **Direct Sequence-to-3D**: Predicts coordinates directly from single sequence in seconds, bypassing expensive MSA generation.\n- **Validation**: FASTA strings undergo strict IUPAC-IUB amino acid character sanitization and max length bounds checking before tensor embedding.";
        }
      } else if (lower.includes("aws") || lower.includes("s3") || lower.includes("cloud") || lower.includes("ec2")) {
        cat = "compliance";
        reply = "### BioCloud AWS Cloud Architecture (eu-north-1)\n- **Storage**: Amazon S3 bucket `biocloud-workbench-211125717128` with AES256 server-side encryption and versioning.\n- **Compute**: Amazon EC2 `t3.large` instance running Docker Compose microservices.\n- **Zero-Trust Security**: IAM Instance Profile with least-privilege S3 read/write and AWS Systems Manager Core.\n- **Compliance**: RUO (Research Use Only) with cryptographic SHA-256 audit logging.";
      } else {
        reply = "### BioCloud Biomedical Copilot Ready\nI can analyze uploaded ECG CSV/WFDB signals, explain HRV metrics (SDNN/RMSSD), evaluate ESMFold 3D protein structures, or monitor your AWS cloud compute pipelines. Try one of the quick research topics below!";
      }

      const copilotMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "copilot",
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        category: cat,
      };

      setMessages((prev) => [...prev, copilotMsg]);
      setIsTyping(false);
      speakText(reply);
    }, 600);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[640px] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">BioCopilot Assistant</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> AI Clinical RUO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">ECG DSP & ESMFold Protein Structural Copilot</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Disable speech audio" : "Enable speech audio"}
              className={`p-2 rounded-lg text-xs transition-colors ${
                soundEnabled ? "bg-teal-500/20 text-teal-300" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950/40">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.sender === "copilot" && (
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                  m.sender === "user"
                    ? "bg-teal-600 text-white rounded-tr-xs shadow-md"
                    : "bg-slate-850/90 text-slate-200 border border-slate-800 rounded-tl-xs shadow-md"
                }`}
              >
                <div className="whitespace-pre-wrap font-sans space-y-2">
                  {m.text.split("\n\n").map((para, i) => {
                    if (para.startsWith("### ")) {
                      return (
                        <h4 key={i} className="text-teal-300 font-bold text-xs mt-2 first:mt-0 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-teal-400" />
                          {para.replace("### ", "")}
                        </h4>
                      );
                    }
                    if (para.startsWith("- ")) {
                      return (
                        <ul key={i} className="space-y-1 list-disc list-inside text-slate-300 pl-1">
                          {para.split("\n").map((line, li) => (
                            <li key={li} className="leading-snug">
                              {line.replace("- ", "")}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={i}>{para}</p>;
                  })}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{m.timestamp}</span>
                  {m.sender === "copilot" && (
                    <button
                      onClick={() => copyToClipboard(m.id, m.text)}
                      className="hover:text-teal-300 flex items-center gap-1 transition-colors"
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 items-center text-slate-400 text-xs">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <span className="animate-pulse">BioCopilot is formulating clinical analysis...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-5 py-2 bg-slate-950/80 border-t border-slate-800/80 overflow-x-auto flex items-center gap-2 text-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-400" /> Prompts:
          </span>
          <button
            onClick={() => handleSend("Explain Sinus Tachycardia criteria and HRV risk metrics")}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition-colors border border-slate-700/60"
          >
            ECG Tachycardia Criteria
          </button>
          <button
            onClick={() => handleSend("Explain ESMFold pLDDT structural confidence scores")}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition-colors border border-slate-700/60"
          >
            ESMFold pLDDT Scale
          </button>
          <button
            onClick={() => handleSend("How does the Butterworth bandpass filter remove baseline wander?")}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition-colors border border-slate-700/60"
          >
            Butterworth DSP Filter
          </button>
          <button
            onClick={() => handleSend("Explain BioCloud AWS Cloud Architecture and S3 encryption")}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition-colors border border-slate-700/60"
          >
            AWS Cloud Security
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask BioCopilot about ECG rhythms, HRV statistics, protein folding, or cloud architecture..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </form>
          <div className="mt-2 text-[10px] text-slate-500 text-center flex items-center justify-center gap-2">
            <ShieldCheck className="w-3 h-3 text-teal-400" />
            <span>Research Use Only (RUO) &bull; Not intended for primary diagnostic decision-making</span>
          </div>
        </div>
      </div>
    </div>
  );
};
