import React, { useState } from "react";
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RotateCw, 
  ChevronRight, 
  ChevronDown, 
  Layers, 
  Terminal, 
  Key, 
  Hash, 
  Sparkles,
  AlertCircle
} from "lucide-react";
import AiAnalysisCard from "./AiAnalysisCard";
import { api } from "../api/client";

export default function ExecutionDetailModal({ execution, onClose, onRefresh }) {
  const [activeSection, setActiveSection] = useState("timeline"); // timeline, payload, ai
  const [expandedSteps, setExpandedSteps] = useState({ 0: true });
  const [isRetrying, setIsRetrying] = useState(false);
  const [currentExec, setCurrentExec] = useState(execution);

  if (!currentExec) return null;

  const toggleStep = (idx) => {
    setExpandedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await api.retryExecution(currentExec.id);
      if (res.new_execution_id) {
        // Poll for new execution or refresh parent
        setTimeout(() => {
          onRefresh?.();
          setIsRetrying(false);
        }, 1200);
      }
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
      setIsRetrying(false);
    }
  };

  const handleReanalyze = async () => {
    try {
      const res = await api.analyzeExecution(currentExec.id);
      if (res.ai_analysis) {
        setCurrentExec(prev => ({ ...prev, ai_analysis: res.ai_analysis }));
      }
    } catch (err) {
      alert(`Analysis failed: ${err.message}`);
    }
  };

  const statusColors = {
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    failed: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    running: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${statusColors[currentExec.status] || "bg-slate-800 text-slate-300 border-white/10"}`}>
              {currentExec.status === "completed" && <CheckCircle className="w-5 h-5" />}
              {currentExec.status === "failed" && <XCircle className="w-5 h-5" />}
              {currentExec.status === "running" && <RotateCw className="w-5 h-5 animate-spin" />}
              {currentExec.status === "pending" && <Clock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Execution #{currentExec.id.slice(0, 8)}</h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase border ${statusColors[currentExec.status]}`}>
                  {currentExec.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Workflow: <span className="text-indigo-400 font-medium">{currentExec.workflow_name || "Unknown Workflow"}</span> • Trigger: <span className="font-mono text-slate-300">{currentExec.trigger_event}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meta stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3 bg-slate-950/40 border-b border-white/5 text-xs text-slate-400">
          <div>
            <span className="block text-[10px] uppercase font-semibold text-slate-400">Duration</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">{currentExec.duration_ms} ms</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-semibold text-slate-400">Retries / Attempts</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">{currentExec.attempt_count} / {currentExec.max_retries} attempts</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-semibold text-slate-400">Started At</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">
              {currentExec.started_at ? new Date(currentExec.started_at).toLocaleTimeString() : "Pending"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-semibold text-slate-400">Idempotency Key</span>
            <span className="font-mono text-slate-300 truncate block mt-0.5">
              {currentExec.idempotency_key ? currentExec.idempotency_key.slice(0, 16) + "..." : "None"}
            </span>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-white/10 px-5 gap-4 bg-slate-950/20">
          <button
            onClick={() => setActiveSection("timeline")}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeSection === "timeline" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" /> Step-by-Step Timeline ({currentExec.step_logs?.length || 0})
          </button>
          {currentExec.status === "failed" && (
            <button
              onClick={() => setActiveSection("ai")}
              className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeSection === "ai" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-400" /> AI Failure Diagnosis
            </button>
          )}
          <button
            onClick={() => setActiveSection("payload")}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeSection === "payload" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Terminal className="w-4 h-4" /> Raw Payload & Output
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Section: Timeline */}
          {activeSection === "timeline" && (
            <div className="space-y-3">
              {currentExec.status === "failed" && currentExec.ai_analysis && (
                <div className="mb-4">
                  <AiAnalysisCard
                    analysis={currentExec.ai_analysis}
                    onRetry={handleRetry}
                    onReanalyze={handleReanalyze}
                    isRetrying={isRetrying}
                  />
                </div>
              )}

              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Step Execution Logs</h4>
              {(!currentExec.step_logs || currentExec.step_logs.length === 0) ? (
                <div className="p-6 text-center text-slate-400 border border-white/5 rounded-xl bg-slate-950/40">
                  No step logs recorded yet. Execution may be pending worker dispatch.
                </div>
              ) : (
                currentExec.step_logs.map((step, idx) => {
                  const isExpanded = expandedSteps[idx];
                  const isFail = step.status === "failed";
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border transition-all ${
                        isFail ? "border-rose-500/30 bg-rose-950/10" : "border-white/10 bg-slate-950/60"
                      }`}
                    >
                      {/* Step Header */}
                      <div
                        onClick={() => toggleStep(idx)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg border ${
                            isFail ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          }`}>
                            {isFail ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{step.step_name}</span>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {step.step_type}
                              </span>
                              {step.attempt > 1 && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                  Attempt #{step.attempt}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">
                              Duration: {step.duration_ms}ms • Status: <span className={isFail ? "text-rose-400 font-medium" : "text-emerald-400"}>{step.status}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="p-4 border-t border-white/5 space-y-3 bg-slate-950/80 rounded-b-xl text-xs font-mono">
                          {step.error && (
                            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                              <p className="font-semibold text-rose-400 mb-1 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4" /> {step.error.message}
                              </p>
                              {step.error.details && (
                                <pre className="text-[11px] mt-1 overflow-x-auto text-rose-200">
                                  {JSON.stringify(step.error.details, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}

                          {step.output && (
                            <div>
                              <span className="text-[11px] uppercase tracking-wider font-sans font-semibold text-slate-400 block mb-1">
                                Step Output:
                              </span>
                              <pre className="p-3 rounded-lg bg-slate-900 border border-white/5 text-emerald-300 overflow-x-auto max-h-48">
                                {JSON.stringify(step.output, null, 2)}
                              </pre>
                            </div>
                          )}

                          {step.input && (
                            <div>
                              <span className="text-[11px] uppercase tracking-wider font-sans font-semibold text-slate-400 block mb-1">
                                Step Input Context:
                              </span>
                              <pre className="p-3 rounded-lg bg-slate-900 border border-white/5 text-slate-300 overflow-x-auto max-h-48">
                                {JSON.stringify(step.input, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Section: AI Analysis Tab */}
          {activeSection === "ai" && (
            <div>
              <AiAnalysisCard
                analysis={currentExec.ai_analysis}
                onRetry={handleRetry}
                onReanalyze={handleReanalyze}
                isRetrying={isRetrying}
              />
            </div>
          )}

          {/* Section: Raw Payload Tab */}
          {activeSection === "payload" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Input Webhook Event Payload
                </h4>
                <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-cyan-300 overflow-x-auto">
                  {JSON.stringify(currentExec.input_payload || {}, null, 2)}
                </pre>
              </div>

              {currentExec.output_payload && Object.keys(currentExec.output_payload).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Final Pipeline State / Output
                  </h4>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto">
                    {JSON.stringify(currentExec.output_payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Execution ID: {currentExec.id}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>Retry Execution</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
