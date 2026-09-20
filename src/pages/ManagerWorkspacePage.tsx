import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, ClipboardList, Clock3, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { getAiMetrics, getOperationsMetrics } from "../api/client";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { IncidentDashboardPage } from "./IncidentDashboardPage";

export function ManagerWorkspacePage() {
  const { selectedBuildingId, selectedBuilding } = useBuildingSelection();
  const buildingId = selectedBuildingId;
  const operations = useQuery({ queryKey: ["metrics", "operations", buildingId], queryFn: () => getOperationsMetrics({ buildingId }) });
  const ai = useQuery({ queryKey: ["metrics", "ai", buildingId], queryFn: () => getAiMetrics({ buildingId }) });
  const hasMetrics = Boolean(operations.data && ai.data);

  return (
    <section className="stack-lg">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Manager workspace</p>
          <h2>Operations overview</h2>
          <p className="muted-copy">{selectedBuilding ? selectedBuilding.name : "All authorized buildings"}</p>
        </div>
        <Link className="secondary-button" to="/incidents">Open incident queue</Link>
      </div>
      {(operations.isLoading || ai.isLoading) && !hasMetrics ? <LoadingState label="Loading metrics" /> : null}
      {operations.isError ? <ErrorState detail={operations.error.message} /> : null}
      {ai.isError ? <ErrorState detail={ai.error.message} /> : null}
      {operations.data && ai.data ? (
        <div className="metrics-grid">
          <Metric label="Open incidents" value={operations.data.open_incidents} icon={ClipboardList} />
          <Metric label="Pending triage" value={operations.data.pending_triage} icon={Clock3} />
          <Metric label="Awaiting assignment" value={operations.data.awaiting_assignment} icon={Wrench} />
          <Metric label="Active assignments" value={operations.data.active_technician_assignments} icon={Users} />
          <Metric label="Available technicians" value={operations.data.available_technicians} icon={Users} />
          <Metric label="AI processed" value={ai.data.successfully_processed_requests} accent="ai" icon={BrainCircuit} />
          <Metric label="AI failures" value={ai.data.failed_requests} accent="ai" icon={BrainCircuit} />
          <Metric label="Human-review backlog" value={ai.data.incidents_awaiting_human_review} accent="ai" icon={Clock3} />
        </div>
      ) : null}
      {operations.data && ai.data && operations.data.total_incidents === 0 && ai.data.triage_requests === 0 ? (
        <EmptyState title="No operational data yet" detail="Metrics will populate from backend incidents, assignments, and triage events." />
      ) : null}
      <div className="panel">
        <div className="section-heading compact">
          <div>
            <h3>Incident queue</h3>
            <p className="muted-copy">{selectedBuilding ? selectedBuilding.name : "All authorized buildings"}</p>
          </div>
        </div>
        <IncidentDashboardPage embedded />
      </div>
    </section>
  );
}

function Metric({ label, value, accent, icon: Icon }: { label: string; value: number; accent?: "ai"; icon: LucideIcon }) {
  return (
    <div className={`metric-tile ${accent === "ai" ? "ai" : ""}`}>
      <span className="metric-label"><Icon aria-hidden size={16} />{label}</span>
      <strong className="metric-value">{value.toLocaleString()}</strong>
    </div>
  );
}

export function AiStateSummary({ status }: { status: string | null | undefined }) {
  if (!status) return <EmptyState title="Awaiting AI signal" detail="No triage result or outbox status is visible yet." />;
  return <StatusBadge status={status} />;
}
