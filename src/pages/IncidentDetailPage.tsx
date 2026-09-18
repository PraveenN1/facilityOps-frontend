import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  assignTechnician,
  closeIncident,
  getIncident,
  isApiError,
  listTechnicians,
  manualTriage,
  resolveIncident,
  startIncident,
} from "../api/client";
import { incidentPriorities } from "../api/config";
import type { IncidentDetailResponse, TechnicianListItem } from "../api/types";
import { useAuth } from "../state/AuthContext";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

export function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { role } = useAuth();
  const { selectedBuildingId } = useBuildingSelection();
  const queryClient = useQueryClient();

  const incidentQuery = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => getIncident(incidentId!),
    enabled: Boolean(incidentId),
  });

  const techniciansQuery = useQuery({
    queryKey: ["technicians", selectedBuildingId],
    queryFn: () => listTechnicians({ buildingId: selectedBuildingId }),
    enabled: role === "FACILITY_MANAGER",
  });

  const refreshWorkflow = () => {
    void queryClient.invalidateQueries({ queryKey: ["incident", incidentId] });
    void queryClient.invalidateQueries({ queryKey: ["incidents"] });
    void queryClient.invalidateQueries({ queryKey: ["technicians"] });
    void queryClient.invalidateQueries({ queryKey: ["technician", "my-work"] });
    void queryClient.invalidateQueries({ queryKey: ["complaints"] });
    void queryClient.invalidateQueries({ queryKey: ["metrics"] });
  };

  if (!incidentId) return <ErrorState detail="Incident ID is missing from the route." />;

  return (
    <section className="stack-lg">
      <div className="section-heading">
        <div>
          <Link to="/" className="text-link">Back to workspace</Link>
          <h2>Incident {compactUuid(incidentId)}</h2>
        </div>
        {incidentQuery.data ? <StatusBadge status={incidentQuery.data.status} /> : null}
      </div>

      {incidentQuery.isLoading ? <LoadingState label="Loading incident" /> : null}
      {incidentQuery.isError ? <ErrorState detail={incidentQuery.error.message} /> : null}

      {incidentQuery.data ? (
        <div className="detail-grid">
          <div className="stack">
            <IncidentSummary incident={incidentQuery.data} />
            <AiTriageReview incident={incidentQuery.data} canReview={role === "FACILITY_MANAGER"} onChanged={refreshWorkflow} />
          </div>
          <div className="stack">
            {role === "FACILITY_MANAGER" ? (
              <TechnicianAssignment
                incident={incidentQuery.data}
                technicians={techniciansQuery.data?.items ?? []}
                isLoading={techniciansQuery.isLoading}
                error={techniciansQuery.error}
                isSuccess={techniciansQuery.isSuccess}
                onChanged={refreshWorkflow}
              />
            ) : null}
            <IncidentLifecycle incident={incidentQuery.data} role={role} onChanged={refreshWorkflow} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IncidentSummary({ incident }: { incident: IncidentDetailResponse }) {
  return (
    <article className="panel stack priority-edge priority-medium">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Original complaint</p>
          <h3>{incident.category ?? "Uncategorized incident"}</h3>
        </div>
        <span className="mono-cell">v{incident.version}</span>
      </div>
      <p className="body-copy">{incident.complaint_description}</p>
      <dl className="definition-grid">
        <div><dt>Priority</dt><dd>{incident.priority}</dd></div>
        <div><dt>Building</dt><dd className="mono-cell">{compactUuid(incident.building_id)}</dd></div>
        <div><dt>Created</dt><dd>{formatDateTime(incident.created_at)}</dd></div>
        <div><dt>Updated</dt><dd>{formatDateTime(incident.updated_at)}</dd></div>
      </dl>
      <ActiveAssignment incident={incident} />
    </article>
  );
}

function ActiveAssignment({ incident }: { incident: IncidentDetailResponse }) {
  const assignment = incident.active_assignment;
  return (
    <div className="subsection">
      <h3>Current active assignment</h3>
      {assignment ? (
        <dl className="definition-grid">
          <div><dt>Technician</dt><dd>{assignment.technician_display_name}</dd></div>
          <div><dt>Status</dt><dd>{assignment.status}</dd></div>
          <div><dt>Assignment ID</dt><dd className="mono-cell">{assignment.assignment_id}</dd></div>
          <div><dt>Technician profile</dt><dd className="mono-cell">{assignment.technician_id}</dd></div>
        </dl>
      ) : (
        <EmptyState title="No active assignment" detail="Resolved incidents release capacity; historical assignments may still exist." />
      )}
    </div>
  );
}

function AiTriageReview({ incident, canReview, onChanged }: { incident: IncidentDetailResponse; canReview: boolean; onChanged: () => void }) {
  const [category, setCategory] = useState(incident.latest_triage_result?.validated_result?.category ?? incident.category ?? "");
  const [priority, setPriority] = useState(incident.latest_triage_result?.validated_result?.suggested_priority ?? incident.priority);
  const [suspectedHazard, setSuspectedHazard] = useState(false);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => manualTriage(incident.id, { category, priority, expected_version: incident.version, suspected_hazard: suspectedHazard, notes: notes.trim() || null }),
    onSuccess: onChanged,
  });

  const triage = incident.latest_triage_result;
  const recommendation = triage?.validated_result;
  const isFailed = ["FAILED", "INVALID_OUTPUT", "TIMEOUT"].includes(incident.ai_triage_status ?? "");

  return (
    <article className="panel stack ai-panel">
      <div className="section-heading compact">
        <div><p className="eyebrow">AI triage review</p><h3>Recommendation</h3></div>
        <StatusBadge status={incident.ai_triage_status} ai />
      </div>
      {!incident.ai_triage_status ? <EmptyState title="No AI status yet" detail="The triage event may still be waiting for the worker." /> : null}
      {incident.ai_triage_status === "PENDING" || incident.ai_triage_status === "PROCESSING" ? <p className="info-note">AI triage is still pending.</p> : null}
      {isFailed ? <p className="danger-note">AI triage did not produce a usable recommendation. Review the complaint manually.</p> : null}
      {recommendation ? (
        <dl className="definition-grid">
          <div><dt>Category</dt><dd>{recommendation.category}</dd></div>
          <div><dt>Suggested priority</dt><dd>{recommendation.suggested_priority}</dd></div>
          <div className="wide"><dt>Summary</dt><dd>{recommendation.issue_summary}</dd></div>
          <div className="wide"><dt>Location</dt><dd>{recommendation.location ?? "None provided"}</dd></div>
          <div className="wide"><dt>Safety notes</dt><dd>{recommendation.safety_notes.length ? recommendation.safety_notes.join(", ") : "None provided"}</dd></div>
        </dl>
      ) : null}
      {canReview ? (
        <form className="stack subsection" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); mutation.mutate(); }}>
          <div className="form-grid">
            <label className="field-label">Confirmed category<input required className="field-input" value={category} onChange={(event) => setCategory(event.target.value)} /></label>
            <label className="field-label">Confirmed priority<select className="field-input" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{incidentPriorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <label className="field-label">Review notes<textarea className="field-input" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <label className="check-row"><input type="checkbox" checked={suspectedHazard} onChange={(event) => setSuspectedHazard(event.target.checked)} />Suspected hazard requiring escalation</label>
          {mutation.isError ? <MutationError title="Manual triage failed" error={mutation.error} /> : null}
          <button className="primary-button fit" disabled={mutation.isPending || incident.status !== "PENDING_TRIAGE"} type="submit">Confirm triage</button>
        </form>
      ) : <p className="info-note">Only facility managers can confirm AI triage recommendations.</p>}
    </article>
  );
}

