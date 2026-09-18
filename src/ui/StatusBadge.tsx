const toneByStatus: Record<string, string> = {
  PENDING_TRIAGE: "bg-slate-100 text-slate-700 ring-slate-200",
  MANUAL_REVIEW: "bg-slate-100 text-slate-700 ring-slate-200",
  AWAITING_ASSIGNMENT: "bg-slate-100 text-slate-700 ring-slate-200",
  AWAITING_APPROVAL: "bg-slate-100 text-slate-700 ring-slate-200",
  ASSIGNED: "bg-slate-100 text-slate-700 ring-slate-200",
  IN_PROGRESS: "bg-slate-100 text-slate-700 ring-slate-200",
  RESOLVED: "bg-slate-100 text-slate-700 ring-slate-200",
  CLOSED: "bg-slate-100 text-slate-700 ring-slate-200",
  AVAILABLE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  UNAVAILABLE: "bg-amber-50 text-amber-900 ring-amber-200",
  SUCCEEDED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  FAILED: "bg-rose-50 text-rose-800 ring-rose-200",
  INVALID_OUTPUT: "bg-rose-50 text-rose-800 ring-rose-200",
  TIMEOUT: "bg-amber-50 text-amber-900 ring-amber-200",
  PENDING: "bg-slate-100 text-slate-700 ring-slate-200",
  PROCESSING: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function StatusBadge({ status, ai = false }: { status: string | null | undefined; ai?: boolean }) {
  if (!status) return <span className="text-sm text-slate-500">Not available</span>;
  const tone = ai && status === "SUCCEEDED" ? "bg-violet-50 text-violet-800 ring-violet-200" : toneByStatus[status] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`inline-flex rounded-[3px] px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>{status.replaceAll("_", " ")}</span>;
}
