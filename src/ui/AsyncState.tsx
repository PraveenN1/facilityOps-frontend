import { ClipboardList, Loader2, TriangleAlert } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="async-state">
      <Loader2 aria-hidden size={18} />
      {label}...
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", detail }: { title?: string; detail?: unknown }) {
  return (
    <div role="alert" className="error-state">
      <TriangleAlert aria-hidden size={18} />
      <p className="font-semibold">{title}</p>
      {detail ? <p className="mt-1">{String(detail)}</p> : null}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <ClipboardList aria-hidden size={22} />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
