import { apiBaseUrl } from "./config";
import type {
  AssignmentCreateRequest,
  AssignmentResponse,
  ComplaintCreateRequest,
  ComplaintCreateResponse,
  IncidentDetailResponse,
  IncidentLifecycleRequest,
  IncidentListResponse,
  IncidentResolveRequest,
  IncidentStatusValue,
  ManualTriageRequest,
  TechnicianListResponse,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail: unknown,
  ) {
    super(message);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? data.detail : data;
    throw new ApiError(typeof detail === "string" ? detail : "API request failed", response.status, detail);
  }
  return data as T;
}

export interface ListIncidentsParams {
  limit: number;
  offset: number;
  status?: IncidentStatusValue | "";
}

export function listIncidents(headers: Record<string, string>, params: ListIncidentsParams) {
  const search = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.status) search.set("status", params.status);
  return request<IncidentListResponse>(`/api/v1/incidents?${search.toString()}`, { headers });
}

export function getIncident(headers: Record<string, string>, incidentId: string) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}`, { headers });
}

export function createComplaint(
  headers: Record<string, string>,
  payload: ComplaintCreateRequest,
  idempotencyKey: string,
) {
  return request<ComplaintCreateResponse>("/api/v1/complaints", {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": idempotencyKey },
    body: payload,
  });
}

export function manualTriage(headers: Record<string, string>, incidentId: string, payload: ManualTriageRequest) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}/manual-triage`, {
    method: "POST",
    headers,
    body: payload,
  });
}

export function listTechnicians(headers: Record<string, string>) {
  return request<TechnicianListResponse>("/api/v1/technicians", { headers });
}

export function assignTechnician(headers: Record<string, string>, incidentId: string, payload: AssignmentCreateRequest) {
  return request<AssignmentResponse>(`/api/v1/incidents/${incidentId}/assign`, {
    method: "POST",
    headers,
    body: payload,
  });
}

export function startIncident(headers: Record<string, string>, incidentId: string, payload: IncidentLifecycleRequest) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}/start`, {
    method: "POST",
    headers,
    body: payload,
  });
}

export function resolveIncident(headers: Record<string, string>, incidentId: string, payload: IncidentResolveRequest) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}/resolve`, {
    method: "POST",
    headers,
    body: payload,
  });
}

export function closeIncident(headers: Record<string, string>, incidentId: string, payload: IncidentLifecycleRequest) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}/close`, {
    method: "POST",
    headers,
    body: payload,
  });
}
