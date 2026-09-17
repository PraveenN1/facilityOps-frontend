import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  assignTechnician,
  closeIncident,
  getIncident,
  isApiError,
  manualTriage,
  resolveIncident,
  startIncident,
  listTechnicians,
} from "../api/client";
import { incidentPriorities } from "../api/config";
import type { IncidentDetailResponse } from "../api/types";
import { useIdentity } from "../state/IdentityContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { compactUuid, formatDateTime } from "../utils/format";

export function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { headers } = useIdentity();
  const queryClient = useQueryClient();

  const incidentQuery = useQuery({
    queryKey: ["incident", headers, incidentId],
    queryFn: () => getIncident(headers, incidentId!),
    enabled: Boolean(incidentId),
  });

  const refreshIncident = () => queryClient.invalidateQueries({ queryKey: ["incident"] });

  if (!incidentId) return <ErrorState detail="Incident ID is missing from the route." />;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/" className="text-sm font-medium text-cyan-800 hover:text-cyan-950">
            Back to dashboard
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Incident {compactUuid(incidentId)}</h2>
        </div>
        {incidentQuery.data ? <StatusBadge status={incidentQuery.data.status} /> : null}
      </div>

      {incidentQuery.isLoading ? <LoadingState label="Loading incident" /> : null}
      {incidentQuery.isError ? <ErrorState detail={incidentQuery.error.message} /> : null}

      {incidentQuery.data ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <IncidentSummary incident={incidentQuery.data} />
            <AiTriageReview incident={incidentQuery.data} onChanged={refreshIncident} />
          </div>
          <div className="space-y-4">
            <TechnicianAssignment incident={incidentQuery.data} onChanged={refreshIncident} />
            <IncidentLifecycle incident={incidentQuery.data} onChanged={refreshIncident} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IncidentSummary({ incident }: { incident: IncidentDetailResponse }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Original complaint</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{incident.complaint_description}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Priority</dt>
            <dd className="mt-1 font-semibold text-slate-900">{incident.priority}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Category</dt>
            <dd className="mt-1 font-semibold text-slate-900">{incident.category ?? "Uncategorized"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Version</dt>
            <dd className="mt-1 font-semibold text-slate-900">{incident.version}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatDateTime(incident.created_at)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function AiTriageReview({ incident, onChanged }: { incident: IncidentDetailResponse; onChanged: () => void }) {
  const { headers } = useIdentity();
  const [category, setCategory] = useState(incident.latest_triage_result?.validated_result?.category ?? incident.category ?? "");
  const [priority, setPriority] = useState(incident.latest_triage_result?.validated_result?.suggested_priority ?? incident.priority);
  const [suspectedHazard, setSuspectedHazard] = useState(false);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      manualTriage(headers, incident.id, {
        category,
        priority,
        expected_version: incident.version,
        suspected_hazard: suspectedHazard,
        notes: notes.trim() || null,
      }),
    onSuccess: onChanged,
  });

  const triage = incident.latest_triage_result;
  const recommendation = triage?.validated_result;
  const isFailed = ["FAILED", "INVALID_OUTPUT", "TIMEOUT"].includes(incident.ai_triage_status ?? "");

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">AI triage review</h3>
          <p className="mt-1 text-sm text-slate-500">AI output is advisory and requires deterministic backend checks.</p>
        </div>
        <StatusBadge status={incident.ai_triage_status} />
      </div>

      {!incident.ai_triage_status ? (
        <EmptyState title="No AI status yet" detail="The triage event may not have been processed by the worker." />
      ) : null}
      {incident.ai_triage_status === "PENDING" || incident.ai_triage_status === "PROCESSING" ? (
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">AI triage is still pending.</p>
      ) : null}
      {isFailed ? (
        <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">
          AI triage did not produce a usable recommendation. Review the original complaint manually.
        </p>
      ) : null}
      {recommendation ? (
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-slate-500">Recommended category</p>
            <p className="font-semibold text-slate-950">{recommendation.category}</p>
          </div>
          <div>
            <p className="text-slate-500">Suggested priority</p>
            <p className="font-semibold text-slate-950">{recommendation.suggested_priority}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-slate-500">Summary</p>
            <p className="font-semibold text-slate-950">{recommendation.issue_summary}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-slate-500">Safety notes</p>
            <p className="font-semibold text-slate-950">
              {recommendation.safety_notes.length ? recommendation.safety_notes.join(", ") : "None provided"}
            </p>
          </div>
        </div>
      ) : null}

      <form
        className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="field-label">
          Confirmed category
          <input required className="field-input" value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <label className="field-label">
          Confirmed priority
          <select className="field-input" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
            {incidentPriorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label md:col-span-2">
          Review notes
          <textarea className="field-input" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          <input
            type="checkbox"
            checked={suspectedHazard}
            onChange={(event) => setSuspectedHazard(event.target.checked)}
          />
          Suspected hazard requiring escalation
        </label>
        {mutation.isError ? <ErrorState title="Manual triage failed" detail={mutation.error.message} /> : null}
        <button className="primary-button md:w-max" disabled={mutation.isPending || incident.status !== "PENDING_TRIAGE"} type="submit">
          Confirm triage
        </button>
      </form>
    </div>
  );
}

function TechnicianAssignment({ incident, onChanged }: { incident: IncidentDetailResponse; onChanged: () => void }) {
  const { headers } = useIdentity();
  const techniciansQuery = useQuery({
    queryKey: ["technicians", headers],
    queryFn: () => listTechnicians(headers),
  });
  const [technicianId, setTechnicianId] = useState("");

  const mutation = useMutation({
    mutationFn: () => assignTechnician(headers, incident.id, { technician_id: technicianId, expected_version: incident.version }),
    onSuccess: onChanged,
  });

  const availableTechnicians = techniciansQuery.data?.items ?? [];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-950">Technician assignment</h3>
      <p className="mt-1 text-sm text-slate-500">Availability is derived from active assignments.</p>
      {techniciansQuery.isLoading ? <LoadingState label="Loading technicians" /> : null}
      {techniciansQuery.isError ? <ErrorState detail={techniciansQuery.error.message} /> : null}
      {availableTechnicians.length === 0 && techniciansQuery.isSuccess ? (
        <EmptyState title="No technicians visible" detail="Check the manager building identity." />
      ) : null}
      {availableTechnicians.length > 0 ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <label className="field-label">
            Technician
            <select className="field-input" value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} required>
              <option value="">Select technician</option>
              {availableTechnicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.display_name} - {technician.available ? "available" : "busy"} - {technician.skills.join(", ") || "no skills"}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            {availableTechnicians.map((technician) => (
              <div key={technician.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{technician.display_name}</span>
                  <span className={technician.available ? "text-emerald-700" : "text-rose-700"}>
                    {technician.available ? "Available" : "Unavailable"}
                  </span>
                </div>
                <p className="mt-1 text-slate-500">{technician.skills.join(", ") || "No skills recorded"}</p>
              </div>
            ))}
          </div>
          {mutation.isError ? (
            <ErrorState
              title={isApiError(mutation.error) && mutation.error.status === 409 ? "Assignment conflict" : "Assignment failed"}
              detail={mutation.error.message}
            />
          ) : null}
          <button
            className="primary-button w-full"
            disabled={mutation.isPending || incident.status !== "AWAITING_ASSIGNMENT"}
            type="submit"
          >
            Assign technician
          </button>
        </form>
      ) : null}
    </div>
  );
}

