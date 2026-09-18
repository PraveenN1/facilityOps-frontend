import { apiBaseUrl, csrfStorageKey } from "./config";
import type {
  AiMetricsResponse,
  AssignmentCreateRequest,
  AssignmentResponse,
  AuthenticatedUserResponse,
  BuildingListResponse,
  ComplaintCreateRequest,
  ComplaintCreateResponse,
  ComplaintDetailResponse,
  IncidentDetailResponse,
  IncidentLifecycleRequest,
  IncidentListResponse,
  IncidentResolveRequest,
  IncidentStatusValue,
  LoginRequest,
  LoginResponse,
  ManualTriageRequest,
  OperationsMetricsResponse,
  ReporterComplaintListResponse,
  TechnicianListResponse,
  TechnicianWorkListResponse,
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
  csrf?: boolean;
}

function csrfToken() {
  return window.localStorage.getItem(csrfStorageKey) ?? "";
}

export function storeCsrfToken(token: string) {
  window.localStorage.setItem(csrfStorageKey, token);
}

export function clearCsrfToken() {
  window.localStorage.removeItem(csrfStorageKey);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.csrf) headers.set("X-CSRF-Token", csrfToken());

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? data.detail : data;
    throw new ApiError(typeof detail === "string" ? detail : "Request failed", response.status, detail);
  }
  return data as T;
}

export async function login(payload: LoginRequest) {
  const response = await request<LoginResponse>("/api/v1/auth/login", { method: "POST", body: payload });
  storeCsrfToken(response.csrf_token);
  return response;
}

export async function logout() {
  await request<void>("/api/v1/auth/logout", { method: "POST", csrf: true });
  clearCsrfToken();
}

export function getMe() {
  return request<AuthenticatedUserResponse>("/api/v1/auth/me");
}

export function listBuildings() {
  return request<BuildingListResponse>("/api/v1/buildings");
}

export interface BuildingScopedParams {
  buildingId?: string | null;
}

function withBuilding(path: string, buildingId?: string | null) {
  if (!buildingId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}building_id=${encodeURIComponent(buildingId)}`;
}

export interface ListIncidentsParams extends BuildingScopedParams {
  limit: number;
  offset: number;
  status?: IncidentStatusValue | "";
}

export function listIncidents(params: ListIncidentsParams) {
  const search = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  if (params.status) search.set("status", params.status);
  return request<IncidentListResponse>(withBuilding(`/api/v1/incidents?${search.toString()}`, params.buildingId));
}

export function getIncident(incidentId: string) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}`);
}

export function listMyWork() {
  return request<TechnicianWorkListResponse>("/api/v1/incidents/my-work");
}

export function createComplaint(payload: ComplaintCreateRequest, idempotencyKey: string) {
  return request<ComplaintCreateResponse>("/api/v1/complaints", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: payload,
    csrf: true,
  });
}

export function listMyComplaints(params: { limit: number; offset: number }) {
  const search = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  return request<ReporterComplaintListResponse>(`/api/v1/complaints?${search.toString()}`);
}

export function getComplaint(complaintId: string) {
  return request<ComplaintDetailResponse>(`/api/v1/complaints/${complaintId}`);
}

export function manualTriage(incidentId: string, payload: ManualTriageRequest) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}/manual-triage`, { method: "POST", body: payload, csrf: true });
}

export function listTechnicians(params: BuildingScopedParams = {}) {
  return request<TechnicianListResponse>(withBuilding("/api/v1/technicians", params.buildingId));
}

export function assignTechnician(incidentId: string, payload: AssignmentCreateRequest) {
  return request<AssignmentResponse>(`/api/v1/incidents/${incidentId}/assign`, { method: "POST", body: payload, csrf: true });
}

export function startIncident(incidentId: string, payload: IncidentLifecycleRequest) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}/start`, { method: "POST", body: payload, csrf: true });
}

export function resolveIncident(incidentId: string, payload: IncidentResolveRequest) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}/resolve`, { method: "POST", body: payload, csrf: true });
}

export function closeIncident(incidentId: string, payload: IncidentLifecycleRequest) {
  return request<IncidentDetailResponse>(`/api/v1/incidents/${incidentId}/close`, { method: "POST", body: payload, csrf: true });
}

export function getOperationsMetrics(params: BuildingScopedParams = {}) {
  return request<OperationsMetricsResponse>(withBuilding("/api/v1/metrics/operations", params.buildingId));
}

export function getAiMetrics(params: BuildingScopedParams = {}) {
  return request<AiMetricsResponse>(withBuilding("/api/v1/metrics/ai", params.buildingId));
}
