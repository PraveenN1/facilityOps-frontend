export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
      {label}...
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", detail }: { title?: string; detail?: unknown }) {
  return (
    <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
      <p className="font-semibold">{title}</p>
      {detail ? <p className="mt-1">{String(detail)}</p> : null}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
