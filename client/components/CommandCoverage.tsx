import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { commandCoverageLabel, type CommandDoc, type MockSpec } from "@shared/mock-spec";
import type { CommandCoverage } from "@shared/mock-spec";
import { instanceGuide } from "@shared/xsoar-instance";

const RESPONSE_LABEL: Record<CommandCoverage["response"], string> = {
  test_data: "test_data",
  "sample-shape": "test_data shape",
  outputs: "guessed outputs",
  arguments: "guessed arguments",
  none: "no mock",
};

const PATH_LABEL: Record<CommandCoverage["pathFrom"], string> = {
  client: "Python client",
  description: "command description",
  mapped: "you mapped it",
  "command-name": "/command-name",
  none: "—",
};

export function CommandCoveragePanel({
  spec,
  catchUrl,
  onChange,
}: {
  spec: MockSpec;
  catchUrl: string;
  onChange: (spec: MockSpec) => void;
}) {
  const rows = spec.source.coverage;
  if (!rows?.length) return null;
  const mocked = rows.filter((row) => row.response !== "none").length;
  const seeded = rows.filter((row) => row.response === "test_data" || row.response === "sample-shape").length;
  const guessed = rows.filter((row) => row.response === "outputs" || row.response === "arguments").length;
  const guide = instanceGuide(spec.source.xsoar, spec.auth, catchUrl);

  const download = () => {
    if (!guide?.download) return;
    const blob = new Blob([guide.download.json], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = guide.download.filename;
    link.click();
    URL.revokeObjectURL(href);
  };

  const mapPath = (row: CommandCoverage, method: string, path: string) => {
    if (!row.operationId) return;
    const nextPath = path.startsWith("/") ? path : `/${path}`;
    onChange({
      ...spec,
      operations: spec.operations.map((operation) =>
        operation.id === row.operationId ? { ...operation, method, pathTemplate: nextPath } : operation,
      ),
      source: {
        ...spec.source,
        coverage: rows.map((item) =>
          item.command === row.command ? { ...item, pathFrom: "mapped" } : item,
        ),
      },
    });
  };

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="coverage-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="coverage-heading" className="text-sm font-medium">Command coverage</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {mocked} of {rows.length} commands have a mock. {seeded} use test_data. {guessed} are guessed from outputs or arguments.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={!guide?.download} onClick={download}>
          Download instance JSON
        </Button>
      </div>
      {!guide?.download && (
        <p className="mt-2 text-xs text-muted-foreground">
          This YAML has no configuration list, so there is no instance JSON to export. The instance panel still appears when a catalog preset has parameters.
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Command</th>
              <th className="py-2 pr-3 font-medium">Response</th>
              <th className="py-2 pr-3 font-medium">Path from</th>
              <th className="py-2 font-medium">Endpoint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const operation = spec.operations.find((item) => item.id === row.operationId);
              return (
                <tr key={row.command} className="border-b align-top">
                  <td className="py-2 pr-3 font-medium">{row.command}</td>
                  <td className="py-2 pr-3">
                    {RESPONSE_LABEL[row.response]}
                    {row.fixture ? <span className="block text-xs text-muted-foreground">{row.fixture}</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{PATH_LABEL[row.pathFrom]}</td>
                  <td className="py-2">
                    {operation ? (
                      <div className="flex flex-wrap gap-2">
                        <select
                          aria-label={`Method for ${row.command}`}
                          className="rounded border bg-background px-2 py-1 text-xs"
                          value={operation.method}
                          onChange={(event) => mapPath(row, event.target.value, operation.pathTemplate)}
                        >
                          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                            <option key={method}>{method}</option>
                          ))}
                        </select>
                        <Input
                          aria-label={`Path for ${row.command}`}
                          className="h-8 min-w-40 font-mono text-xs"
                          defaultValue={operation.pathTemplate}
                          key={`${row.command}:${operation.pathTemplate}`}
                          onBlur={(event) => {
                            if (event.target.value !== operation.pathTemplate) {
                              mapPath(row, operation.method, event.target.value);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No endpoint yet</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const DOC_LABEL: Record<CommandDoc["status"], string> = {
  vendor: "From vendor docs",
  approximate: "Approximate",
  missing: "Missing",
};

export function CommandDocsPanel({ spec }: { spec: MockSpec }) {
  const rows = spec.source.commandDocs;
  if (!rows?.length) return null;
  const summary = {
    total: rows.length,
    vendor: rows.filter((row) => row.status === "vendor").length,
    approximate: rows.filter((row) => row.status === "approximate").length,
    missing: rows.filter((row) => row.status === "missing").length,
  };
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="command-docs-heading">
      <h2 id="command-docs-heading" className="text-sm font-medium">Command coverage</h2>
      <p className="mt-1 text-xs text-muted-foreground">{commandCoverageLabel(summary)}</p>
      <div className="mt-3 max-h-80 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Command</th>
              <th className="py-2 pr-3 font-medium">API call</th>
              <th className="py-2 font-medium">Docs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.command} className="border-b align-top">
                <td className="py-2 pr-3 font-medium">{row.command}</td>
                <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                  {row.calls.length ? row.calls.join(", ") : "—"}
                </td>
                <td className="py-2 text-xs">
                  {row.status === "vendor" && row.docUrl ? (
                    <a className="underline" href={row.docUrl} target="_blank" rel="noreferrer">
                      {DOC_LABEL[row.status]}
                    </a>
                  ) : (
                    DOC_LABEL[row.status]
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
