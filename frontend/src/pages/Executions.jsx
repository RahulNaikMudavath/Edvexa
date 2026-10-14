import React, { useState } from "react";
import { 
  PlayCircle, 
  RotateCw, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Sparkles, 
  ArrowRight,
  Filter,
  Terminal,
  ShieldAlert
} from "lucide-react";
import { api } from "../api/client";

export default function Executions({ executions = [], onSelectExecution, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [retryingId, setRetryingId] = useState(null);

  const filtered = executions.filter(exec => {
    if (statusFilter !== "all" && exec.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const name = (exec.workflow_name || "").toLowerCase();
      const id = (exec.id || "").toLowerCase();
      const event = (exec.trigger_event || "").toLowerCase();
      const key = (exec.idempotency_key || "").toLowerCase();
      return name.includes(term) || id.includes(term) || event.includes(term) || key.includes(term);
    }
    return true;
  });

  const handleQuickRetry = async (e, id) => {
    e.stopPropagation();
    setRetryingId(id);
    try {
      await api.retryExecution(id);
      setTimeout(() => {
        setRetryingId(null);
        onRefresh?.();
      }, 1000);
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
      setRetryingId(null);
    }
  };

  const statusPills = [
    { id: "all", label: "All Executions", count: executions.length },
    { id: "completed", label: "Completed", count: executions.filter(e => e.status === "completed").length },
    { id: "failed", label: "Failed", count: executions.filter(e => e.status === "failed").length },
    { id: "running", label: "Running", count: executions.filter(e => e.status === "running").length },
    { id: "pending", label: "Pending", count: executions.filter(e => e.status === "pending").length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-indigo-400" />
            Execution History & Logs
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time execution telemetry, step-by-step logs, retry attempts, and AI failure diagnostics.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh Executions</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-white/10 glass-panel">
        <div className="flex flex-wrap items-center gap-1.5">
          {statusPills.map(pill => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === pill.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-900 border border-white/5"
              }`}
            >
              {pill.label} ({pill.count})
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, workflow, key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Executions Table */}
      <div className="rounded-2xl border border-white/10 glass-panel bg-slate-900/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5 font-semibold">
              <tr>
                <th className="py-3.5 px-4">Execution ID</th>
                <th className="py-3.5 px-4">Workflow Name</th>
                <th className="py-3.5 px-4">Trigger Event</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Attempts</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">AI Failure Analysis</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No executions matched the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((exec) => {
                  const isCompleted = exec.status === "completed";
                  const isFailed = exec.status === "failed";
                  const isRunning = exec.status === "running";
                  const isPending = exec.status === "pending";
                  const isRetrying = retryingId === exec.id;

                  return (
                    <tr
                      key={exec.id}
                      onClick={() => onSelectExecution(exec)}
                      className="hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-slate-300 font-semibold">
                        #{exec.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {exec.workflow_name || "Workflow"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {exec.trigger_event}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : isFailed
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : isRunning
                              ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {isCompleted && <CheckCircle className="w-3 h-3" />}
                          {isFailed && <XCircle className="w-3 h-3" />}
                          {isRunning && <RotateCw className="w-3 h-3 animate-spin" />}
                          {isPending && <Clock className="w-3 h-3" />}
                          {exec.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {exec.attempt_count > 1 ? (
                          <span className="text-amber-400 font-bold">
                            {exec.attempt_count}/{exec.max_retries} (Retried)
                          </span>
                        ) : (
                          "1 attempt"
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {exec.duration_ms} ms
                      </td>
                      <td className="py-3.5 px-4">
                        {exec.ai_analysis ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 font-bold bg-indigo-500/15 px-2 py-0.5 rounded-md border border-indigo-500/30">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            Diagnosis Ready
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                            <ShieldAlert className="w-3 h-3" /> Error Logged
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                        {exec.created_at ? new Date(exec.created_at).toLocaleTimeString() : ""}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          {isFailed && (
                            <button
                              onClick={(e) => handleQuickRetry(e, exec.id)}
                              disabled={isRetrying}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
                            >
                              {isRetrying ? "Retrying..." : "Retry"}
                            </button>
                          )}
                          <button
                            onClick={() => onSelectExecution(exec)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold p-1"
                          >
                            Inspect &rarr;
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
