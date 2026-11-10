import { Badge } from "@/components/ui/badge";

export function trustLabel(status?: string, fidelity?: string): string {
  if (status === "verified") return "Verified";
  if (status === "sample") return "Checked sample";
  if (status === "shape") return "Checked shape";
  if (fidelity === "verified") return "Verified";
  if (fidelity === "high") return "Hand-built";
  if (fidelity === "generated") return "From spec";
  if (fidelity === "sample") return "From sample";
  if (fidelity === "guessed" || fidelity === "shape") return "Guessed shape";
  return "Guessed shape";
}

export function TrustBadge({
  status,
  fidelity,
}: {
  status?: string;
  fidelity?: string;
}) {
  const label = trustLabel(status, fidelity);
  const verified = label === "Verified";
  return (
    <Badge variant={verified ? "default" : "secondary"} className="shrink-0">
      {label}
    </Badge>
  );
}
