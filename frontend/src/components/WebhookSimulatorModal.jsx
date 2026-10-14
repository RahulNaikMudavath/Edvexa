import React, { useState } from "react";
import { 
  X, 
  Send, 
  ShieldCheck, 
  ShieldAlert, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  PlayCircle,
  Terminal,
  Zap,
  Repeat
} from "lucide-react";
import { api } from "../api/client";

const SAMPLE_TEMPLATES = {
  stripe_success: {
    name: "Stripe: Payment Succeeded ($150.00)",
    integration_slug: "stripe-payments",
    event_type: "payment.succeeded",
    payload: {
      id: "ch_stripe_mock_7788",
      type: "payment.succeeded",
      amount: 15000,
      currency: "usd",
      status: "succeeded",
      customer: {
        id: "cus_alice_99",
        name: "Alice Walker",
        email: "alice@example.com"
      }
    }
  },
  stripe_failure: {
    name: "Stripe: Payment Failed (AI Analysis Demo)",
    integration_slug: "stripe-payments",
    event_type: "payment.failed",
    payload: {
      id: "ch_fail_demo_4411",
      type: "payment.failed",
      amount: 4500,
      error: {
        code: "card_declined",
        message: "Your card was declined or insufficient funds."
      },
      customer: {
        id: "cus_bob_88",
        name: "Bob Martin",
        email: "bob@example.com"
      }
    }
  },
  github_pr: {
    name: "GitHub: Pull Request Opened",
    integration_slug: "github-events",
    event_type: "pull_request",
    payload: {
      action: "opened",
      pull_request: {
        number: 42,
        title: "feat(auth): Add multi-factor authentication",
        user: {
          login: "octocat",
          id: 583231
        },
        head: { ref: "feature/mfa" },
        base: { ref: "main" }
      }
    }
  },
  shopify_order: {
    name: "Shopify: New Order Created ($320.00)",
    integration_slug: "shopify-store",
    event_type: "order.created",
    payload: {
      id: "order_shop_9921",
      total_price: 320.0,
      currency: "USD",
      customer: {
        first_name: "Sarah",
        last_name: "Connor",
        email: "sarah.connor@cyberdyne.org"
      },
      line_items: [
        { title: "Smart Drone Sentinel", price: 320.0, quantity: 1 }
      ]
    }
  }
};

export default function WebhookSimulatorModal({ integrations = [], onClose, onDispatched }) {
  const [selectedIntegrationId, setSelectedIntegrationId] = useState(integrations[0]?.id || "");
  const [selectedTemplate, setSelectedTemplate] = useState("stripe_success");
  const [eventType, setEventType] = useState(SAMPLE_TEMPLATES.stripe_success.event_type);
  const [payloadText, setPayloadText] = useState(JSON.stringify(SAMPLE_TEMPLATES.stripe_success.payload, null, 2));
  const [idempotencyKey, setIdempotencyKey] = useState(`idemp_${Math.random().toString(36).substring(2, 9)}`);
  const [invalidSig, setInvalidSig] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responseResult, setResponseResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleTemplateChange = (key) => {
    setSelectedTemplate(key);
    const tmpl = SAMPLE_TEMPLATES[key];
    if (tmpl) {
      setEventType(tmpl.event_type);
      setPayloadText(JSON.stringify(tmpl.payload, null, 2));
      // Auto-select corresponding integration if exists
      const matched = integrations.find(i => i.slug === tmpl.integration_slug || i.provider === tmpl.integration_slug.split("-")[0]);
      if (matched) {
        setSelectedIntegrationId(matched.id);
      }
    }
  };

  const handleSimulate = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setResponseResult(null);

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payloadText);
    } catch (e) {
      setErrorMsg(`Invalid JSON payload: ${e.message}`);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await api.simulateWebhook(selectedIntegrationId, {
        event_type: eventType,
        payload: parsedPayload,
        idempotency_key: idempotencyKey,
        invalid_signature: invalidSig
      });
      setResponseResult(res);
      onDispatched?.();
    } catch (err) {
      setErrorMsg(err.message || "Simulation request failed");
      if (err.details) {
        setResponseResult(err.details);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateNewIdempotencyKey = () => {
    setIdempotencyKey(`idemp_${Math.random().toString(36).substring(2, 9)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Interactive Webhook Simulator</h3>
              <p className="text-xs text-slate-400">
                Trigger real and simulated webhook events, test HMAC validation, and verify duplicate-event idempotency.
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

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Preset Selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Select Preset Scenario:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(SAMPLE_TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTemplateChange(key)}
                  className={`p-2.5 rounded-xl text-left border text-xs font-medium transition-all ${
                    selectedTemplate === key
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "border-white/5 bg-slate-950/50 text-slate-400 hover:text-white hover:border-white/10"
                  }`}
                >
                  <div className="font-semibold text-slate-200">{t.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{t.event_type}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Integration & Event Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Target Integration:
              </label>
              <select
                value={selectedIntegrationId}
                onChange={(e) => setSelectedIntegrationId(e.target.value)}
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
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Event Type:
              </label>
              <input
                type="text"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Advanced Test Options: Idempotency & HMAC Failure */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-slate-300">Idempotency Key (Duplicate Prevention):</span>
              </div>
              <button
                type="button"
                onClick={generateNewIdempotencyKey}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Generate New Key
              </button>
            </div>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-slate-200"
              placeholder="e.g. idemp_12345"
            />
            <p className="text-[11px] text-slate-400">
              💡 Sending two requests with the same key verifies that the second request is recognized as a duplicate and skipped.
            </p>

            {/* Toggle Invalid Signature */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={invalidSig}
                  onChange={(e) => setInvalidSig(e.target.checked)}
                  className="rounded bg-slate-800 border-white/20 text-indigo-600 focus:ring-0"
                />
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Simulate Invalid HMAC Signature (Test 401 Rejection)
                </span>
              </label>
            </div>
          </div>

          {/* JSON Payload Editor */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              JSON Event Payload:
            </label>
            <textarea
              rows={8}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs text-indigo-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Response Feedback Box */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {responseResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Server Response
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  Status: {responseResult.status || "OK"}
                </span>
              </div>
              <p className="text-xs text-slate-300">{responseResult.message}</p>
              {responseResult.signature && (
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  Computed HMAC: <span className="text-slate-300">{responseResult.signature}</span>
                </div>
              )}
              {responseResult.triggered_executions?.length > 0 && (
                <div className="text-[11px] text-indigo-300 mt-2">
                  ⚡ Triggered Executions: {responseResult.triggered_executions.map(e => e.execution_id).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Endpoint: /api/v1/integrations/:id/simulate
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSimulate}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <Send className={`w-3.5 h-3.5 ${isSubmitting ? "animate-pulse" : ""}`} />
              <span>{isSubmitting ? "Dispatching..." : "Dispatch Simulated Webhook"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
