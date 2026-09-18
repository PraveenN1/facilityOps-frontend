import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { listIncidents } from "../api/client";
import { incidentStatuses } from "../api/config";
import type { IncidentStatusValue } from "../api/types";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

const pageSize = 10;

export function IncidentDashboardPage({ embedded = false }: { embedded?: boolean }) {
  const { buildings, selectedBuildingId, selectedBuilding } = useBuildingSelection();
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
  const buildingNameById = new Map(buildings.map((building) => [building.id, building.name]));

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
          Status filter
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
        <div className="queue-list" role="table" aria-label="Incident queue">
          <div className="queue-header" role="row">
            <span>Incident</span>
            <span>Complaint</span>
            <span>Workflow</span>
            <span>AI state</span>
            <span>Created</span>
          </div>
          {incidentsQuery.data.items.map((incident) => (
            <article key={incident.id} className={`queue-row priority-edge priority-${incident.priority.toLowerCase()}`} role="row">
              <div className="queue-ref" role="cell">
                <Link className="mono-link" to={`/incidents/${incident.id}`} aria-label={`Open incident ${incident.id}`}>
                  {compactUuid(incident.id)}
                </Link>
                <span>{buildingNameById.get(incident.building_id) ?? "Authorized building"}</span>
              </div>
              <div className="queue-summary" role="cell">
                <strong>{incident.complaint_description}</strong>
                <span>{incident.category ?? "Uncategorized"} · {incident.priority}</span>
              </div>
              <div role="cell"><StatusBadge status={incident.status} /></div>
              <div role="cell"><StatusBadge status={incident.ai_triage_status} ai /></div>
              <time className="mono-cell queue-time" role="cell" dateTime={incident.created_at}>{formatDateTime(incident.created_at)}</time>
            </article>
          ))}
          <div className="pagination-row">
            <span>Showing {offset + 1}-{Math.min(offset + pageSize, total)} of {total}</span>
            <div><button className="secondary-button" disabled={!canGoBack} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</button><button className="secondary-button" disabled={!canGoForward} onClick={() => setOffset(offset + pageSize)}>Next</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
