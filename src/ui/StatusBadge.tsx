const toneByStatus: Record<string, string> = {
  PENDING_TRIAGE: "status-workflow",
  MANUAL_REVIEW: "status-workflow",
  AWAITING_ASSIGNMENT: "status-workflow",
  AWAITING_APPROVAL: "status-workflow",
  ASSIGNED: "status-workflow",
  IN_PROGRESS: "status-workflow",
  RESOLVED: "status-success",
  CLOSED: "status-neutral",
  AVAILABLE: "status-availability",
  UNAVAILABLE: "status-muted-warning",
  SUCCEEDED: "status-success",
  FAILED: "status-error",
  INVALID_OUTPUT: "status-error",
  TIMEOUT: "status-muted-warning",
  PENDING: "status-workflow",
  PROCESSING: "status-ai",
};

export function StatusBadge({ status, ai = false }: { status: string | null | undefined; ai?: boolean }) {
  if (!status) return <span className="status-empty">Not available</span>;
  const tone = ai && (status === "SUCCEEDED" || status === "PROCESSED") ? "status-ai" : toneByStatus[status] ?? "status-neutral";
  return <span className={`status-badge ${tone}`}>{status.replaceAll("_", " ")}</span>;
}
