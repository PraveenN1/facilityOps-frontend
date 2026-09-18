export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export const incidentStatuses = [
  "PENDING_TRIAGE",
  "MANUAL_REVIEW",
  "AWAITING_ASSIGNMENT",
  "AWAITING_APPROVAL",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

export const incidentPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const csrfStorageKey = "facilityops.csrfToken";
