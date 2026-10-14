import React, { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Integrations from "./pages/Integrations";
import Workflows from "./pages/Workflows";
import Executions from "./pages/Executions";
import WebhookSimulatorModal from "./components/WebhookSimulatorModal";
import WorkflowBuilderModal from "./components/WorkflowBuilderModal";
import ExecutionDetailModal from "./components/ExecutionDetailModal";
import { api } from "./api/client";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [analytics, setAnalytics] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [workflowToEdit, setWorkflowToEdit] = useState(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [analyticsData, integrationsData, workflowsData, executionsData] = await Promise.all([
        api.getAnalytics().catch(() => null),
        api.getIntegrations().catch(() => []),
        api.getWorkflows().catch(() => []),
        api.getExecutions({ limit: 50 }).catch(() => []),
      ]);

      if (analyticsData) setAnalytics(analyticsData);
      if (integrationsData) setIntegrations(integrationsData);
      if (workflowsData) setWorkflows(workflowsData);
      if (executionsData) setExecutions(executionsData);
    } catch (err) {
      console.error("Failed to fetch platform telemetry:", err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  // Initial load and periodic background poll
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 4000); // 4-second reactive poll
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleEditWorkflow = (wf) => {
    setWorkflowToEdit(wf);
    setShowWorkflowBuilder(true);
  };

  const handleOpenCreateWorkflow = () => {
    setWorkflowToEdit(null);
    setShowWorkflowBuilder(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={() => fetchData()}
        isRefreshing={isRefreshing}
        onOpenSimulator={() => setShowSimulatorModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "dashboard" && (
          <Dashboard
            analytics={analytics}
            executions={executions}
            onOpenSimulator={() => setShowSimulatorModal(true)}
            onOpenWorkflowBuilder={handleOpenCreateWorkflow}
            onSelectExecution={setSelectedExecution}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "integrations" && (
          <Integrations
            integrations={integrations}
            onRefresh={() => fetchData()}
            onOpenSimulator={() => setShowSimulatorModal(true)}
          />
        )}

        {activeTab === "workflows" && (
          <Workflows
            workflows={workflows}
            integrations={integrations}
            onRefresh={() => fetchData()}
            onOpenCreate={handleOpenCreateWorkflow}
            onEditWorkflow={handleEditWorkflow}
          />
        )}

        {activeTab === "executions" && (
          <Executions
            executions={executions}
            onSelectExecution={setSelectedExecution}
            onRefresh={() => fetchData()}
          />
        )}
      </main>

      {/* Webhook Simulator Modal */}
      {showSimulatorModal && (
        <WebhookSimulatorModal
          integrations={integrations}
          onClose={() => setShowSimulatorModal(false)}
          onDispatched={() => fetchData(true)}
        />
      )}

      {/* Workflow Builder Modal */}
      {showWorkflowBuilder && (
        <WorkflowBuilderModal
          integrations={integrations}
          workflowToEdit={workflowToEdit}
          onClose={() => {
            setShowWorkflowBuilder(false);
            setWorkflowToEdit(null);
          }}
          onSaved={() => fetchData()}
        />
      )}

      {/* Execution Detail / AI Analysis Drawer */}
      {selectedExecution && (
        <ExecutionDetailModal
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
          onRefresh={() => fetchData()}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-400 glass-panel bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Edvexa AI-Powered API Integration & Automation Platform</span>
          <span className="font-mono text-[11px] text-slate-400">
            Flask REST API • SQLAlchemy • Async Worker • HMAC-SHA256 • React 19 • Tailwind CSS
          </span>
        </div>
      </footer>
    </div>
  );
}
