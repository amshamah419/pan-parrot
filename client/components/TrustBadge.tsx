import { Badge } from "@/components/ui/badge";

export function trustLabel(status?: string, fidelity?: string): string {
  if (fidelity === "vendor" || status === "vendor") return "From vendor docs";
  return "Approximate";
}

export function TrustBadge({
  status,
  fidelity,
  docUrl,
}: {
  status?: string;
  fidelity?: string;
  docUrl?: string;
}) {
  const vendor = fidelity === "vendor" || status === "vendor";
  const badge = (
    <Badge variant={vendor ? "default" : "secondary"} className="shrink-0">
      {trustLabel(status, fidelity)}
    </Badge>
  );
  if (vendor && docUrl) {
    return (
      <a href={docUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0">
        {badge}
      </a>
    );
  }
  return badge;
}