function IncidentLifecycle({ incident, onChanged }: { incident: IncidentDetailResponse; onChanged: () => void }) {
  const { headers } = useIdentity();
  const [resolutionNotes, setResolutionNotes] = useState("");

  const startMutation = useMutation({
    mutationFn: () => startIncident(headers, incident.id, { expected_version: incident.version }),
    onSuccess: onChanged,
  });
  const resolveMutation = useMutation({
    mutationFn: () =>
      resolveIncident(headers, incident.id, {
        expected_version: incident.version,
        resolution_notes: resolutionNotes.trim(),
      }),
    onSuccess: onChanged,
  });
  const closeMutation = useMutation({
    mutationFn: () => closeIncident(headers, incident.id, { expected_version: incident.version }),
    onSuccess: onChanged,
  });

  const activeError = startMutation.error ?? resolveMutation.error ?? closeMutation.error;
  const pending = startMutation.isPending || resolveMutation.isPending || closeMutation.isPending;
  const canStart = incident.status === "ASSIGNED";
  const canResolve = incident.status === "IN_PROGRESS" && resolutionNotes.trim();
  const canClose = incident.status === "RESOLVED";

  const nextAction = useMemo(() => {
    if (incident.status === "ASSIGNED") return "Technician can start work.";
    if (incident.status === "IN_PROGRESS") return "Technician can resolve work with notes.";
    if (incident.status === "RESOLVED") return "Manager can close the incident.";
    return "No lifecycle action is available for this state.";
  }, [incident.status]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-950">Incident lifecycle</h3>
      <p className="mt-1 text-sm text-slate-500">{nextAction}</p>
      <p className="danger-note mt-3">
        Start and resolve require the assigned technician user ID in the local-demo identity switcher. The backend does
        not expose technician user IDs in dashboard APIs yet.
      </p>
      <div className="mt-4 space-y-3">
        <button className="primary-button w-full" disabled={!canStart || pending} onClick={() => startMutation.mutate()}>
          Start work
        </button>
        <label className="field-label">
          Resolution notes
          <textarea className="field-input" value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} />
        </label>
        <button className="primary-button w-full" disabled={!canResolve || pending} onClick={() => resolveMutation.mutate()}>
          Resolve work
        </button>
        <button className="secondary-button w-full" disabled={!canClose || pending} onClick={() => closeMutation.mutate()}>
          Close incident
        </button>
        {activeError ? <ErrorState title="Lifecycle transition failed" detail={activeError.message} /> : null}
      </div>
    </div>
  );
}
