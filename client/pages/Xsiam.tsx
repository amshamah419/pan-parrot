import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

interface Field {
  name: string;
  type: string;
  isArray: boolean;
}

interface DatasetSample {
  id: string;
  pack: string;
  dataset: string;
  modelingRule: string;
  fromVersion: string;
  schemaPath: string;
  xifPath: string;
  parsingPath: string;
  vendor: string;
  product: string;
  fields: Field[];
  sample: Record<string, unknown>;
  sampleSource: string;
  fieldsFromTestData: string[];
  fieldsAbsentFromTestData: string[];
}

interface CorrelationSample {
  pack: string;
  name: string;
  dataset: string;
  alertName: string;
  severity: string;
  xqlQuery: string;
  sourcePath: string;
}

interface Catalog {
  contentCommit: string;
  contentRepo: string;
  note: string;
  datasets: DatasetSample[];
  correlations: CorrelationSample[];
}

export default function Xsiam() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/xsiam/samples.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load XSIAM samples");
        const body = (await response.json()) as Catalog;
        setCatalog(body);
        setSelected(body.datasets[0]?.id || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load XSIAM samples"));
  }, []);

  const dataset = catalog?.datasets.find((item) => item.id === selected);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex min-h-16 items-center justify-between gap-3 py-2">
          <Logo />
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
        </div>
      </header>
      <main className="container space-y-6 py-6">
        <div>
          <h1 className="text-2xl font-bold">XSIAM dataset samples</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Field names come from the modeling-rule schema in demisto/content. A value is copied from the pack's test_data only when that file already has the key. Fields the test data does not contain are left out.
          </p>
          {catalog && (
            <p className="mt-1 text-xs text-muted-foreground">
              content {catalog.contentCommit.slice(0, 12)} · {catalog.contentRepo}
            </p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {catalog && dataset && (
          <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
            <ul className="space-y-1">
              {catalog.datasets.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`w-full rounded px-2 py-1 text-left text-sm ${item.id === selected ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
                    onClick={() => setSelected(item.id)}
                  >
                    {item.pack}
                    <span className="block text-xs text-muted-foreground">{item.dataset}</span>
                  </button>
                </li>
              ))}
            </ul>
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{dataset.dataset}</h2>
                <p className="text-sm text-muted-foreground">
                  {dataset.modelingRule || dataset.pack}
                  {dataset.vendor ? ` · ${dataset.vendor}/${dataset.product}` : ""}
                  {dataset.fromVersion ? ` · from ${dataset.fromVersion}` : ""}
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{dataset.schemaPath}</p>
                {dataset.parsingPath && <p className="break-all text-xs text-muted-foreground">{dataset.parsingPath}</p>}
                {dataset.sampleSource ? (
                  <p className="break-all text-xs text-muted-foreground">Values from {dataset.sampleSource}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">This pack's test_data has none of these schema keys, so the sample is empty.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(dataset.sample, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${dataset.dataset}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download sample
                </Button>
              </div>
              <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(dataset.sample, null, 2)}</pre>
              <div>
                <h3 className="text-sm font-medium">Schema fields ({dataset.fields.length})</h3>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-xs">
                  {dataset.fields.map((field) => (
                    <li key={field.name}>
                      {field.name} · {field.type}
                      {field.isArray ? "[]" : ""}
                      {dataset.fieldsAbsentFromTestData.includes(field.name) ? " · not in test_data" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        )}
        {catalog && catalog.correlations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Correlation rules</h2>
            {catalog.correlations.map((rule) => (
              <article key={rule.sourcePath} className="rounded border p-3">
                <h3 className="font-medium">{rule.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {rule.alertName} · {rule.severity} · dataset {rule.dataset}
                </p>
                <p className="break-all text-xs text-muted-foreground">{rule.sourcePath}</p>
                <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-3 text-xs">{rule.xqlQuery}</pre>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
