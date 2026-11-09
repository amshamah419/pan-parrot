import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MockSpec, XsoarIntegration } from "@shared/mock-spec";
import { instanceGuide, type InstanceGuide as Guide } from "@shared/xsoar-instance";

let catalogPromise: Promise<Record<string, XsoarIntegration>> | null = null;

function loadCatalog(): Promise<Record<string, XsoarIntegration>> {
  catalogPromise ??= fetch("/presets/instance-params.json")
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));
  return catalogPromise;
}

export function InstanceGuidePanel({ spec, catchUrl }: { spec: MockSpec; catchUrl: string }) {
  const [integration, setIntegration] = useState<XsoarIntegration | undefined>(spec.source.xsoar);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (spec.source.xsoar) {
      setIntegration(spec.source.xsoar);
      return;
    }
    const id = spec.source.kind === "preset" ? spec.source.id : undefined;
    if (!id) {
      setIntegration(undefined);
      return;
    }
    let cancelled = false;
    void loadCatalog().then((catalog) => {
      if (!cancelled) setIntegration(catalog[id]);
    });
    return () => {
      cancelled = true;
    };
  }, [spec.source.id, spec.source.kind, spec.source.xsoar]);

  const guide = instanceGuide(integration, spec.auth, catchUrl);
  if (!guide) return null;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopied("");
    }
  };

  const download = () => {
    if (!guide.download) return;
    const blob = new Blob([guide.download.json], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = guide.download.filename;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="instance-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="instance-heading" className="text-sm font-medium">XSOAR integration instance</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {guide.display} ({guide.brand}). Parameter names come from the integration YAML. Values are the dummy ones this mock expects. Do not paste a real credential.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void copy("all", formatRows(guide))}>
            Copy all
          </Button>
          {guide.download && (
            <Button type="button" variant="outline" size="sm" onClick={download}>
              Download instance JSON
            </Button>
          )}
        </div>
      </div>
      <ul className="mt-3 space-y-3">
        {guide.rows.map((row) => (
          <li key={row.name} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.label} <span className="font-normal text-muted-foreground">({row.name})</span></p>
              <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{row.value || "—"}</code>
              {row.note && <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" aria-label={`Copy ${row.label}`} onClick={() => void copy(row.name, row.copy)}>
              {copied === row.name ? "Copied" : "Copy"}
            </Button>
          </li>
        ))}
      </ul>
      {copied === "all" && <p className="mt-2 text-xs text-muted-foreground">Copied the instance fields.</p>}
    </section>
  );
}

function formatRows(guide: Guide): string {
  return guide.rows.map((row) => `${row.name}: ${row.copy || row.value}`).join("\n");
}
