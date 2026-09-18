import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createComplaint, listMyComplaints } from "../api/client";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

const pageSize = 20;
function newIdempotencyKey() { return crypto.randomUUID(); }

export function ReporterWorkspacePage() {
  const complaints = useQuery({ queryKey: ["complaints", "mine"], queryFn: () => listMyComplaints({ limit: pageSize, offset: 0 }) });
  return (
    <section className="stack-lg">
      <div className="section-heading"><div><p className="eyebrow">Reporter workspace</p><h2>My complaints</h2><p className="muted-copy">Track only complaints submitted by your authenticated account.</p></div><Link className="primary-button" to="/complaints/new">New complaint</Link></div>
      {complaints.isLoading ? <LoadingState label="Loading complaints" /> : null}
      {complaints.isError ? <ErrorState detail={complaints.error.message} /> : null}
      {complaints.data?.items.length === 0 ? <EmptyState title="No complaints yet" detail="Submit a maintenance request to start tracking it." /> : null}
      <div className="complaint-list">
        {complaints.data?.items.map((complaint) => (
          <Link key={complaint.id} to={`/incidents/${complaint.incident_id}`} className="complaint-row priority-edge priority-medium">
            <div><strong>{complaint.description}</strong><span className="mono-cell">{compactUuid(complaint.id)} · {formatDateTime(complaint.created_at)}</span></div>
            <StatusBadge status={complaint.incident_status} />
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
      <div><p className="eyebrow">Reporter workspace</p><h2>Submit complaint</h2><p className="muted-copy">Creates a complaint, primary incident, and AI triage outbox event after commit.</p></div>
      <form onSubmit={submit} className="panel stack">
        <label className="field-label">Building
          <select required className="field-input" value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="">Select building</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label>
        <label className="field-label">Complaint description
          <textarea required className="field-input min-h-36" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Example: Water leakage near an electrical panel" />
        </label>
        <div className="tech-value">Idempotency key: <code>{idempotencyKey}</code></div>
        {mutation.isError ? <ErrorState title="Complaint was not submitted" detail={mutation.error.message} /> : null}
        <button className="primary-button" disabled={!canSubmit || mutation.isPending} type="submit">{mutation.isPending ? "Submitting" : "Submit complaint"}</button>
      </form>
    </section>
  );
}
