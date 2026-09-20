import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createComplaint, listMyComplaints } from "../api/client";
import type { ReporterComplaintListItem } from "../api/types";
import { useAuth } from "../state/AuthContext";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

const pageSize = 20;
function newIdempotencyKey() { return crypto.randomUUID(); }

export function ReporterWorkspacePage() {
  const { user } = useAuth();
  const { buildings } = useBuildingSelection();
  const complaints = useQuery({ queryKey: ["complaints", "mine"], queryFn: () => listMyComplaints({ limit: pageSize, offset: 0 }) });
  const authorizedBuildings = buildings.length > 0 ? buildings : user?.buildings ?? [];
  const buildingNameById = new Map(authorizedBuildings.map((building) => [building.id, building.name]));
  return (
    <section className="stack-lg">
      <div className="section-heading"><div><p className="eyebrow">Request portal</p><h2>My requests</h2><p className="muted-copy">Track maintenance requests submitted from your account.</p></div><Link className="primary-button" to="/complaints/new">New request</Link></div>
      {complaints.isLoading ? <LoadingState label="Loading requests" /> : null}
      {complaints.isError ? <ErrorState detail={complaints.error.message} /> : null}
      {complaints.data?.items.length === 0 ? <EmptyState title="No requests yet" detail="Submit a maintenance request to start tracking it." /> : null}
      <div className="complaint-list">
        {complaints.data?.items.map((complaint) => (
          <Link key={complaint.id} to={`/incidents/${complaint.incident_id}`} className="complaint-row priority-edge priority-medium">
            <div className="request-card-main">
              <strong>{requestTitle(complaint)}</strong>
              <span>Request {compactUuid(complaint.id)} · {buildingNameById.get(complaint.building_id) ?? "Authorized building"}</span>
              <span>Submitted {formatDateTime(complaint.created_at)}</span>
            </div>
            <div className="request-card-status">
              <StatusBadge status={reporterStatusLabel(complaint.incident_status)} />
              <span>{nextStepForStatus(complaint.incident_status)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ComplaintCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { buildings, selectedBuildingId } = useBuildingSelection();
  const initialBuilding = selectedBuildingId ?? (buildings.length === 1 ? buildings[0].id : "");
  const [buildingId, setBuildingId] = useState(initialBuilding);
  const [description, setDescription] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const canSubmit = useMemo(() => buildingId.trim() && description.trim(), [buildingId, description]);

  const mutation = useMutation({
    mutationFn: () => createComplaint({ building_id: buildingId.trim(), description: description.trim() }, idempotencyKey),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setIdempotencyKey(newIdempotencyKey());
      navigate(`/incidents/${response.incident_id}`);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); mutation.mutate(); };

  return (
    <section className="narrow-page stack-lg">
      <div><p className="eyebrow">New request</p><h2>Tell us what needs attention</h2><p className="muted-copy">Share the location, what you noticed, and any symptoms that will help the facilities team respond.</p></div>
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
        <button className="primary-button" disabled={!canSubmit || mutation.isPending} type="submit">{mutation.isPending ? "Submitting request..." : "Submit request"}</button>
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
    RESOLVED: "Work completed, awaiting closure",
    CLOSED: "Closed",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function nextStepForStatus(status: string) {
  const labels: Record<string, string> = {
    PENDING_TRIAGE: "The facilities team is reviewing the request.",
    MANUAL_REVIEW: "The facilities team is reviewing the request.",
    AWAITING_ASSIGNMENT: "The facility team has reviewed your request and is arranging a technician.",
    AWAITING_APPROVAL: "The team is confirming the next action.",
    ASSIGNED: "A technician has been assigned.",
    IN_PROGRESS: "A technician is working on the request.",
    RESOLVED: "Work has been marked complete and is awaiting final closure.",
    CLOSED: "This request has been closed.",
  };
  return labels[status] ?? "The request is being processed.";
}

function requestTitle(complaint: ReporterComplaintListItem) {
  return complaint.description.length > 110 ? `${complaint.description.slice(0, 107)}...` : complaint.description;
}
