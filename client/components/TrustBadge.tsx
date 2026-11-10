import { Badge } from "@/components/ui/badge";

export function trustLabel(status?: string, fidelity?: string, formattingFixed?: boolean): string {
  if ((fidelity === "vendor" || status === "vendor") && formattingFixed) return "From vendor docs (formatting fixed)";
  if (fidelity === "vendor" || status === "vendor") return "From vendor docs";
  return "Approximate";
}

export function TrustBadge({
  status,
  fidelity,
  docUrl,
  formattingFixed,
}: {
  status?: string;
  fidelity?: string;
  docUrl?: string;
  formattingFixed?: boolean;
}) {
  const vendor = fidelity === "vendor" || status === "vendor";
  const badge = (
    <Badge variant={vendor ? "default" : "secondary"} className="shrink-0">
      {trustLabel(status, fidelity, formattingFixed)}
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
