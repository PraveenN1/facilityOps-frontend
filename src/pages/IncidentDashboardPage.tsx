import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

import { listIncidents } from "../api/client";
import { incidentStatuses } from "../api/config";
import type { IncidentStatusValue } from "../api/types";
import { useIdentity } from "../state/IdentityContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

const pageSize = 10;

export function IncidentDashboardPage() {
  const { headers } = useIdentity();
  const [status, setStatus] = useState<IncidentStatusValue | "">("");
  const [offset, setOffset] = useState(0);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", headers, status, offset],
    queryFn: () => listIncidents(headers, { limit: pageSize, offset, status }),
  });

  const total = incidentsQuery.data?.total ?? 0;
  const canGoBack = offset > 0;
  const canGoForward = offset + pageSize < total;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Incident dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Building-scoped incident queue with AI triage visibility.</p>
        </div>
        <label className="field-label w-full sm:w-64">
          Status filter
          <select
            className="field-input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as IncidentStatusValue | "");
              setOffset(0);
            }}
          >
            <option value="">All statuses</option>
            {incidentStatuses.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      {incidentsQuery.isLoading ? <LoadingState label="Loading incidents" /> : null}
      {incidentsQuery.isError ? <ErrorState detail={incidentsQuery.error.message} /> : null}

      {incidentsQuery.data && incidentsQuery.data.items.length === 0 ? (
        <EmptyState title="No incidents found" detail="Try a different status filter or development identity." />
      ) : null}

      {incidentsQuery.data && incidentsQuery.data.items.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Incident
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Complaint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    AI triage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidentsQuery.data.items.map((incident) => (
                  <tr key={incident.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 align-top">
                      <Link className="font-semibold text-cyan-800 hover:text-cyan-950" to={`/incidents/${incident.id}`}>
                        {compactUuid(incident.id)}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">{incident.category ?? "Uncategorized"}</div>
                    </td>
                    <td className="max-w-md px-4 py-3 align-top text-sm text-slate-700">
                      {incident.complaint_description}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={incident.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={incident.ai_triage_status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-slate-600">
                      {formatDateTime(incident.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-600">
              Showing {offset + 1}-{Math.min(offset + pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button className="secondary-button" disabled={!canGoBack} onClick={() => setOffset(Math.max(0, offset - pageSize))}>
                Previous
              </button>
              <button className="secondary-button" disabled={!canGoForward} onClick={() => setOffset(offset + pageSize)}>
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
