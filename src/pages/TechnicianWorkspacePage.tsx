import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

import { isApiError, listMyWork, resolveIncident, startIncident } from "../api/client";
import type { TechnicianWorkItem } from "../api/types";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

export function TechnicianWorkspacePage() {
  const queryClient = useQueryClient();
  const workQuery = useQuery({ queryKey: ["technician", "my-work"], queryFn: listMyWork });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["technician", "my-work"] });

  return (
    <section className="tech-workspace stack-lg">
      <div className="section-heading"><div><p className="eyebrow">Technician workspace</p><h2>My assigned work</h2><p className="muted-copy">Only active work assigned to your authenticated technician profile.</p></div></div>
      {workQuery.isLoading ? <LoadingState label="Loading work orders" /> : null}
      {workQuery.isError ? <ErrorState detail={workQuery.error.message} /> : null}
      {workQuery.data?.items.length === 0 ? <EmptyState title="No active work" detail="Assigned and in-progress work orders appear here." /> : null}
      <div className="work-list">
        {workQuery.data?.items.map((item) => <WorkCard key={item.assignment_id} item={item} onChanged={refresh} />)}
      </div>
    </section>
  );
}

function WorkCard({ item, onChanged }: { item: TechnicianWorkItem; onChanged: () => void }) {
  const [notes, setNotes] = useState("");
  const start = useMutation({ mutationFn: () => startIncident(item.id, { expected_version: item.version }), onSuccess: onChanged });
  const resolve = useMutation({ mutationFn: () => resolveIncident(item.id, { expected_version: item.version, resolution_notes: notes.trim() }), onSuccess: onChanged });
  const error = start.error ?? resolve.error;
  return (
    <article className="work-card priority-edge priority-medium">
      <div className="work-card-head"><Link to={`/incidents/${item.id}`} className="mono-link">{compactUuid(item.id)}</Link><StatusBadge status={item.status} /></div>
      <p>{item.complaint_description}</p>
      <dl><div><dt>Category</dt><dd>{item.category ?? "Uncategorized"}</dd></div><div><dt>Created</dt><dd>{formatDateTime(item.created_at)}</dd></div></dl>
      {item.status === "IN_PROGRESS" ? <textarea className="field-input" placeholder="Resolution notes" value={notes} onChange={(event) => setNotes(event.target.value)} /> : null}
      {error ? <ErrorState title={isApiError(error) && error.status === 409 ? "Conflict requires review" : "Action failed"} detail={error.message} /> : null}
      <div className="action-row">
        <button className="primary-button" disabled={item.status !== "ASSIGNED" || start.isPending} onClick={() => start.mutate()}>Start work</button>
        <button className="primary-button" disabled={item.status !== "IN_PROGRESS" || !notes.trim() || resolve.isPending} onClick={() => resolve.mutate()}>Resolve work</button>
      </div>
    </article>
  );
}
