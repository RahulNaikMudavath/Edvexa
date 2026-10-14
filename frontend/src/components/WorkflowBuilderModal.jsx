import React, { useState } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  Zap, 
  Settings, 
  Layers, 
  Send, 
  Code, 
  Bell, 
  Globe,
  RotateCw,
  Check
} from "lucide-react";
import { api } from "../api/client";

export default function WorkflowBuilderModal({ integrations = [], workflowToEdit, onClose, onSaved }) {
  const [name, setName] = useState(workflowToEdit?.name || "");
  const [description, setDescription] = useState(workflowToEdit?.description || "");
  const [status, setStatus] = useState(workflowToEdit?.status || "active");
  const [integrationId, setIntegrationId] = useState(
    workflowToEdit?.integration_id || integrations[0]?.id || ""
  );
  const [triggerEvent, setTriggerEvent] = useState(workflowToEdit?.trigger_event_type || "*");
  
  // Filter settings
  const [filterField, setFilterField] = useState(workflowToEdit?.trigger_filter?.field || "");
  const [filterOp, setFilterOp] = useState(workflowToEdit?.trigger_filter?.operator || ">=");
  const [filterVal, setFilterVal] = useState(workflowToEdit?.trigger_filter?.value ?? "");

  // Actions list
  const [actions, setActions] = useState(
    workflowToEdit?.actions || [
      {
        id: "step_1_format",
        name: "Format Incoming Data",
        type: "transform",
        config: {
          mappings: { "customer_email": "customer.email" },
          template_output: { "summary": "Received event for {{customer_email}}" }
        }
      },
      {
        id: "step_2_api",
        name: "Call Destination API",
        type: "api_call",
        config: {
          url: "mock://api.service.internal/events",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { "email": "{{customer_email}}" }
        }
      }
    ]
  );

  // Retries
  const [maxRetries, setMaxRetries] = useState(workflowToEdit?.retry_config?.max_retries || 3);
  const [initialDelay, setInitialDelay] = useState(workflowToEdit?.retry_config?.initial_delay || 1.0);
  const [backoffFactor, setBackoffFactor] = useState(workflowToEdit?.retry_config?.backoff_factor || 2.0);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const addAction = (type) => {
    const stepCount = actions.length + 1;
    let newStep = {
      id: `step_${stepCount}_${type}`,
      name: `Step ${stepCount} (${type})`,
      type: type,
      config: {}
    };

    if (type === "transform") {
      newStep.config = {
        mappings: { "extracted_id": "id" },
        template_output: { "formatted_note": "Handled item {{extracted_id}}" }
      };
    } else if (type === "api_call") {
      newStep.config = {
        url: "mock://api.partner.com/webhook",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { "timestamp": "{{_meta.attempt}}" }
      };
    } else if (type === "notification") {
      newStep.config = {
        channel: "slack",
        recipient: "#alerts",
        message: "Automated workflow notification dispatched."
      };
    }

    setActions([...actions, newStep]);
  };

  const removeAction = (idx) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  const updateActionConfig = (idx, field, value) => {
    const updated = [...actions];
    updated[idx] = { ...updated[idx], [field]: value };
    setActions(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !integrationId) {
      setErrorMsg("Workflow name and target integration are required");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");

    const trigger_filter = filterField ? {
      field: filterField,
      operator: filterOp,
      value: isNaN(Number(filterVal)) ? filterVal : Number(filterVal)
    } : {};

    const payload = {
      name,
      description,
      status,
      integration_id: integrationId,
      trigger_event_type: triggerEvent || "*",
      trigger_filter,
      actions,
      retry_config: {
        max_retries: Number(maxRetries),
        initial_delay: Number(initialDelay),
        backoff_factor: Number(backoffFactor)
      }
    };

    try {
      if (workflowToEdit) {
        await api.updateWorkflow(workflowToEdit.id, payload);
      } else {
        await api.createWorkflow(payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to save workflow");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {workflowToEdit ? "Edit Workflow Definition" : "Build New Automation Workflow"}
              </h3>
              <p className="text-xs text-slate-400">
                Configure webhook triggers, data transformation pipelines, API calls, and retry strategies.
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">1. Workflow Identification</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Workflow Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIP Customer Payment Processing"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of workflow objective..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Section 2: Trigger Rules */}
          <div className="space-y-3 pt-3 border-t border-white/5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">2. Trigger & Filters</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Listening Integration *</label>
                <select
                  value={integrationId}
                  onChange={(e) => setIntegrationId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {integrations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.provider})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Event Type Filter (* for any)</label>
                <input
                  type="text"
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                  placeholder="* or payment.succeeded"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Optional condition */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
              <span className="text-xs font-semibold text-slate-300">Optional Rule Filter (e.g. data.amount &gt;= 100):</span>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Field (e.g. amount)"
                  value={filterField}
                  onChange={(e) => setFilterField(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-white"
                />
                <select
                  value={filterOp}
                  onChange={(e) => setFilterOp(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white"
                >
                  <option value=">=">&gt;= (Greater or Equal)</option>
                  <option value="==">== (Equals)</option>
                  <option value="!=">!= (Not Equals)</option>
                  <option value=">">&gt; (Greater Than)</option>
                  <option value="<">&lt; (Less Than)</option>
                  <option value="contains">contains</option>
                  <option value="exists">exists</option>
                </select>
                <input
                  type="text"
                  placeholder="Target Value"
                  value={filterVal}
                  onChange={(e) => setFilterVal(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Action Steps Pipeline */}
          <div className="space-y-3 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                3. Action Pipeline ({actions.length} Steps)
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => addAction("transform")}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center gap-1"
                >
                  <Code className="w-3 h-3 text-cyan-400" /> + Transform
                </button>
                <button
                  type="button"
                  onClick={() => addAction("api_call")}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center gap-1"
                >
                  <Globe className="w-3 h-3 text-indigo-400" /> + API Call
                </button>
                <button
                  type="button"
                  onClick={() => addAction("notification")}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center gap-1"
                >
                  <Bell className="w-3 h-3 text-emerald-400" /> + Notify
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {actions.map((action, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={action.name}
                        onChange={(e) => updateActionConfig(idx, "name", e.target.value)}
                        className="px-2 py-1 rounded bg-slate-900 border border-white/10 text-xs font-semibold text-white focus:outline-none"
                      />
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                        {action.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAction(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Step configuration fields */}
                  {action.type === "api_call" && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <select
                        value={action.config.method || "POST"}
                        onChange={(e) => {
                          const updated = { ...action.config, method: e.target.value };
                          updateActionConfig(idx, "config", updated);
                        }}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono"
                      >
                        <option value="POST">POST</option>
                        <option value="GET">GET</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                      <input
                        type="text"
                        placeholder="URL (e.g. mock://... or https://...)"
                        value={action.config.url || ""}
                        onChange={(e) => {
                          const updated = { ...action.config, url: e.target.value };
                          updateActionConfig(idx, "config", updated);
                        }}
                        className="col-span-2 px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono text-xs"
                      />
                    </div>
                  )}

                  {action.type === "notification" && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Recipient / Channel (e.g. #alerts)"
                        value={action.config.recipient || ""}
                        onChange={(e) => {
                          const updated = { ...action.config, recipient: e.target.value };
                          updateActionConfig(idx, "config", updated);
                        }}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white"
                      />
                      <input
                        type="text"
                        placeholder="Template message ({{summary}})"
                        value={action.config.message || ""}
                        onChange={(e) => {
                          const updated = { ...action.config, message: e.target.value };
                          updateActionConfig(idx, "config", updated);
                        }}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white"
                      />
                    </div>
                  )}

                  {action.type === "transform" && (
                    <div className="text-xs text-slate-400 italic">
                      Default mappings and template interpolation configured.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Retry Settings */}
          <div className="space-y-3 pt-3 border-t border-white/5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">4. Retry & Backoff Strategy</h4>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Max Retries</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Initial Delay (s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={initialDelay}
                  onChange={(e) => setInitialDelay(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Backoff Factor</label>
                <input
                  type="number"
                  step="0.5"
                  value={backoffFactor}
                  onChange={(e) => setBackoffFactor(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : workflowToEdit ? "Update Workflow" : "Create Workflow"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
