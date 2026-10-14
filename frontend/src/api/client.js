const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api/v1";

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data.error || data.message || `HTTP ${res.status}: ${res.statusText}`;
      const error = new Error(errorMsg);
      error.status = res.status;
      error.details = data;
      throw error;
    }
    return data;
  } catch (err) {
    console.error(`API request error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Analytics
  getAnalytics: () => request("/analytics/overview"),

  // Integrations
  getIntegrations: () => request("/integrations"),
  getIntegration: (id) => request(`/integrations/${id}`),
  createIntegration: (data) => request("/integrations", { method: "POST", body: JSON.stringify(data) }),
  updateIntegration: (id, data) => request(`/integrations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteIntegration: (id) => request(`/integrations/${id}`, { method: "DELETE" }),
  getIntegrationEvents: (id) => request(`/integrations/${id}/events`),
  simulateWebhook: (id, data) => request(`/integrations/${id}/simulate`, { method: "POST", body: JSON.stringify(data) }),

  // Workflows
  getWorkflows: (integrationId) => {
    const query = integrationId ? `?integration_id=${integrationId}` : "";
    return request(`/workflows${query}`);
  },
  getWorkflow: (id) => request(`/workflows/${id}`),
  createWorkflow: (data) => request("/workflows", { method: "POST", body: JSON.stringify(data) }),
  updateWorkflow: (id, data) => request(`/workflows/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteWorkflow: (id) => request(`/workflows/${id}`, { method: "DELETE" }),
  runWorkflow: (id, payload) => request(`/workflows/${id}/run`, { method: "POST", body: JSON.stringify({ payload }) }),

  // Executions
  getExecutions: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== "all") params.append("status", filters.status);
    if (filters.workflow_id) params.append("workflow_id", filters.workflow_id);
    if (filters.limit) params.append("limit", filters.limit);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/executions${query}`);
  },
  getExecution: (id) => request(`/executions/${id}`),
  retryExecution: (id, data = {}) => request(`/executions/${id}/retry`, { method: "POST", body: JSON.stringify(data) }),

  // AI Analyzer
  analyzeExecution: (id) => request(`/ai/executions/${id}/analyze`, { method: "POST" }),
};
