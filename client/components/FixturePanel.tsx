import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCapturedRequests } from "@/lib/api";
import { diffJsonShape } from "@shared/content-pack";
import type { CapturedRequest } from "@shared/api";
import type { MockSpec } from "@shared/mock-spec";

export function FixturePanel({
  endpointId,
  spec,
  catchUrl,
}: {
  endpointId: string;
  spec: MockSpec;
  catchUrl: string;
}) {
  const slug = catchSlug(catchUrl);
  const [calls, setCalls] = useState<CapturedRequest[]>([]);
  const [operationId, setOperationId] = useState(spec.operations[0]?.id || "");
  const [text, setText] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [compared, setCompared] = useState(false);

  useEffect(() => {
    void getCapturedRequests()
      .then((rows) => setCalls(rows.filter((row) => row.endpoint.startsWith(`/catch/${slug}`))))
      .catch(() => setCalls([]));
  }, [slug]);

  const compare = (raw: string) => {
    setCompared(true);
    setError("");
    const operation = spec.operations.find((item) => item.id === operationId) || spec.operations[0];
    if (!operation) return;
    try {
      const value = JSON.parse(raw) as unknown;
      const diff = diffJsonShape(operation, value);
      setMissing(diff.missing);
      setExtra(diff.extra);
    } catch {
      setMissing([]);
      setExtra([]);
      setError("Paste a JSON object or array.");
    }
  };

  return (
    <section className="rounded-lg border p-4" aria-labelledby="fixtures-heading">
      <h2 id="fixtures-heading" className="text-sm font-medium">Content pack fixtures</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        test_data files are the raw HTTP body most XSOAR unit tests load. The README in the zip shows the util_load_json snippet and the mock_response wrapper.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/endpoints/${endpointId}/export?format=content-pack`}>Export test_data</a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/endpoints/${endpointId}/export?format=captured`}>Fixtures from captured calls</a>
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium">Shape diff</p>
        <p className="text-xs text-muted-foreground">
          Paste a real vendor response, or pick a captured response preview. Missing fields are in the preset and not in the JSON. Extra fields are in the JSON and not in the preset.
        </p>
        <label className="block text-xs">
          Operation
          <select
            className="mt-1 block rounded border bg-background px-2 py-2 text-sm"
            aria-label="Operation to compare"
            value={operationId}
            onChange={(event) => setOperationId(event.target.value)}
          >
            {spec.operations.map((operation) => (
              <option key={operation.id} value={operation.id}>
                {operation.method} {operation.pathTemplate}
              </option>
            ))}
          </select>
        </label>
        {calls.length === 0 && (
          <p className="text-xs text-muted-foreground">No captured calls for this catch URL yet. Hit the try URL, then come back to compare a real body.</p>
        )}
        {calls.length > 0 && (
          <label className="grid min-w-0 text-xs">
            Captured response
            <select
              className="mt-1 w-full min-w-0 max-w-full rounded border bg-background px-2 py-2 text-sm"
              aria-label="Captured response to compare"
              defaultValue=""
              onChange={(event) => {
                const call = calls.find((item) => item.id === event.target.value);
                if (call?.responsePreview) setText(call.responsePreview);
              }}
            >
              <option value="">Choose a captured call</option>
              {calls.slice(0, 12).map((call) => (
                <option key={call.id} value={call.id}>
                  {call.method} {call.endpoint}
                </option>
              ))}
            </select>
          </label>
        )}
        <Textarea
          rows={5}
          className="font-mono text-xs"
          aria-label="Vendor response JSON"
          placeholder='{"id": 1, "status": "OPEN"}'
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="button" size="sm" onClick={() => compare(text)}>Compare</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {compared && !error && (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="font-medium">Missing</p>
              {missing.length === 0 ? <p className="text-muted-foreground">None</p> : (
                <ul className="mt-1 list-disc pl-5">{missing.map((item) => <li key={item}>{item}</li>)}</ul>
              )}
            </div>
            <div>
              <p className="font-medium">Extra</p>
              {extra.length === 0 ? <p className="text-muted-foreground">None</p> : (
                <ul className="mt-1 list-disc pl-5">{extra.map((item) => <li key={item}>{item}</li>)}</ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function catchSlug(url: string): string {
  return url.match(/\/catch\/([^/?#]+)/)?.[1] || "";
}
