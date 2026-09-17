export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function compactUuid(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
