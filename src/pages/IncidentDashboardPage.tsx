import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

import { listIncidents } from "../api/client";
import { incidentStatuses } from "../api/config";
import type { IncidentStatusValue } from "../api/types";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

const pageSize = 10;

export function IncidentDashboardPage({ embedded = false }: { embedded?: boolean }) {
  const { selectedBuildingId, selectedBuilding } = useBuildingSelection();
  const [status, setStatus] = useState<IncidentStatusValue | "">("");
  const [offset, setOffset] = useState(0);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", selectedBuildingId, status, offset],
    queryFn: () => listIncidents({ limit: pageSize, offset, status, buildingId: selectedBuildingId }),
  });

  const total = incidentsQuery.data?.total ?? 0;
  const canGoBack = offset > 0;
  const canGoForward = offset + pageSize < total;

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
      <div className="toolbar-row">
        <label className="field-label compact-field">
          Status filter
          <select className="field-input" value={status} onChange={(event) => { setStatus(event.target.value as IncidentStatusValue | ""); setOffset(0); }}>
            <option value="">All statuses</option>
            {incidentStatuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>
      {incidentsQuery.isLoading ? <LoadingState label="Loading incidents" /> : null}
      {incidentsQuery.isError ? <ErrorState detail={incidentsQuery.error.message} /> : null}
      {incidentsQuery.data && incidentsQuery.data.items.length === 0 ? <EmptyState title="No incidents found" detail="Try a different status filter or building scope." /> : null}
      {incidentsQuery.data && incidentsQuery.data.items.length > 0 ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Incident</th><th>Complaint</th><th>Status</th><th>AI</th><th>Created</th></tr></thead>
            <tbody>
              {incidentsQuery.data.items.map((incident) => (
                <tr key={incident.id} className={`priority-edge priority-${incident.priority.toLowerCase()}`}>
                  <td><Link className="mono-link" to={`/incidents/${incident.id}`}>{compactUuid(incident.id)}</Link><span>{incident.category ?? "Uncategorized"}</span></td>
                  <td>{incident.complaint_description}</td>
                  <td><StatusBadge status={incident.status} /></td>
                  <td><StatusBadge status={incident.ai_triage_status} ai /></td>
                  <td className="mono-cell">{formatDateTime(incident.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination-row">
            <span>Showing {offset + 1}-{Math.min(offset + pageSize, total)} of {total}</span>
            <div><button className="secondary-button" disabled={!canGoBack} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</button><button className="secondary-button" disabled={!canGoForward} onClick={() => setOffset(offset + pageSize)}>Next</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