function TechnicianAssignment({ incident, technicians, isLoading, error, isSuccess, onChanged }: { incident: IncidentDetailResponse; technicians: TechnicianListItem[]; isLoading: boolean; error: Error | null; isSuccess: boolean; onChanged: () => void }) {
  const [technicianId, setTechnicianId] = useState("");
  const mutation = useMutation({ mutationFn: () => assignTechnician(incident.id, { technician_id: technicianId, expected_version: incident.version }), onSuccess: onChanged });

  return (
    <article className="panel stack">
      <div><p className="eyebrow">Assignment</p><h3>Technician dispatch</h3><p className="muted-copy">Availability is derived from active ASSIGNED and IN_PROGRESS assignments.</p></div>
      {isLoading ? <LoadingState label="Loading technicians" /> : null}
      {error ? <ErrorState detail={error.message} /> : null}
      {technicians.length === 0 && isSuccess ? <EmptyState title="No technicians visible" detail="No technicians are visible to this manager session." /> : null}
      {technicians.length > 0 ? (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <label className="field-label">Technician<select className="field-input" value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} required><option value="">Select technician profile</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.display_name} - {technician.available ? "available" : "busy"}</option>)}</select></label>
          <div className="tech-list">{technicians.map((technician) => <div key={technician.id} className="tech-card"><div><strong>{technician.display_name}</strong><span>{technician.skills.join(", ") || "No skills recorded"}</span></div><StatusBadge status={technician.available ? "AVAILABLE" : "UNAVAILABLE"} /><code>profile {compactUuid(technician.id)}</code><code>user {compactUuid(technician.user_id)}</code></div>)}</div>
          {mutation.isError ? <MutationError title="Assignment failed" error={mutation.error} /> : null}
          <button className="primary-button" disabled={mutation.isPending || incident.status !== "AWAITING_ASSIGNMENT"} type="submit">Assign technician</button>
        </form>
      ) : null}
    </article>
  );
}

