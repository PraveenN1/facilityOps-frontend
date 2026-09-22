import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, Building2, CalendarClock, CheckCircle2, ClipboardList, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef, useState } from "react";

import { isApiError, listMyWork, resolveIncident, startIncident } from "../api/client";
import type { TechnicianWorkItem } from "../api/types";
import { useAuth } from "../state/AuthContext";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { formatDateTime } from "../utils/format";

interface ResolutionConfirmation {
  publicTicketId: string;
  description: string;
  resolutionNotes: string | null;
}

export function TechnicianWorkspacePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
          <p className="muted-copy">{user?.display_name ?? user?.email ?? "Technician"} · active assigned and in-progress work only.</p>
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
      <p className="font-semibold icon-heading"><CheckCircle2 aria-hidden size={18} />Resolved {confirmation.publicTicketId}</p>
      <p>{confirmation.description}</p>
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
        publicTicketId: incident.public_ticket_id,
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
          <div className="work-order-title-group">
            <p className="eyebrow">Work order</p>
            <h3 className="work-order-title">{item.complaint_description}</h3>
            <Link to={`/incidents/${item.id}`} className="mono-link work-ticket-link" aria-label={`Open ticket ${item.public_ticket_id}`}>
              {item.public_ticket_id}
            </Link>
          </div>
          <div className="work-status-stack" aria-label="Work order status and priority">
            <StatusBadge status={item.status} />
            <StatusBadge status={item.priority} />
          </div>
        </div>
        <div className="work-complaint-block">
          <p className="eyebrow">Original complaint</p>
          <p className="body-copy">{item.complaint_description}</p>
        </div>
        <TechnicianAiRecommendation item={item} />
        <dl className="work-order-meta">
          <div><dt><Building2 aria-hidden size={14} />Building</dt><dd>{buildingName}</dd></div>
          <div><dt><ClipboardList aria-hidden size={14} />Category</dt><dd>{item.category ?? "Uncategorized"}</dd></div>
          <div><dt>Status</dt><dd>{item.status.replaceAll("_", " ")}</dd></div>
          <div><dt><CalendarClock aria-hidden size={14} />Created</dt><dd>{formatDateTime(item.created_at)}</dd></div>
        </dl>
      </div>

      {conflictMessage ? <p className="danger-note">{conflictMessage}</p> : null}
      {error ? <ErrorState title={errorTitle(error)} detail={error.message} /> : null}
      {item.status === "ASSIGNED" ? (
        <button
          className="primary-button icon-button work-primary-action"
          disabled={pending}
          onClick={() => {
            if (startPendingRef.current) return;
            startPendingRef.current = true;
            start.mutate();
          }}
        >
          <Wrench aria-hidden size={16} />
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
          <button className="primary-button icon-button work-primary-action" disabled={!notes.trim() || pending} type="submit">
            <CheckCircle2 aria-hidden size={16} />
            Resolve work
          </button>
        </form>
      ) : null}
    </article>
  );
}

function TechnicianAiRecommendation({ item }: { item: TechnicianWorkItem }) {
  const recommendation = item.latest_triage_result?.validated_result;
  if (!recommendation) return null;

  return (
    <section className="work-ai-panel stack-sm" aria-label="AI recommendation">
      <div>
        <p className="eyebrow">AI recommendation</p>
        <h4 className="icon-heading"><BrainCircuit aria-hidden size={17} />Advisory recommendation</h4>
      </div>
      <dl className="work-ai-grid">
        <div><dt>AI-suggested category</dt><dd>{recommendation.category}</dd></div>
        <div><dt>AI-suggested priority</dt><dd>{recommendation.suggested_priority}</dd></div>
        <div className="wide"><dt>Summary</dt><dd>{recommendation.issue_summary}</dd></div>
        {recommendation.location ? <div className="wide"><dt>Location</dt><dd>{recommendation.location}</dd></div> : null}
      </dl>
      <p className="muted-copy">AI-generated guidance may require human verification. Follow facility safety procedures for immediate hazards.</p>
    </section>
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
