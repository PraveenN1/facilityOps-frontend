import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarClock, CheckCircle2, ClipboardList, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { createComplaint, listMyComplaints } from "../api/client";
import type { ComplaintCreateResponse, ReporterComplaintListItem } from "../api/types";
import { useAuth } from "../state/AuthContext";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { formatDateTime } from "../utils/format";

const pageSize = 20;
function newIdempotencyKey() { return crypto.randomUUID(); }

export function ReporterWorkspacePage() {
  const { user } = useAuth();
  const { buildings } = useBuildingSelection();
  const complaints = useQuery({ queryKey: ["complaints", "mine"], queryFn: () => listMyComplaints({ limit: pageSize, offset: 0 }) });
  const authorizedBuildings = buildings.length > 0 ? buildings : user?.buildings ?? [];
  const buildingNameById = new Map(authorizedBuildings.map((building) => [building.id, building.name]));
  const items = complaints.data?.items ?? [];

  return (
    <section className="stack-lg reporter-workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Request portal</p>
          <h2>My requests</h2>
          <p className="muted-copy">Track maintenance requests submitted from your account.</p>
        </div>
        <Link className="primary-button icon-button" to="/complaints/new"><Plus aria-hidden size={16} />New request</Link>
      </div>
      {complaints.isLoading ? <LoadingState label="Loading requests" /> : null}
      {complaints.isError ? <ErrorState detail={complaints.error.message} /> : null}
      {complaints.data && items.length === 0 ? (
        <EmptyState title="No requests yet" detail="Create a maintenance request and it will appear here with its ticket reference." action={<Link className="primary-button icon-button" to="/complaints/new"><Plus aria-hidden size={16} />Create request</Link>} />
      ) : null}
      {items.length > 0 ? (
        <div className="complaint-list" aria-label="Reporter requests">
          {items.map((complaint) => (
            <Link
              key={complaint.id}
              to={`/incidents/${complaint.incident_id}`}
              className="complaint-row request-card priority-edge priority-medium"
              aria-label={`View details for ticket ${complaint.public_ticket_id}`}
            >
              <div className="request-card-main">
                <div className="request-card-titleline">
                  <strong>{requestTitle(complaint)}</strong>
                  <StatusBadge status={reporterStatusLabel(complaint.incident_status)} />
                </div>
                <div className="request-card-meta" aria-label="Request summary">
                  <span className="mono-cell">{complaint.public_ticket_id}</span>
                  <span><Building2 aria-hidden size={14} />{buildingNameById.get(complaint.building_id) ?? "Authorized building"}</span>
                  <span><CalendarClock aria-hidden size={14} />Submitted {formatDateTime(complaint.created_at)}</span>
                </div>
              </div>
              <div className="request-card-status">
                <span>{nextStepForStatus(complaint.incident_status)}</span>
                <span className="request-open">View details <ArrowRight aria-hidden size={14} /></span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ComplaintCreatePage() {
  const queryClient = useQueryClient();
  const { buildings, selectedBuildingId } = useBuildingSelection();
  const initialBuilding = selectedBuildingId ?? (buildings.length === 1 ? buildings[0].id : "");
  const [buildingId, setBuildingId] = useState(initialBuilding);
  const [description, setDescription] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [createdRequest, setCreatedRequest] = useState<ComplaintCreateResponse | null>(null);
  const canSubmit = useMemo(() => buildingId.trim() && description.trim(), [buildingId, description]);

  const mutation = useMutation({
    mutationFn: () => createComplaint({ building_id: buildingId.trim(), description: description.trim() }, idempotencyKey),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setCreatedRequest(response);
      setIdempotencyKey(newIdempotencyKey());
      setDescription("");
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); mutation.mutate(); };

  return (
    <section className="narrow-page stack-lg">
      <div><p className="eyebrow">New request</p><h2>Tell us what needs attention</h2><p className="muted-copy">Share the location, what you noticed, and any symptoms that will help the facilities team respond.</p></div>
      {createdRequest ? (
        <div role="status" className="success-note request-success">
          <p className="font-semibold icon-heading"><CheckCircle2 aria-hidden size={18} />Request submitted</p>
          <p>Ticket <span className="mono-cell">{createdRequest.public_ticket_id}</span> was created and is ready to track.</p>
          <Link className="primary-button icon-button fit" to={`/incidents/${createdRequest.incident_id}`}>View request <ArrowRight aria-hidden size={16} /></Link>
        </div>
      ) : null}
      <form onSubmit={submit} className="panel stack">
        <label className="field-label">Building
          <select required className="field-input" value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="">Select building</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label>
        <label className="field-label">Maintenance request
          <textarea required className="field-input min-h-36" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Example: Conference room 4B is too warm and airflow seems weak near the ceiling vents." />
        </label>
        <p className="info-note">Include the exact location and symptoms. For urgent hazards or emergencies, contact building security or emergency services immediately.</p>
        {mutation.isError ? <ErrorState title="Request was not submitted" detail={mutation.error.message} /> : null}
        <button className="primary-button icon-button" disabled={!canSubmit || mutation.isPending} type="submit">
          <Plus aria-hidden size={16} />
          {mutation.isPending ? "Submitting request..." : "Submit request"}
        </button>
      </form>
    </section>
  );
}

export function reporterStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_TRIAGE: "Under review",
    MANUAL_REVIEW: "Under review",
    AWAITING_ASSIGNMENT: "Technician being arranged",
    AWAITING_APPROVAL: "Awaiting team review",
    ASSIGNED: "Technician assigned",
    IN_PROGRESS: "Work in progress",
    RESOLVED: "Work completed",
    CLOSED: "Closed",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function nextStepForStatus(status: string) {
  const labels: Record<string, string> = {
    PENDING_TRIAGE: "The facility team is reviewing your request.",
    MANUAL_REVIEW: "The facility team is reviewing your request.",
    AWAITING_ASSIGNMENT: "Your request has been reviewed. A technician is being arranged.",
    AWAITING_APPROVAL: "The team is confirming the next action.",
    ASSIGNED: "A technician has been assigned.",
    IN_PROGRESS: "Work is currently in progress.",
    RESOLVED: "Work has been marked complete and is awaiting final closure.",
    CLOSED: "Your request has been closed.",
  };
  return labels[status] ?? "The request is being processed.";
}

export const reporterProgressSteps = [
  { statuses: [], label: "Submitted" },
  { statuses: ["PENDING_TRIAGE", "MANUAL_REVIEW"], label: "Under review" },
  { statuses: ["AWAITING_ASSIGNMENT", "AWAITING_APPROVAL"], label: "Awaiting technician" },
  { statuses: ["ASSIGNED"], label: "Technician assigned" },
  { statuses: ["IN_PROGRESS"], label: "Work in progress" },
  { statuses: ["RESOLVED"], label: "Work completed" },
  { statuses: ["CLOSED"], label: "Closed" },
];

export function reporterProgressIndex(status: string) {
  const foundIndex = reporterProgressSteps.findIndex((step) => step.statuses.includes(status));
  return foundIndex === -1 ? 1 : foundIndex;
}

function requestTitle(complaint: ReporterComplaintListItem) {
  return complaint.description.length > 110 ? `${complaint.description.slice(0, 107)}...` : complaint.description;
}