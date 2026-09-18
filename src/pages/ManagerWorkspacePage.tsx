import { useQuery } from "@tanstack/react-query";
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

  return (
    <section className="stack-lg">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Manager workspace</p>
          <h2>Operations overview</h2>
          <p className="muted-copy">{selectedBuilding ? selectedBuilding.name : "All authorized buildings returned by the backend"}</p>
        </div>
        <Link className="secondary-button" to="/incidents">Open incident queue</Link>
      </div>
      {operations.isLoading || ai.isLoading ? <LoadingState label="Loading metrics" /> : null}
      {operations.isError ? <ErrorState detail={operations.error.message} /> : null}
      {ai.isError ? <ErrorState detail={ai.error.message} /> : null}
      {operations.data && ai.data ? (
        <div className="metrics-grid">
          <Metric label="Open incidents" value={operations.data.open_incidents} />
          <Metric label="Pending triage" value={operations.data.pending_triage} />
          <Metric label="Awaiting assignment" value={operations.data.awaiting_assignment} />
          <Metric label="Active assignments" value={operations.data.active_technician_assignments} />
          <Metric label="Available technicians" value={operations.data.available_technicians} />
          <Metric label="AI processed" value={ai.data.successfully_processed_requests} accent="ai" />
          <Metric label="AI failures" value={ai.data.failed_requests} accent="ai" />
          <Metric label="Human-review backlog" value={ai.data.incidents_awaiting_human_review} accent="ai" />
        </div>
      ) : null}
      <div className="panel">
        <div className="section-heading compact">
          <div>
            <h3>Immediate queue</h3>
            <p className="muted-copy">Server-paginated list. Global metrics are not calculated from this page.</p>
          </div>
        </div>
        <IncidentDashboardPage embedded />
      </div>
    </section>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: "ai" }) {
  return (
    <div className={`metric-tile ${accent === "ai" ? "ai" : ""}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

export function AiStateSummary({ status }: { status: string | null | undefined }) {
  if (!status) return <EmptyState title="Awaiting AI signal" detail="No triage result or outbox status is visible yet." />;
  return <StatusBadge status={status} />;
}
