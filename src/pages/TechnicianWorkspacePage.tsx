import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useRef, useState } from "react";

import { isApiError, listMyWork, resolveIncident, startIncident } from "../api/client";
import type { TechnicianWorkItem } from "../api/types";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

interface ResolutionConfirmation {
  incidentId: string;
  description: string;
  resolutionNotes: string | null;
}

export function TechnicianWorkspacePage() {
  const queryClient = useQueryClient();
  const { buildings } = useBuildingSelection();
  const [resolvedJob, setResolvedJob] = useState<ResolutionConfirmation | null>(null);
  const workQuery = useQuery({ queryKey: ["technician", "my-work"], queryFn: listMyWork });
  const refresh = (incidentId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["technician", "my-work"] });
    void queryClient.invalidateQueries({ queryKey: ["incidents"] });
    void queryClient.invalidateQueries({ queryKey: ["metrics"] });
    if (incidentId) void queryClient.invalidateQueries({ queryKey: ["incident", incidentId] });
  };

  const items = workQuery.data?.items ?? [];

  return (
    <section className="tech-workspace stack-lg">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Technician workspace</p>
          <h2>My assigned work</h2>
          <p className="muted-copy">Only active work assigned to your authenticated technician profile.</p>
        </div>
      </div>

      {resolvedJob ? <ResolutionSuccess confirmation={resolvedJob} /> : null}
      {workQuery.isLoading ? <LoadingState label="Loading work orders" /> : null}
      {workQuery.isError ? <ErrorState title={authErrorTitle(workQuery.error)} detail={workQuery.error.message} /> : null}
      {workQuery.data && items.length === 0 ? (
        <EmptyState title="No active work orders" detail="Assigned and in-progress jobs will appear here." />
      ) : null}
      {items.length > 0 ? (
        <div className="work-list">
          {items.map((item) => (
            <WorkCard
              key={item.assignment_id}
              item={item}
              buildingName={buildings.find((building) => building.id === item.building_id)?.name ?? "Authorized building"}
              onStarted={() => refresh(item.id)}
              onResolved={(confirmation) => {
                setResolvedJob(confirmation);
                refresh(item.id);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ResolutionSuccess({ confirmation }: { confirmation: ResolutionConfirmation }) {
  return (
    <div role="status" className="success-note">
      <p className="font-semibold">Resolved {compactUuid(confirmation.incidentId)}</p>
      <p>{confirmation.description}</p>
      <p>This job left your active queue after the server confirmed the resolution.</p>
      {confirmation.resolutionNotes ? <p>Resolution notes: {confirmation.resolutionNotes}</p> : null}
    </div>
  );
}

function WorkCard({
  item,
  buildingName,
  onStarted,
  onResolved,
}: {
  item: TechnicianWorkItem;
  buildingName: string;
  onStarted: () => void;
  onResolved: (confirmation: ResolutionConfirmation) => void;
}) {
  const [notes, setNotes] = useState("");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const startPendingRef = useRef(false);
  const resolvePendingRef = useRef(false);

  const start = useMutation({
    mutationFn: () => startIncident(item.id, { expected_version: item.version }),
    onMutate: () => {
      startPendingRef.current = true;
      setConflictMessage(null);
    },
    onSuccess: onStarted,
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        setConflictMessage("This work order changed. Review the refreshed queue before acting again.");
        onStarted();
      }
    },
    onSettled: () => {
      startPendingRef.current = false;
    },
  });
  const resolve = useMutation({
    mutationFn: () => resolveIncident(item.id, { expected_version: item.version, resolution_notes: notes.trim() }),
    onMutate: () => {
      resolvePendingRef.current = true;
      setConflictMessage(null);
    },
    onSuccess: (incident) => {
      onResolved({
        incidentId: incident.id,
        description: incident.complaint_description,
        resolutionNotes: notes.trim() || null,
      });
      setNotes("");
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        setConflictMessage("This work order changed. Review the refreshed queue before acting again.");
        onStarted();
      }
    },
    onSettled: () => {
      resolvePendingRef.current = false;
    },
  });
  const error = start.error ?? resolve.error;
  const pending = start.isPending || resolve.isPending;

  return (
    <article className={`work-card work-order-card priority-edge priority-${item.priority.toLowerCase()}`}>
      <div className="work-order-main">
        <div className="work-order-head">
          <div>
            <p className="eyebrow">Work order</p>
            <h3>{item.complaint_description}</h3>
          </div>
          <StatusBadge status={item.status} />
        </div>
        <dl className="work-order-meta">
          <div>
            <dt>Reference</dt>
            <dd>
              <Link to={`/incidents/${item.id}`} className="mono-link" aria-label={`Open incident ${item.id}`}>
                {compactUuid(item.id)}
              </Link>
            </dd>
          </div>
          <div><dt>Building</dt><dd>{buildingName}</dd></div>
          <div><dt>Category</dt><dd>{item.category ?? "Uncategorized"}</dd></div>
          <div><dt>Priority</dt><dd>{item.priority}</dd></div>
          <div><dt>Status</dt><dd>{item.status.replaceAll("_", " ")}</dd></div>
          <div><dt>Created</dt><dd>{formatDateTime(item.created_at)}</dd></div>
        </dl>
      </div>

      {conflictMessage ? <p className="danger-note">{conflictMessage}</p> : null}
      {error ? <ErrorState title={errorTitle(error)} detail={error.message} /> : null}
      {item.status === "ASSIGNED" ? (
        <button
          className="primary-button work-primary-action"
          disabled={pending}
          onClick={() => {
            if (startPendingRef.current) return;
            startPendingRef.current = true;
            start.mutate();
          }}
        >
          Start work
        </button>
      ) : null}
      {item.status === "IN_PROGRESS" ? (
        <form
          className="stack-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (!notes.trim() || resolvePendingRef.current) return;
            resolvePendingRef.current = true;
            resolve.mutate();
          }}
        >
          <label className="field-label">
            Resolution notes
            <textarea
              className="field-input resolution-textarea"
              placeholder="Describe the completed work"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              required
              minLength={1}
              maxLength={2000}
            />
          </label>
          <button className="primary-button work-primary-action" disabled={!notes.trim() || pending} type="submit">
            Resolve work
          </button>
        </form>
      ) : null}
    </article>
  );
}

function errorTitle(error: Error) {
  if (isApiError(error) && error.status === 409) return "Conflict requires review";
  if (isApiError(error) && (error.status === 401 || error.status === 403)) return "Access denied";
  return "Action failed";
}

function authErrorTitle(error: Error) {
  if (isApiError(error) && (error.status === 401 || error.status === 403)) return "Access denied";
  return "Unable to load work orders";
}
