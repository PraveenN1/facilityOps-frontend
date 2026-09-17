const toneByStatus: Record<string, string> = {
  PENDING_TRIAGE: "bg-slate-100 text-slate-700 ring-slate-200",
  MANUAL_REVIEW: "bg-amber-100 text-amber-800 ring-amber-200",
  AWAITING_ASSIGNMENT: "bg-sky-100 text-sky-800 ring-sky-200",
  AWAITING_APPROVAL: "bg-violet-100 text-violet-800 ring-violet-200",
  ASSIGNED: "bg-blue-100 text-blue-800 ring-blue-200",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800 ring-cyan-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CLOSED: "bg-stone-100 text-stone-700 ring-stone-200",
  SUCCEEDED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  FAILED: "bg-rose-100 text-rose-800 ring-rose-200",
  INVALID_OUTPUT: "bg-rose-100 text-rose-800 ring-rose-200",
  TIMEOUT: "bg-orange-100 text-orange-800 ring-orange-200",
  PENDING: "bg-slate-100 text-slate-700 ring-slate-200",
  PROCESSING: "bg-cyan-100 text-cyan-800 ring-cyan-200",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-sm text-slate-500">Not available</span>;
  const tone = toneByStatus[status] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
