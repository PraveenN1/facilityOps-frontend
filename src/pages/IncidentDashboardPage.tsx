import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BrainCircuit, CheckCircle2, ClipboardList, Clock3, Filter, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { listIncidents } from "../api/client";
import { incidentStatuses } from "../api/config";
import type { IncidentListItem, IncidentStatusValue } from "../api/types";
import { useAuth } from "../state/AuthContext";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { formatDateTime } from "../utils/format";

const pageSize = 10;

export function IncidentDashboardPage({ embedded = false }: { embedded?: boolean }) {
  const { buildings, selectedBuildingId, selectedBuilding } = useBuildingSelection();
  const { user } = useAuth();
  const [status, setStatus] = useState<IncidentStatusValue | "">("");
  const [offset, setOffset] = useState(0);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", selectedBuildingId, status, offset],
    queryFn: () => listIncidents({ limit: pageSize, offset, status, buildingId: selectedBuildingId }),
  });

  useEffect(() => {
    setOffset(0);
  }, [selectedBuildingId]);

  const total = incidentsQuery.data?.total ?? 0;
  const canGoBack = offset > 0;
  const canGoForward = offset + pageSize < total;
  const authorizedBuildings = buildings.length > 0 ? buildings : user?.buildings ?? [];
  const buildingNameById = new Map(authorizedBuildings.map((building) => [building.id, building.name]));

  return (
    <section className={embedded ? "stack" : "stack-lg"}>
      {!embedded ? (
        <div className="section-heading">
          <div>
            <p className="eyebrow">Manager workspace</p>
            <h2>Incident queue</h2>
            <p className="muted-copy">{selectedBuilding ? selectedBuilding.name : "All authorized buildings"}</p>
          </div>
        </div>
      ) : null}
      <div className="queue-toolbar">
        <label className="field-label compact-field">
          <span className="toolbar-label"><Filter aria-hidden size={15} />Status filter</span>
          <select className="field-input" value={status} onChange={(event) => { setStatus(event.target.value as IncidentStatusValue | ""); setOffset(0); }}>
            <option value="">All statuses</option>
            {incidentStatuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <span className="queue-count">{total.toLocaleString()} incidents</span>
      </div>
      {incidentsQuery.isLoading ? <LoadingState label="Loading incidents" /> : null}
      {incidentsQuery.isError ? <ErrorState detail={incidentsQuery.error.message} /> : null}
      {incidentsQuery.data && incidentsQuery.data.items.length === 0 ? <EmptyState title="No incidents found" detail="Try a different status filter or building scope." /> : null}
      {incidentsQuery.data && incidentsQuery.data.items.length > 0 ? (
        <div className="queue-list">
          <div className="queue-header" aria-hidden="true">
            <span>Complaint</span>
            <span>Metadata</span>
            <span>Workflow</span>
            <span>AI</span>
            <span></span>
          </div>
          <ul className="queue-items" role="list" aria-label="Incident queue">
            {incidentsQuery.data.items.map((incident) => (
              <li key={incident.id} className="queue-item">
                <Link
                  className={`queue-row priority-edge priority-${incident.priority.toLowerCase()}`}
                  to={`/incidents/${incident.id}`}
                  aria-label={`Open incident ${incident.public_ticket_id}: ${incident.complaint_description}`}
                >
                  <div className="queue-summary">
                    <strong>{incident.complaint_description}</strong>
                    <span className="queue-refline">Ticket {incident.public_ticket_id} · {buildingNameById.get(incident.building_id) ?? "Authorized building"}</span>
                  </div>
                  <div className="queue-meta">
                    <span>{incident.category ?? "Uncategorized"}</span>
                    <span>{incident.priority}</span>
                    <time dateTime={incident.created_at}>{formatDateTime(incident.created_at)}</time>
                  </div>
                  <WorkflowIndicator status={incident.status} />
                  <AiIndicator incident={incident} />
                  <span className="queue-open" aria-hidden="true"><ArrowRight size={18} /></span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="pagination-row">
            <span>Showing {offset + 1}-{Math.min(offset + pageSize, total)} of {total}</span>
            <div className="pager-actions"><button className="secondary-button" disabled={!canGoBack} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</button><button className="secondary-button" disabled={!canGoForward} onClick={() => setOffset(offset + pageSize)}>Next</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const workflowConfig: Record<IncidentStatusValue, { label: string; icon: LucideIcon; actionable?: boolean; complete?: boolean }> = {
  PENDING_TRIAGE: { label: "Pending triage", icon: Clock3, actionable: true },
  MANUAL_REVIEW: { label: "Manual review", icon: ClipboardList, actionable: true },
  AWAITING_ASSIGNMENT: { label: "Awaiting assignment", icon: Wrench, actionable: true },
  AWAITING_APPROVAL: { label: "Awaiting approval", icon: Clock3, actionable: true },
  ASSIGNED: { label: "Assigned", icon: Wrench, actionable: true },
  IN_PROGRESS: { label: "In progress", icon: Wrench, actionable: true },
  RESOLVED: { label: "Resolved", icon: CheckCircle2, complete: true },
  CLOSED: { label: "Closed", icon: CheckCircle2, complete: true },
};

export function workflowLabel(status: IncidentStatusValue) {
  return workflowConfig[status]?.label ?? status.replaceAll("_", " ");
}

function WorkflowIndicator({ status }: { status: IncidentStatusValue }) {
  const config = workflowConfig[status];
  const Icon = config?.icon ?? ClipboardList;
  return (
    <div className={`queue-state ${config?.actionable ? "actionable" : ""} ${config?.complete ? "complete" : ""}`}>
      <Icon aria-hidden size={16} />
      <StatusBadge status={workflowLabel(status)} />
    </div>
  );
}

export function aiQueueLabel(incident: Pick<IncidentListItem, "ai_triage_status" | "latest_triage_result">) {
  const status = incident.ai_triage_status;
  const hasRecommendation = Boolean(incident.latest_triage_result?.validated_result);
  if (!status) return "AI not available";
  if ((status === "PROCESSED" || status === "SUCCEEDED") && hasRecommendation) return "AI recommendation ready";
  if (status === "PROCESSED_NO_RESULT" || status === "PROCESSED") return "Processed, no recommendation";
  if (status === "SUCCEEDED") return "AI completed";
  if (status === "SKIPPED_OBSOLETE") return "AI skipped after human review";
  if (status === "PENDING") return "AI pending";
  if (status === "PROCESSING") return "AI processing";
  if (status === "TIMEOUT") return "AI timed out";
  if (status === "FAILED") return "AI failed";
  return status.replaceAll("_", " ");
}

function AiIndicator({ incident }: { incident: IncidentListItem }) {
  const status = incident.ai_triage_status;
  const label = aiQueueLabel(incident);
  const failed = status === "FAILED" || status === "TIMEOUT" || status === "INVALID_OUTPUT";
  return (
    <div className={`queue-state ai ${failed ? "failed" : ""}`}>
      <BrainCircuit aria-hidden size={16} />
      <StatusBadge status={label} ai />
    </div>
  );
}
