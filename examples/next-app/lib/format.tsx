export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ProductBadge({ label }: { label: string }) {
  return <span>{label.toUpperCase()}</span>;
}
