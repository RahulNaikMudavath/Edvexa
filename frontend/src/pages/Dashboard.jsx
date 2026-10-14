import React from "react";
import { 
  Layers, 
  Zap, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RotateCw, 
  Send, 
  Plus, 
  Sparkles,
  ArrowRight,
  ShieldAlert
} from "lucide-react";
import MetricCard from "../components/MetricCard";

export default function Dashboard({ 
  analytics, 
  executions = [], 
  onOpenSimulator, 
  onOpenWorkflowBuilder, 
  onSelectExecution,
  setActiveTab 
}) {
  const {
    integrations = { total: 0, active: 0 },
    workflows = { total: 0, active: 0 },
    events = { total: 0 },
    executions: execStats = { total: 0, completed: 0, failed: 0, running: 0, success_rate: 100, avg_duration_ms: 0, total_retries: 0 },
    recent_failure_highlights = []
  } = analytics || {};

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-slate-950/90 border border-indigo-500/20 glass-panel shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            AI-Powered API Integration & Automation Platform
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">System Reliability & Execution Hub</h2>
          <p className="text-sm text-slate-400 max-w-2xl">
            Real-time webhook ingestion, HMAC verification, asynchronous workflow execution, and intelligent LLM-assisted failure diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
          >
            <Send className="w-4 h-4" />
            <span>Simulate Webhook</span>
          </button>
          <button
            onClick={onOpenWorkflowBuilder}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Integrations"
          value={integrations.active}
          subtitle={`${integrations.total} registered providers`}
          icon={Layers}
          color="cyan"
          badge={{ label: "Webhooks", value: `${events.total} received` }}
        />
        <MetricCard
          title="Active Workflows"
          value={workflows.active}
          subtitle={`${workflows.total} total automation rules`}
          icon={Zap}
          color="indigo"
          badge={{ label: "Pipeline Engine", value: "Async Worker" }}
        />
        <MetricCard
          title="Success Rate"
          value={`${execStats.success_rate}%`}
          subtitle={`${execStats.completed} completed • ${execStats.failed} failed`}
          icon={CheckCircle}
          color={execStats.success_rate >= 90 ? "emerald" : "amber"}
          badge={{ label: "Avg Latency", value: `${execStats.avg_duration_ms} ms` }}
        />
        <MetricCard
          title="Retry Executions"
          value={execStats.total_retries}
          subtitle="Exponential backoff handled"
          icon={RotateCw}
          color="amber"
          badge={{ label: "Total Runs", value: execStats.total }}
        />
      </div>

      {/* AI Failure Diagnostics Alert Section (if failures exist) */}
      {recent_failure_highlights.length > 0 && (
        <div className="p-5 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/20 via-slate-900/80 to-slate-950/80 glass-panel space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  AI Failure Diagnoses Ready for Review
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold">
                    {recent_failure_highlights.length} Failed
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  AI has analyzed execution logs and identified root causes with suggested remediations.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("executions")}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              View All Logs <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {recent_failure_highlights.slice(0, 2).map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectExecution({ id: item.execution_id })}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-rose-500/20 hover:border-rose-500/40 cursor-pointer transition-all hover:bg-slate-900/80 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-300">{item.workflow_name}</span>
                  <span className="text-slate-400 font-mono">{item.failed_at ? new Date(item.failed_at).toLocaleTimeString() : ""}</span>
                </div>
                <p className="text-xs text-slate-200 font-medium line-clamp-1">{item.ai_summary}</p>
                <p className="text-[11px] text-slate-400 line-clamp-2">{item.root_cause}</p>
                <div className="pt-1.5 flex items-center gap-1.5 text-[11px] text-cyan-400 font-semibold">
                  <span>Fix: {item.suggested_action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Executions Table */}
      <div className="rounded-2xl border border-white/10 glass-panel bg-slate-900/70 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Recent Workflow Executions</h3>
          </div>
          <button
            onClick={() => setActiveTab("executions")}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            Full Execution History <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5 font-semibold">
              <tr>
                <th className="py-3 px-4">Execution ID</th>
                <th className="py-3 px-4">Workflow</th>
                <th className="py-3 px-4">Trigger Event</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Retries</th>
                <th className="py-3 px-4">AI Diagnosis</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No executions recorded yet. Use the Webhook Simulator to dispatch events!
                  </td>
                </tr>
              ) : (
                executions.slice(0, 7).map((exec) => {
                  const isCompleted = exec.status === "completed";
                  const isFailed = exec.status === "failed";
                  const isRunning = exec.status === "running";
                  return (
                    <tr
                      key={exec.id}
                      onClick={() => onSelectExecution(exec)}
                      className="hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-slate-300 font-medium">
                        #{exec.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {exec.workflow_name || "Workflow"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {exec.trigger_event}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : isFailed
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : isRunning
                              ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {exec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {exec.duration_ms} ms
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {exec.attempt_count > 1 ? (
                          <span className="text-amber-400 font-semibold">{exec.attempt_count} attempts</span>
                        ) : (
                          "1"
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {exec.ai_analysis ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            Analyzed
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-indigo-400 hover:text-indigo-300 font-semibold text-xs">
                          Inspect &rarr;
                        </span>
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
