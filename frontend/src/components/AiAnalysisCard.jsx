import React, { useState } from "react";
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  Copy, 
  RotateCw, 
  FileCode, 
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from "lucide-react";

export default function AiAnalysisCard({ analysis, onRetry, onReanalyze, isRetrying }) {
  const [copied, setCopied] = useState(false);

  if (!analysis) {
    return (
      <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 text-center text-slate-400 text-sm">
        No AI failure analysis generated for this execution.
      </div>
    );
  }

  const {
    summary,
    root_cause,
    evidence,
    suggested_action,
    suggested_config_diff,
    confidence_score,
    provider,
    generated_at
  } = analysis;

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Root Cause:\n${root_cause}\n\nSuggested Fix:\n${suggested_action}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-950/80 p-5 glass-panel shadow-xl shadow-indigo-950/20 relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              AI-Assisted Failure Analysis
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {provider || "Heuristic Engine"}
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Generated {generated_at ? new Date(generated_at).toLocaleTimeString() : "just now"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {confidence_score && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Confidence: {Math.round(confidence_score * 100)}%
            </span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-white/5"
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy Diagnosis"}
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Failure Summary</span>
          <p className="text-sm font-medium text-slate-200 mt-0.5">{summary}</p>
        </div>
      </div>

      {/* Root Cause Analysis */}
      <div className="mt-4 space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Root Cause Diagnosis</span>
        <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-white/5">
          {root_cause}
        </p>
      </div>

      {/* Log Evidence & Error Snippet */}
      {evidence && (
        <div className="mt-4 space-y-1">
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Log Evidence Behind Diagnosis</span>
          </div>
          <pre className="text-xs font-mono text-amber-200/90 bg-slate-950/90 p-3 rounded-xl border border-amber-500/20 overflow-x-auto whitespace-pre-wrap">
            {evidence}
          </pre>
        </div>
      )}

      {/* Actionable Suggested Fix */}
      <div className="mt-4 space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <ArrowRight className="w-3.5 h-3.5" /> Recommended Corrective Action
        </span>
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-sm text-cyan-100">
          {suggested_action}
        </div>
      </div>

      {/* Suggested Config Adjustment Diff */}
      {suggested_config_diff && Object.keys(suggested_config_diff).length > 0 && (
        <div className="mt-4 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Suggested Configuration Adjustment
          </span>
          <pre className="text-xs font-mono text-slate-300 bg-slate-950/90 p-3 rounded-xl border border-white/10 overflow-x-auto">
            {JSON.stringify(suggested_config_diff, null, 2)}
          </pre>
        </div>
      )}

      {/* Action CTA Bar */}
      <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400 italic">
          AI suggestions are isolated from workflow execution. Review before applying changes.
        </p>
        <div className="flex items-center gap-2">
          {onReanalyze && (
            <button
              onClick={onReanalyze}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-white/10"
            >
              <RotateCw className="w-3.5 h-3.5" /> Re-analyze
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>Retry Execution Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
