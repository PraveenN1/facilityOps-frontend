export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="async-state">
      {label}...
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", detail }: { title?: string; detail?: unknown }) {
  return (
    <div role="alert" className="error-state">
      <p className="font-semibold">{title}</p>
      {detail ? <p className="mt-1">{String(detail)}</p> : null}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
