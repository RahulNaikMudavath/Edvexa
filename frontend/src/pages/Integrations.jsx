import React, { useState } from "react";
import { 
  Layers, 
  Plus, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Send, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Globe, 
  Key, 
  Hash, 
  Activity,
  Calendar
} from "lucide-react";
import { api } from "../api/client";

export default function Integrations({ integrations = [], onRefresh, onOpenSimulator }) {
  const [showSecret, setShowSecret] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New integration state
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("custom");
  const [description, setDescription] = useState("");
  const [eventsInput, setEventsInput] = useState("payment.succeeded, payment.failed");

  const toggleShowSecret = (id) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleStatus = async (integration) => {
    const nextStatus = integration.status === "active" ? "inactive" : "active";
    try {
      await api.updateIntegration(integration.id, { status: nextStatus });
      onRefresh?.();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (id, integrationName) => {
    if (!window.confirm(`Are you sure you want to delete integration "${integrationName}"? All attached workflows will also be deleted.`)) {
      return;
    }
    try {
      await api.deleteIntegration(id);
      onRefresh?.();
    } catch (err) {
      alert(`Failed to delete integration: ${err.message}`);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const supported_events = eventsInput.split(",").map(s => s.trim()).filter(Boolean);
      await api.createIntegration({
        name,
        provider,
        description,
        supported_events
      });
      setShowCreateModal(false);
      setName("");
      setDescription("");
      onRefresh?.();
    } catch (err) {
      alert(`Failed to create integration: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Registered API Integrations
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage incoming webhook endpoints, configure HMAC-SHA256 secrets, and monitor event streams.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Integration</span>
        </button>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {integrations.map((i) => {
          const isActive = i.status === "active";
          const fullWebhookUrl = `${window.location.origin}${i.webhook_path}`;
          const isKeyVisible = showSecret[i.id];

          return (
            <div
              key={i.id}
              className={`rounded-2xl border transition-all p-5 glass-panel flex flex-col justify-between ${
                isActive ? "border-white/10 bg-slate-900/70" : "border-rose-500/20 bg-slate-950/40 opacity-75"
              }`}
            >
              <div className="space-y-4">
                {/* Integration Top Details */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center font-bold uppercase text-xs text-indigo-400">
                      {i.provider.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{i.name}</h3>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          isActive 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                            : "bg-slate-800 text-slate-400 border-white/10"
                        }`}>
                          {i.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {i.description || "No description provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(i)}
                      title={isActive ? "Disable Integration" : "Enable Integration"}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                        isActive
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600"
                      }`}
                    >
                      {isActive ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(i.id, i.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Integration"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Webhook Endpoint Box */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-cyan-400" /> Ingestion Webhook URL (POST)
                  </span>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-white/5 font-mono text-xs text-cyan-300">
                    <span className="truncate pr-2">{i.webhook_path}</span>
                    <button
                      onClick={() => copyToClipboard(fullWebhookUrl, `url_${i.id}`)}
                      className="text-slate-400 hover:text-white p-1 rounded"
                      title="Copy Full Webhook URL"
                    >
                      {copiedKey === `url_${i.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* HMAC Secret Key Box */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Key className="w-3 h-3 text-amber-400" /> HMAC SHA-256 Secret Key
                  </span>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-white/5 font-mono text-xs text-amber-300">
                    <span className="truncate pr-2">
                      {isKeyVisible ? i.secret_key : "••••••••••••••••••••••••••••••••••••"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleShowSecret(i.id)}
                        className="text-slate-400 hover:text-white p-1"
                        title={isKeyVisible ? "Hide Secret" : "Reveal Secret"}
                      >
                        {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(i.secret_key, `sec_${i.id}`)}
                        className="text-slate-400 hover:text-white p-1"
                        title="Copy Secret Key"
                      >
                        {copiedKey === `sec_${i.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Supported Events Tags */}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Supported Event Types:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {i.supported_events?.map((ev, idx) => (
                      <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-white/5">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <strong className="text-slate-200">{i.event_count || 0}</strong> events received
                </span>
                <button
                  onClick={onOpenSimulator}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Event</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Register Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl glass-panel shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Register API Integration
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Integration Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe Payments US"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Provider Type</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="stripe">Stripe</option>
                  <option value="github">GitHub</option>
                  <option value="shopify">Shopify</option>
                  <option value="slack">Slack</option>
                  <option value="custom">Custom Webhook</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Integration purpose..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Supported Event Types (comma separated)</label>
                <input
                  type="text"
                  placeholder="payment.succeeded, charge.failed"
                  value={eventsInput}
                  onChange={(e) => setEventsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {isSubmitting ? "Creating..." : "Save Integration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
