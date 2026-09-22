import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, BrainCircuit, Building2, CheckCircle2, Clock3, ClipboardCheck, Flag, ShieldAlert, Tag, Wrench, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import {
  assignTechnician,
  closeIncident,
  escalateSafetyIncident,
  getIncident,
  isApiError,
  listTechnicians,
  manualTriage,
  resolveIncident,
  startIncident,
} from "../api/client";
import { incidentPriorities, triageCategories } from "../api/config";
import type { IncidentDetailResponse, TechnicianListItem } from "../api/types";
import { useAuth } from "../state/AuthContext";
import { useBuildingSelection } from "../state/BuildingContext";
import { EmptyState, ErrorState, LoadingState } from "../ui/AsyncState";
import { StatusBadge } from "../ui/StatusBadge";
import { formatDateTime } from "../utils/format";
import { nextStepForStatus, reporterProgressForStatus, reporterStatusLabel } from "./ReporterWorkspacePage";

const triageableStatuses = new Set(["PENDING_TRIAGE", "MANUAL_REVIEW"]);
const safetyEscalationSourceStatuses = new Set(["PENDING_TRIAGE", "MANUAL_REVIEW"]);
const assignmentStatuses = new Set(["ASSIGNED", "IN_PROGRESS"]);

export function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { role } = useAuth();
  const { selectedBuildingId, buildings } = useBuildingSelection();
  const queryClient = useQueryClient();

  const incidentQuery = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => getIncident(incidentId!),
    enabled: Boolean(incidentId),
  });

  const shouldLoadTechnicians = role === "FACILITY_MANAGER" && incidentQuery.data?.status === "AWAITING_ASSIGNMENT";
  const techniciansQuery = useQuery({
    queryKey: ["technicians", selectedBuildingId],
    queryFn: () => listTechnicians({ buildingId: selectedBuildingId }),
    enabled: shouldLoadTechnicians,
  });

  const refreshWorkflow = async () => {
    await queryClient.refetchQueries({ queryKey: ["incident", incidentId], exact: true });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["incidents"] }),
      queryClient.invalidateQueries({ queryKey: ["technicians"] }),
      queryClient.invalidateQueries({ queryKey: ["technician", "my-work"] }),
      queryClient.invalidateQueries({ queryKey: ["complaints"] }),
      queryClient.invalidateQueries({ queryKey: ["metrics"] }),
    ]);
  };

  if (!incidentId) return <ErrorState detail="Incident ID is missing from the route." />;

  const incident = incidentQuery.data;
  const buildingName = incident ? buildings.find((building) => building.id === incident.building_id)?.name : null;

  if (role === "REPORTER") {
    return (
      <ReporterIncidentDetail
        incident={incident}
        incidentId={incidentId}
        buildingName={buildingName}
        isLoading={incidentQuery.isLoading}
        error={incidentQuery.error}
      />
    );
  }

  return (
    <section className="stack-lg">
      <div className="section-heading">
        <div>
          <Link to="/incidents" className="text-link">Back to incident queue</Link>
          <p className="eyebrow">Incident detail</p>
          <h2>{incident ? incident.complaint_description : "Loading incident"}</h2>
          <p className="muted-copy">{incident ? `Ticket ${incident.public_ticket_id}` : "Loading ticket reference"}</p>
        </div>
        {incident ? <StatusBadge status={incident.status} /> : null}
      </div>

      {incident ? <IncidentSummaryCards incident={incident} buildingName={buildingName} /> : null}

      {incidentQuery.isLoading ? <LoadingState label="Loading incident" /> : null}
      {incidentQuery.isError ? <ErrorState detail={incidentQuery.error.message} /> : null}

      {incident ? (
        <div className="detail-grid">
          <div className="stack">
            <OriginalComplaint incident={incident} buildingName={buildingName} />
            <AiAssessment incident={incident} />
            <HumanDecision incident={incident} canReview={role === "FACILITY_MANAGER"} onChanged={refreshWorkflow} />
          </div>
          <div className="stack">
            <StateActionPanel
              incident={incident}
              role={role}
              technicians={techniciansQuery.data?.items ?? []}
              techniciansLoading={techniciansQuery.isLoading}
              techniciansError={techniciansQuery.error}
              techniciansLoaded={techniciansQuery.isSuccess}
              onChanged={refreshWorkflow}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IncidentSummaryCards({ incident, buildingName }: { incident: IncidentDetailResponse; buildingName: string | null | undefined }) {
  return (
    <div className="incident-summary-grid" aria-label="Incident summary">
      <SummaryCard icon={Building2} label="Building" value={buildingName ?? "Authorized building"} />
      <SummaryCard icon={Clock3} label="Reported" value={formatDateTime(incident.created_at)} />
      <SummaryCard icon={Tag} label="Category" value={incident.category ?? "Not confirmed"} />
      <SummaryCard icon={Flag} label="Priority" value={operationalPriorityLabel(incident)} />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <article className="summary-card">
      <Icon aria-hidden size={18} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
function ReporterIncidentDetail({
  incident,
  incidentId,
  buildingName,
  isLoading,
  error,
}: {
  incident: IncidentDetailResponse | undefined;
  incidentId: string;
  buildingName: string | null | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const statusLabel = incident ? reporterStatusLabel(incident.status) : "Loading request";
  const nextStep = incident ? nextStepForStatus(incident.status) : "Loading the latest request state.";
  const assignedTechnician = incident?.active_assignment?.technician_display_name;

  return (
    <section className="reporter-detail-page stack-lg">
      <div className="section-heading reporter-detail-heading">
        <div>
          <Link to="/" className="text-link">Back to my requests</Link>
          <p className="eyebrow">Request detail</p>
          <h2>{incident ? `Request ${incident.public_ticket_id}` : "Loading request"}</h2>
          <p className="muted-copy">{incident ? buildingName ?? "Authorized building" : `Loading request ${incidentId}`}</p>
        </div>
        {incident ? <StatusBadge status={statusLabel} /> : null}
      </div>

      {isLoading ? <LoadingState label="Loading request" /> : null}
      {error ? <ErrorState title="Request could not be loaded" detail={error.message} /> : null}

      {incident ? (
        <div className="reporter-detail-grid">
          <article className={`panel stack request-hero priority-edge priority-${incident.priority.toLowerCase()}`}>
            <div>
              <p className="eyebrow">Current status</p>
              <h3>{statusLabel}</h3>
              <p className="body-copy">{nextStep}</p>
            </div>
          </article>

          <ReporterSafetyAdvisory notes={incident.ai_safety_notes ?? []} />

          <article className="panel stack reporter-progress-panel">
            <div>
              <p className="eyebrow">Current progress</p>
            </div>
            <ReporterProgress status={incident.status} />
          </article>

          <article className="panel stack request-info-panel">
            <div className="icon-heading">
              <ClipboardCheck aria-hidden size={20} />
              <div>
                <p className="eyebrow">What did I report?</p>
                <h3>Original request</h3>
              </div>
            </div>
            <p className="body-copy complaint-lead">{incident.complaint_description}</p>
            <dl className="request-detail-facts">
              <div><dt>Building</dt><dd>{buildingName ?? "Authorized building"}</dd></div>
              <div><dt>Request ID</dt><dd className="mono-cell">{incident.public_ticket_id}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDateTime(incident.updated_at)}</dd></div>
              <div><dt>Submitted</dt><dd>{formatDateTime(incident.created_at)}</dd></div>
            </dl>
          </article>

          <div className="stack">
            <article className="panel stack request-next-panel">
              <div className="icon-heading">
                <Clock3 aria-hidden size={20} />
                <div>
                  <p className="eyebrow">What happens next?</p>
                  <h3>{statusLabel}</h3>
                </div>
              </div>
              <p className={incident.status === "CLOSED" ? "success-note" : "info-note"}>{nextStep}</p>
              {assignedTechnician ? <p className="body-copy">Assigned technician: <strong>{assignedTechnician}</strong></p> : null}
            </article>

            {incident.category ? (
              <article className="panel request-service-panel">
                <Wrench aria-hidden size={20} />
                <div>
                  <p className="eyebrow">Service details</p>
                  <dl className="request-service-facts">
                    <div><dt>Service type</dt><dd>{incident.category}</dd></div>
                  </dl>
                </div>
              </article>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReporterSafetyAdvisory({ notes }: { notes: string[] }) {
  const visibleNotes = notes.map((note) => note.trim()).filter(Boolean);
  if (visibleNotes.length === 0) return null;

  return (
    <article className="panel stack reporter-safety-advisory" aria-label="AI-generated safety advisory">
      <div className="section-heading compact">
        <h3 className="icon-heading"><AlertTriangle aria-hidden size={18} />Safety Advisory</h3>
        <span className="ai-generated-pill">AI-generated</span>
      </div>
      <div className="stack-sm reporter-safety-notes">
        {visibleNotes.map((note, index) => (
          <p key={`${index}-${note}`} className="body-copy">{note}</p>
        ))}
      </div>
      <p className="muted-copy reporter-safety-disclaimer">
        AI-generated guidance may require human verification. For immediate hazards, contact building security or emergency services.
      </p>
    </article>
  );
}

export function ReporterProgress({ status }: { status: string }) {
  const { steps, currentIndex } = reporterProgressForStatus(status);
  return (
    <ol className="request-progress" aria-label="Request progress">
      {steps.map((step, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li
            key={step.label}
            className={current ? "current" : complete ? "complete" : "upcoming"}
            aria-current={current ? "step" : undefined}
            data-state={current ? "current" : complete ? "complete" : "upcoming"}
          >
            <span className="request-progress-dot" aria-hidden="true">{complete ? <CheckCircle2 size={14} /> : null}</span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
function OriginalComplaint({ incident, buildingName }: { incident: IncidentDetailResponse; buildingName: string | null | undefined }) {
  const hazardSignal = hasSafetySignal(incident);
  const operationalClassificationUnconfirmed = isOperationalClassificationUnconfirmed(incident);
  const detailHeading = incident.category ?? "Complaint details";
  const priorityLabel = operationalClassificationUnconfirmed ? "Operational priority" : "Priority";
  const priorityValue = operationalPriorityLabel(incident);

  return (
    <article className={`panel stack priority-edge priority-${incident.priority.toLowerCase()}`}>
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Original complaint</p>
          <h3>{detailHeading}</h3>
        </div>
        <span className="mono-cell">v{incident.version}</span>
      </div>
      <p className="body-copy complaint-lead">{incident.complaint_description}</p>
      {hazardSignal ? (
        <p className={incident.status === "RESOLVED" || incident.status === "CLOSED" ? "info-note" : "danger-note"}>
          AI advisory noted possible safety concerns. Safety checks remain authoritative for assignment decisions.
        </p>
      ) : null}
      <dl className="definition-grid">
        <div><dt>Ticket</dt><dd className="mono-cell">{incident.public_ticket_id}</dd></div>
        <div><dt>Reporter</dt><dd>{incident.reporter_display_name ?? "Reporter"}</dd></div>
        {operationalClassificationUnconfirmed ? <div><dt>Operational category</dt><dd>Not confirmed</dd></div> : null}
        <div><dt>{priorityLabel}</dt><dd>{priorityValue}</dd></div>
        <div><dt>Building</dt><dd>{buildingName ?? "Authorized building"}</dd></div>
        <div><dt>Created</dt><dd>{formatDateTime(incident.created_at)}</dd></div>
        <div><dt>Updated</dt><dd>{formatDateTime(incident.updated_at)}</dd></div>
      </dl>
      <ActiveAssignment incident={incident} />
      {incident.status === "SAFETY_ESCALATED" ? <SafetyEscalationSummary incident={incident} /> : null}
    </article>
  );
}

function ActiveAssignment({ incident }: { incident: IncidentDetailResponse }) {
  const assignment = incident.active_assignment;
  const emptyTitle = incident.status === "PENDING_TRIAGE" || incident.status === "MANUAL_REVIEW" || incident.status === "AWAITING_ASSIGNMENT" || incident.status === "SAFETY_ESCALATED"
    ? "No active assignment yet"
    : "No active assignment";
  const emptyDetail = incident.status === "SAFETY_ESCALATED"
    ? "Routine technician dispatch is unavailable while safety escalation is recorded."
    : incident.status === "RESOLVED" || incident.status === "CLOSED"
    ? "Capacity has been released after work completion."
    : "A current assignment will appear after dispatch.";
  return (
    <div className="subsection">
      <h3>Current active assignment</h3>
      {assignment ? (
        <dl className="definition-grid">
          <div><dt>Technician</dt><dd>{assignment.technician_display_name}</dd></div>
          <div><dt>Status</dt><dd>{assignment.status.replaceAll("_", " ")}</dd></div>
        </dl>
      ) : (
        <EmptyState title={emptyTitle} detail={emptyDetail} />
      )}
    </div>
  );
}

function SafetyEscalationSummary({ incident }: { incident: IncidentDetailResponse }) {
  const escalation = incident.safety_escalation;
  return (
    <div className="subsection stack-sm">
      <h3 className="icon-heading"><ShieldAlert aria-hidden size={18} />Safety escalation recorded</h3>
      <p className="danger-note">Routine assignment is unavailable while this safety escalation is recorded.</p>
      {escalation ? (
        <dl className="definition-grid">
          <div><dt>Recorded by</dt><dd>{escalation.actor_display_name}</dd></div>
          <div><dt>Recorded</dt><dd>{formatDateTime(escalation.escalated_at)}</dd></div>
          <div className="wide"><dt>Reason</dt><dd>{escalation.reason}</dd></div>
        </dl>
      ) : (
        <p className="info-note">Escalation details are available only to authorized facility managers.</p>
      )}
    </div>
  );
}

function AiAssessment({ incident }: { incident: IncidentDetailResponse }) {
  const triage = incident.latest_triage_result;
  const recommendation = triage?.validated_result;
  const isPending = incident.ai_triage_status === "PENDING" || incident.ai_triage_status === "PROCESSING";
  const isFailed = ["FAILED", "INVALID_OUTPUT", "TIMEOUT"].includes(incident.ai_triage_status ?? "");
  const processedWithoutRecommendation = (incident.ai_triage_status === "PROCESSED_NO_RESULT" || incident.ai_triage_status === "PROCESSED") && !recommendation;
  const skippedObsolete = incident.ai_triage_status === "SKIPPED_OBSOLETE";
  const hasConfirmedDecision = !triageableStatuses.has(incident.status) && Boolean(incident.category);

  return (
    <article className="panel stack ai-panel">
      <div className="section-heading compact">
        <div><p className="eyebrow">AI recommendation</p><h3 className="icon-heading"><BrainCircuit aria-hidden size={18} />Advisory recommendation</h3></div>
        <StatusBadge status={incident.ai_triage_status} ai />
      </div>
      {!incident.ai_triage_status ? <EmptyState title="Awaiting AI signal" detail="No triage result or outbox status is visible yet." /> : null}
      {isPending ? (
        <p className="info-note">
          {hasConfirmedDecision
            ? "AI triage is still processing separately. Manual review completed and a facility manager has confirmed the operational triage."
            : "AI triage is still processing. Manual review has not been completed yet."}
        </p>
      ) : null}
      {isFailed ? <p className="danger-note">AI triage did not produce a usable recommendation. Manual review can still record a human decision when safety checks allow it.</p> : null}
      {skippedObsolete ? (
        <EmptyState title="AI skipped after human review" detail="The AI triage event became obsolete after a facility manager completed manual review. No AI recommendation was applied." />
      ) : null}
      {processedWithoutRecommendation ? (
        <EmptyState title="No AI recommendation available" detail="The triage event was processed, but no validated recommendation was saved for this incident." />
      ) : null}
      {recommendation ? (
        <dl className="definition-grid">
          <div><dt>AI-suggested category</dt><dd>{recommendation.category}</dd></div>
          <div><dt>AI-suggested priority</dt><dd>{recommendation.suggested_priority}</dd></div>
          <div className="wide"><dt>Summary</dt><dd>{recommendation.issue_summary}</dd></div>
          <div className="wide"><dt>Location</dt><dd>{recommendation.location ?? "None provided"}</dd></div>
          <div className="wide"><dt>Potential hazards</dt><dd>{recommendation.potential_hazards.length ? recommendation.potential_hazards.join(", ") : "None provided"}</dd></div>
          <div className="wide"><dt>Safety notes</dt><dd>{recommendation.safety_notes.length ? recommendation.safety_notes.join(", ") : "None provided"}</dd></div>
          <div><dt>Needs human review</dt><dd>{recommendation.needs_human_review ? "Yes" : "No"}</dd></div>
        </dl>
      ) : null}
    </article>
  );
}

function HumanDecision({ incident, canReview, onChanged }: { incident: IncidentDetailResponse; canReview: boolean; onChanged: () => void | Promise<void> }) {
  const canEditDecision = canReview && triageableStatuses.has(incident.status);
  const isSafetyEscalated = incident.status === "SAFETY_ESCALATED";
  const hasConfirmedDecision = !isSafetyEscalated && !triageableStatuses.has(incident.status) && Boolean(incident.category);
  const escalationSectionRef = useRef<HTMLDivElement | null>(null);
  const focusEscalationSection = () => {
    window.setTimeout(() => {
      escalationSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      escalationSectionRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  return (
    <article className="panel stack human-panel">
      <div className="section-heading compact">
        <div><p className="eyebrow">Manager decision</p><h3 className="icon-heading"><CheckCircle2 aria-hidden size={18} />{hasConfirmedDecision ? "Confirmed triage" : "Review required"}</h3></div>
        {hasConfirmedDecision ? <StatusBadge status={incident.status} /> : null}
      </div>
      {isSafetyEscalated ? (
        <p className="danger-note">Safety escalation has been recorded. Routine triage, assignment, technician workflow, and closure are unavailable for this incident.</p>
      ) : null}
      {hasConfirmedDecision ? (
        <dl className="definition-grid">
          <div><dt>Confirmed category</dt><dd>{incident.category}</dd></div>
          <div><dt>Confirmed priority</dt><dd>{incident.priority}</dd></div>
        </dl>
      ) : null}
      {incident.status === "MANUAL_REVIEW" ? <p className="danger-note">Manual review is required before assignment. Suspected hazards need escalation before dispatch.</p> : null}
      {canEditDecision ? <ManualTriageForm incident={incident} onChanged={onChanged} onSafetyRejected={focusEscalationSection} /> : null}
      {canReview && safetyEscalationSourceStatuses.has(incident.status) ? (
        <div ref={escalationSectionRef} tabIndex={-1}>
          <SafetyEscalationForm incident={incident} onChanged={onChanged} />
        </div>
      ) : null}
      {!canEditDecision && !hasConfirmedDecision && !isSafetyEscalated ? (
        <p className="info-note">{canReview ? "No triage action is available for this state." : "Only facility managers can confirm triage decisions."}</p>
      ) : null}
    </article>
  );
}

function ManualTriageForm({
  incident,
  onChanged,
  onSafetyRejected,
}: {
  incident: IncidentDetailResponse;
  onChanged: () => void | Promise<void>;
  onSafetyRejected: () => void;
}) {
  const recommendation = incident.latest_triage_result?.validated_result;
  const recommendedCategory = recommendation?.category ?? incident.category;
  const queryClient = useQueryClient();
  const [category, setCategory] = useState(triageCategories.includes(recommendedCategory as typeof triageCategories[number]) ? recommendedCategory ?? "" : "");
  const [priority, setPriority] = useState(recommendation?.suggested_priority ?? incident.priority);
  const [suspectedHazard, setSuspectedHazard] = useState(false);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => manualTriage(incident.id, { category, priority, expected_version: incident.version, suspected_hazard: suspectedHazard, notes: notes.trim() || null }),
    onSuccess: onChanged,
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["incident", incident.id] });
      }
      if (isSafetyRuleRejection(error)) {
        onSafetyRejected();
      }
    },
  });

  return (
    <section className="decision-card stack" aria-labelledby="maintenance-triage-heading">
      <div>
        <p className="eyebrow">Maintenance triage</p>
        <h3 id="maintenance-triage-heading">Confirm maintenance triage</h3>
        <p className="muted-copy">Confirm the category and priority to continue through routine maintenance, subject to safety checks.</p>
      </div>
      <form className="stack" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); mutation.mutate(); }}>
      <div className="form-grid">
        <label className="field-label">Confirmed category<select required className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Select category</option>
          {triageCategories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label className="field-label">Confirmed priority<select className="field-input" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{incidentPriorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <label className="field-label">Review notes<textarea className="field-input" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <label className="check-row">
        <input type="checkbox" checked={suspectedHazard} onChange={(event) => setSuspectedHazard(event.target.checked)} />
        Suspected hazard requiring escalation
      </label>
      <p className="muted-copy">Leaving this unchecked does not establish that an incident is safe. Safety checks still decide whether triage can proceed.</p>
      {mutation.isError ? <MutationError title="Manual triage failed" error={mutation.error} /> : null}
      <button className="primary-button fit" disabled={mutation.isPending || !category.trim()} type="submit">Confirm maintenance triage</button>
      </form>
    </section>
  );
}

function SafetyEscalationForm({ incident, onChanged }: { incident: IncidentDetailResponse; onChanged: () => void | Promise<void> }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();
  const mutation = useMutation({
    mutationFn: () => escalateSafetyIncident(incident.id, { expected_version: incident.version, reason: trimmedReason }),
    onSuccess: onChanged,
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["incident", incident.id] });
      }
    },
  });

  return (
    <section className="decision-card safety stack" aria-labelledby="safety-escalation-heading">
      <div>
        <p className="eyebrow">Safety escalation</p>
        <h3 id="safety-escalation-heading" className="icon-heading"><ShieldAlert aria-hidden size={18} />Escalate safety incident</h3>
        <p className="muted-copy">Record that this incident requires separate safety review. Routine technician assignment will remain unavailable.</p>
      </div>
      <form className="stack" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (trimmedReason) mutation.mutate(); }}>
      <dl className="definition-grid">
        <div><dt>Ticket</dt><dd className="mono-cell">{incident.public_ticket_id}</dd></div>
        <div className="wide"><dt>Complaint summary</dt><dd>{incident.complaint_description}</dd></div>
      </dl>
      <p className="danger-note">Routine dispatch is unavailable after safety escalation until a separately approved safety clearance workflow exists.</p>
      <p className="info-note">If there is immediate danger, follow building emergency procedures and contact the appropriate emergency services.</p>
      <label className="field-label">Escalation reason<textarea required className="field-input" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      {mutation.isError ? <MutationError title="Safety escalation failed" error={mutation.error} /> : null}
      <button className="primary-button icon-button fit" disabled={mutation.isPending || !trimmedReason} type="submit">
        <ShieldAlert aria-hidden size={16} />
        {mutation.isPending ? "Recording escalation..." : "Record safety escalation"}
      </button>
      </form>
    </section>
  );
}

function StateActionPanel(props: {
  incident: IncidentDetailResponse;
  role: string | null;
  technicians: TechnicianListItem[];
  techniciansLoading: boolean;
  techniciansError: Error | null;
  techniciansLoaded: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { incident, role } = props;

  if (role === "FACILITY_MANAGER" && incident.status === "AWAITING_ASSIGNMENT") {
    return <TechnicianAssignment {...props} />;
  }
  if (role === "FACILITY_MANAGER" && incident.status === "RESOLVED") {
    return <ManagerClosure incident={incident} onChanged={props.onChanged} />;
  }
  if (role === "TECHNICIAN" && assignmentStatuses.has(incident.status)) {
    return <TechnicianLifecycle incident={incident} onChanged={props.onChanged} />;
  }
  return <ReadOnlyStatePanel incident={incident} role={role} />;
}

function TechnicianAssignment({
  incident,
  technicians,
  techniciansLoading,
  techniciansError,
  techniciansLoaded,
  onChanged,
}: {
  incident: IncidentDetailResponse;
  role: string | null;
  technicians: TechnicianListItem[];
  techniciansLoading: boolean;
  techniciansError: Error | null;
  techniciansLoaded: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [technicianId, setTechnicianId] = useState("");
  const queryClient = useQueryClient();
  const requiredSkill = incident.category;
  const availableQualified = technicians.filter((technician) => isSelectableTechnician(technician, requiredSkill));
  const unavailable = technicians.filter((technician) => technician.status !== "ACTIVE" || !technician.available);
  const notQualified = requiredSkill
    ? technicians.filter((technician) => technician.status === "ACTIVE" && technician.available && !hasRequiredSkill(technician, requiredSkill))
    : [];

  const mutation = useMutation({
    mutationFn: () => assignTechnician(incident.id, { technician_id: technicianId, expected_version: incident.version }),
    onSuccess: onChanged,
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        setTechnicianId("");
        void queryClient.invalidateQueries({ queryKey: ["incident", incident.id] });
        void queryClient.invalidateQueries({ queryKey: ["technicians"] });
      }
    },
  });

  return (
    <article className="panel stack">
      <div>
        <p className="eyebrow">Technician dispatch</p>
        <h3 className="icon-heading"><Users aria-hidden size={18} />Qualified candidates</h3>
        <p className="muted-copy">Choose an available technician with the required skill.</p>
      </div>
      {techniciansLoading ? <LoadingState label="Loading technicians" /> : null}
      {techniciansError ? <ErrorState detail={techniciansError.message} /> : null}
      {availableQualified.length === 0 && techniciansLoaded ? (
        <EmptyState title="No qualified technicians are currently available." detail="All eligible technicians are assigned or do not match this category." />
      ) : null}
      {availableQualified.length > 0 ? (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <label className="field-label">
            Available and qualified
            <select className="field-input" value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} required>
              <option value="">Select technician</option>
              {availableQualified.map((technician) => <option key={technician.id} value={technician.id}>{technician.display_name}</option>)}
            </select>
          </label>
          <TechnicianGroup title="Available and qualified" technicians={availableQualified} />
          {unavailable.length > 0 ? <TechnicianGroup title="Unavailable" technicians={unavailable} /> : null}
          {notQualified.length > 0 ? <TechnicianGroup title="Not qualified" technicians={notQualified} /> : null}
          {mutation.isError ? <MutationError title="Assignment failed" error={mutation.error} /> : null}
          <button className="primary-button icon-button" disabled={mutation.isPending || !technicianId} type="submit"><Users aria-hidden size={16} />Assign technician</button>
        </form>
      ) : null}
      {availableQualified.length === 0 ? (
        <>
          {unavailable.length > 0 ? <TechnicianGroup title="Unavailable" technicians={unavailable} /> : null}
          {notQualified.length > 0 ? <TechnicianGroup title="Not qualified" technicians={notQualified} /> : null}
        </>
      ) : null}
    </article>
  );
}

function TechnicianGroup({ title, technicians }: { title: string; technicians: TechnicianListItem[] }) {
  return (
    <div className="stack-sm">
      <h4 className="group-heading">{title}</h4>
      <div className="tech-list">
        {technicians.map((technician) => (
          <div key={technician.id} className="tech-card">
            <div>
              <strong>{technician.display_name}</strong>
              <span>{technician.skills.join(", ") || "No skills recorded"}</span>
            </div>
            <StatusBadge status={technician.available && technician.status === "ACTIVE" ? "AVAILABLE" : "UNAVAILABLE"} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnicianLifecycle({ incident, onChanged }: { incident: IncidentDetailResponse; onChanged: () => void | Promise<void> }) {
  const [resolutionNotes, setResolutionNotes] = useState("");
  const startMutation = useMutation({ mutationFn: () => startIncident(incident.id, { expected_version: incident.version }), onSuccess: onChanged });
  const resolveMutation = useMutation({ mutationFn: () => resolveIncident(incident.id, { expected_version: incident.version, resolution_notes: resolutionNotes.trim() }), onSuccess: onChanged });
  const activeError = startMutation.error ?? resolveMutation.error;
  const pending = startMutation.isPending || resolveMutation.isPending;

  return (
    <article className="panel stack">
      <div><p className="eyebrow">Technician workflow</p><h3 className="icon-heading"><Wrench aria-hidden size={18} />Assigned work</h3></div>
      {incident.active_assignment ? <p className="info-note">{incident.active_assignment.technician_display_name} is assigned and the assignment is {incident.active_assignment.status.replaceAll("_", " ")}.</p> : <EmptyState title="No active assignment" detail="Start and resolve actions require an active assignment." />}
      {incident.status === "ASSIGNED" ? <button className="primary-button icon-button" disabled={pending} onClick={() => startMutation.mutate()}><Wrench aria-hidden size={16} />Start work</button> : null}
      {incident.status === "IN_PROGRESS" ? (
        <>
          <label className="field-label">Resolution notes<textarea className="field-input" value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} /></label>
          <button className="primary-button icon-button" disabled={!resolutionNotes.trim() || pending} onClick={() => resolveMutation.mutate()}><CheckCircle2 aria-hidden size={16} />Resolve work</button>
        </>
      ) : null}
      {activeError ? <MutationError title="Lifecycle transition failed" error={activeError} /> : null}
    </article>
  );
}

function ManagerClosure({ incident, onChanged }: { incident: IncidentDetailResponse; onChanged: () => void | Promise<void> }) {
  const closeMutation = useMutation({ mutationFn: () => closeIncident(incident.id, { expected_version: incident.version }), onSuccess: onChanged });
  return (
    <article className="panel stack">
      <div><p className="eyebrow">Closure</p><h3>Manager closure</h3><p className="muted-copy">Close this incident after reviewing the completed work.</p></div>
      <button className="secondary-button icon-button" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate()}><CheckCircle2 aria-hidden size={16} />Close incident</button>
      {closeMutation.isError ? <MutationError title="Close failed" error={closeMutation.error} /> : null}
    </article>
  );
}

function ReadOnlyStatePanel({ incident, role }: { incident: IncidentDetailResponse; role: string | null }) {
  const message = useMemo(() => {
    if (incident.status === "PENDING_TRIAGE") return "Waiting for AI assessment or authorized manager triage.";
    if (incident.status === "MANUAL_REVIEW") return "Manual review is required before dispatch.";
    if (incident.status === "ASSIGNED") return role === "FACILITY_MANAGER" ? "The assigned technician controls start and resolve actions." : "No action is available for this session.";
    if (incident.status === "IN_PROGRESS") return role === "FACILITY_MANAGER" ? "Work is in progress with the assigned technician." : "No action is available for this session.";
    if (incident.status === "SAFETY_ESCALATED") return "Safety escalation has been recorded. Routine assignment, technician work, and closure are unavailable.";
    if (incident.status === "CLOSED") return "This incident is closed and read-only.";
    return "No action is available for this state.";
  }, [incident.status, role]);

  return (
    <article className="panel stack">
      <div><p className="eyebrow">Workflow action</p><h3>{incident.status.replaceAll("_", " ")}</h3></div>
      <p className="info-note">{message}</p>
    </article>
  );
}

function MutationError({ title, error }: { title: string; error: Error }) {
  const conflict = isApiError(error) && error.status === 409;
  const unauthorized = isApiError(error) && (error.status === 401 || error.status === 403);
  const safetyEscalation = isSafetyRuleRejection(error);
  const staleVersion = conflict && /version conflict/i.test(error.message);
  const renderedTitle = safetyEscalation
    ? "Safety escalation required"
    : staleVersion
    ? "Incident changed"
    : unauthorized
    ? "Access denied"
    : conflict
    ? "Workflow review required"
    : title;
  const renderedDetail = safetyEscalation
    ? "Routine maintenance cannot proceed because this incident requires safety escalation."
    : error.message;
  const followUp = safetyEscalation
    ? "Use Record safety escalation to document the manager's decision."
    : "The incident was refetched. Review the latest state and choose again before retrying.";
  return (
    <div className="stack-sm">
      <ErrorState title={renderedTitle} detail={renderedDetail} />
      {conflict ? <p className={safetyEscalation ? "info-note" : "danger-note"}>{followUp}</p> : null}
    </div>
  );
}

function isSafetyRuleRejection(error: unknown) {
  return isApiError(error) && error.status === 409 && /suspected hazards require/i.test(error.message);
}

function isSelectableTechnician(technician: TechnicianListItem, requiredSkill: string | null | undefined) {
  return technician.status === "ACTIVE" && technician.available && requiredSkill ? hasRequiredSkill(technician, requiredSkill) : false;
}

export function hasRequiredSkill(technician: Pick<TechnicianListItem, "skills">, requiredSkill: string) {
  const canonicalRequiredSkill = canonicalSkill(requiredSkill);
  return technician.skills.some((skill) => canonicalSkill(skill) === canonicalRequiredSkill);
}

function canonicalSkill(value: string) {
  return value.trim().toUpperCase().replaceAll(" ", "_");
}

function isOperationalClassificationUnconfirmed(incident: Pick<IncidentDetailResponse, "status" | "category">) {
  return incident.status === "SAFETY_ESCALATED" && !incident.category;
}

function operationalPriorityLabel(incident: Pick<IncidentDetailResponse, "status" | "category" | "priority">) {
  return isOperationalClassificationUnconfirmed(incident) ? "Not confirmed" : incident.priority;
}
function hasSafetySignal(incident: IncidentDetailResponse) {
  const recommendation = incident.latest_triage_result?.validated_result;
  if (recommendation?.needs_human_review) return true;
  if ((recommendation?.potential_hazards.length ?? 0) > 0) return true;
  if ((recommendation?.safety_notes.length ?? 0) > 0) return true;
  return false;
}
