import React, { useState } from "react";
import { 
  Zap, 
  Plus, 
  Play, 
  Trash2, 
  Edit3, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  Code, 
  Globe, 
  Bell, 
  RotateCw,
  Filter
} from "lucide-react";
import { api } from "../api/client";

export default function Workflows({ workflows = [], integrations = [], onRefresh, onOpenCreate, onEditWorkflow }) {
  const [runningId, setRunningId] = useState(null);

  const handleToggleStatus = async (wf) => {
    const nextStatus = wf.status === "active" ? "paused" : "active";
    try {
      await api.updateWorkflow(wf.id, { status: nextStatus });
      onRefresh?.();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete workflow "${name}"? This action cannot be undone.`)) return;
    try {
      await api.deleteWorkflow(id);
      onRefresh?.();
    } catch (err) {
      alert(`Failed to delete workflow: ${err.message}`);
    }
  };

  const handleManualRun = async (id) => {
    setRunningId(id);
    try {
      await api.runWorkflow(id, {
        source: "dashboard_manual_trigger",
        amount: 25000,
        customer: { id: "cus_manual_test", name: "Executive Reviewer", email: "candidate@edvexa.com" },
        action: "opened",
        pull_request: { number: 101, title: "Test Manual Dispatch", user: { login: "candidate" } }
      });
      setTimeout(() => {
        setRunningId(null);
        onRefresh?.();
      }, 1000);
    } catch (err) {
      alert(`Manual execution failed: ${err.message}`);
      setRunningId(null);
    }
  };

  const actionIcons = {
    transform: Code,
    api_call: Globe,
    notification: Bell,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            Configured Automation Workflows
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Event triggers, multi-step action execution pipelines, and automatic backoff retry policies.
          </p>
        </div>
        <button
          onClick={onOpenCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Workflow</span>
        </button>
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {workflows.map((wf) => {
          const isActive = wf.status === "active";
          const isRunning = runningId === wf.id;
          const filter = wf.trigger_filter || {};
          const hasFilter = filter.field;

          return (
            <div
              key={wf.id}
              className={`p-5 rounded-2xl border transition-all glass-panel ${
                isActive ? "border-white/10 bg-slate-900/70" : "border-white/5 bg-slate-950/40 opacity-70"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Workflow Left Info */}
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-white">{wf.name}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}>
                      {wf.status}
                    </span>
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                      Integration: {wf.integration_name || "Custom"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{wf.description || "No description provided."}</p>

                  {/* Trigger & Condition Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 border border-white/5 text-slate-300 font-mono text-[11px]">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Trigger: {wf.trigger_event_type}
                    </span>

                    {hasFilter && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 font-mono text-[11px]">
                        <Filter className="w-3 h-3 text-cyan-400" />
                        Rule: {filter.field} {filter.operator} {String(filter.value)}
                      </span>
                    )}

                    {wf.retry_config && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950/80 border border-white/5 text-slate-400 text-[11px]">
                        <RotateCw className="w-3 h-3 text-indigo-400" />
                        Max {wf.retry_config.max_retries || 3} Retries ({wf.retry_config.backoff_factor || 2}x Backoff)
                      </span>
                    )}
                  </div>
                </div>

                {/* Workflow Actions / Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleManualRun(wf.id)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
                  >
                    <Play className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
                    <span>{isRunning ? "Dispatching..." : "Run Test"}</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(wf)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
                  >
                    {isActive ? "Pause" : "Activate"}
                  </button>

                  <button
                    onClick={() => onEditWorkflow(wf)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 transition-colors"
                    title="Edit Workflow"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(wf.id, wf.name)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Workflow"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Pipeline Steps Visualization */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Action Chain Execution Flow ({wf.actions?.length || 0} Steps):
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {wf.actions?.map((action, idx) => {
                    const Icon = actionIcons[action.type] || Code;
                    return (
                      <React.Fragment key={idx}>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs">
                          <Icon className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-semibold text-slate-200">{action.name}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-850 text-slate-400">
                            {action.type}
                          </span>
                        </div>
                        {idx < (wf.actions.length - 1) && (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
