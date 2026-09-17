import type { components } from "./generated";
import type { incidentStatuses } from "./config";

export type ComplaintCreateRequest = components["schemas"]["ComplaintCreateRequest"];
export type ComplaintCreateResponse = components["schemas"]["ComplaintCreateResponse"];
export type IncidentDetailResponse = components["schemas"]["IncidentDetailResponse"];
export type IncidentListResponse = components["schemas"]["IncidentListResponse"];
export type IncidentStatusValue = (typeof incidentStatuses)[number];
export type ManualTriageRequest = components["schemas"]["ManualTriageRequest"];
export type AssignmentCreateRequest = components["schemas"]["AssignmentCreateRequest"];
export type AssignmentResponse = components["schemas"]["AssignmentResponse"];
export type IncidentLifecycleRequest = components["schemas"]["IncidentLifecycleRequest"];
export type IncidentResolveRequest = components["schemas"]["IncidentResolveRequest"];
export type TechnicianListResponse = components["schemas"]["TechnicianListResponse"];
