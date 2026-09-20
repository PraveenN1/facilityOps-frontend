const toneByStatus: Record<string, string> = {
  PENDING_TRIAGE: "status-neutral",
  MANUAL_REVIEW: "status-neutral",
  AWAITING_ASSIGNMENT: "status-neutral",
  AWAITING_APPROVAL: "status-neutral",
  ASSIGNED: "status-neutral",
  IN_PROGRESS: "status-neutral",
  RESOLVED: "status-neutral",
  CLOSED: "status-neutral",
  AVAILABLE: "status-ok",
  UNAVAILABLE: "status-warning",
  SUCCEEDED: "status-ok",
  FAILED: "status-danger",
  INVALID_OUTPUT: "status-danger",
  TIMEOUT: "status-warning",
  PENDING: "status-neutral",
  PROCESSING: "status-ai",
};

export function StatusBadge({ status, ai = false }: { status: string | null | undefined; ai?: boolean }) {
  if (!status) return <span className="status-empty">Not available</span>;
  const tone = ai && status === "SUCCEEDED" ? "status-ai" : toneByStatus[status] ?? "status-neutral";
  return <span className={`status-badge ${tone}`}>{status.replaceAll("_", " ")}</span>;
}