function IncidentLifecycle({ incident, role, onChanged }: { incident: IncidentDetailResponse; role: string | null; onChanged: () => void }) {
  const [resolutionNotes, setResolutionNotes] = useState("");
  const startMutation = useMutation({ mutationFn: () => startIncident(incident.id, { expected_version: incident.version }), onSuccess: onChanged });
  const resolveMutation = useMutation({ mutationFn: () => resolveIncident(incident.id, { expected_version: incident.version, resolution_notes: resolutionNotes.trim() }), onSuccess: onChanged });
  const closeMutation = useMutation({ mutationFn: () => closeIncident(incident.id, { expected_version: incident.version }), onSuccess: onChanged });
  const activeError = startMutation.error ?? resolveMutation.error ?? closeMutation.error;
  const pending = startMutation.isPending || resolveMutation.isPending || closeMutation.isPending;
  const canTechnicianAct = role === "TECHNICIAN";
  const canManagerClose = role === "FACILITY_MANAGER";
  const nextAction = useMemo(() => {
    if (incident.status === "ASSIGNED") return "Assigned technicians can start work.";
    if (incident.status === "IN_PROGRESS") return "Assigned technicians can resolve work with notes.";
    if (incident.status === "RESOLVED") return "Facility managers can close the incident.";
    return "No lifecycle action is available for this state.";
  }, [incident.status]);

  return (
    <article className="panel stack">
      <div><p className="eyebrow">Lifecycle</p><h3>State transition</h3><p className="muted-copy">{nextAction}</p></div>
      {incident.active_assignment ? <p className="info-note">Active assignment {compactUuid(incident.active_assignment.assignment_id)} is {incident.active_assignment.status} for {incident.active_assignment.technician_display_name}.</p> : <EmptyState title="No active assignment" detail="Start and resolve actions require the assigned technician session." />}
      <button className="primary-button" disabled={!canTechnicianAct || incident.status !== "ASSIGNED" || pending} onClick={() => startMutation.mutate()}>Start work</button>
      <label className="field-label">Resolution notes<textarea className="field-input" value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} /></label>
      <button className="primary-button" disabled={!canTechnicianAct || incident.status !== "IN_PROGRESS" || !resolutionNotes.trim() || pending} onClick={() => resolveMutation.mutate()}>Resolve work</button>
      <button className="secondary-button" disabled={!canManagerClose || incident.status !== "RESOLVED" || pending} onClick={() => closeMutation.mutate()}>Close incident</button>
      {activeError ? <MutationError title="Lifecycle transition failed" error={activeError} /> : null}
    </article>
  );
}

function MutationError({ title, error }: { title: string; error: Error }) {
  const conflict = isApiError(error) && error.status === 409;
  return (
    <div className="stack-sm">
      <ErrorState title={conflict ? "Conflict requires review" : title} detail={error.message} />
      {conflict ? <p className="danger-note">Refetch the latest incident state and review its version before retrying manually.</p> : null}
    </div>
  );
}
