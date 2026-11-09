import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordUpstreamCall } from "@/lib/api";
import { MOCK_LIMITS } from "@shared/policy";
import type { RecordedFixture } from "@shared/recording";
import type { ScenarioStep } from "@shared/mock-spec";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function RecordCall({
  stepCount,
  onAdd,
}: {
  stepCount: number;
  onAdd: (step: ScenarioStep) => void;
}) {
  const [url, setUrl] = useState("https://");
  const [method, setMethod] = useState("GET");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fixture, setFixture] = useState<RecordedFixture | null>(null);
  const [added, setAdded] = useState("");
  const [placed, setPlaced] = useState(false);

  const record = async () => {
    setBusy(true);
    setError("");
    setAdded("");
    setPlaced(false);
    const headerMap = parseHeaderLines(headers);
    const requestBody = body;
    setHeaders("");
    setBody("");
    try {
      const result = await recordUpstreamCall({
        url: url.trim(),
        method,
        headers: headerMap,
        body: method === "GET" ? undefined : requestBody,
      });
      setFixture(result);
    } catch (err) {
      setFixture(null);
      setError(err instanceof Error ? err.message : "Could not record");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded border p-3">
      <div>
        <p className="text-sm font-medium">Record one call</p>
        <p className="text-xs text-muted-foreground">
          One request to a public https URL. Header values are sent once and are not saved or written to the request log. The response is scrubbed, then you can add it as a sequence step.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        <Label className="text-xs">Method
          <select
            className="mt-1 block w-full rounded border bg-background px-2 py-2 text-sm"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            {METHODS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Label>
        <Label className="text-xs">Upstream URL
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://api.example.com/v1/incidents"
          />
        </Label>
      </div>
      <Label className="text-xs">Headers, one Name: value per line. Cleared when you record.
        <Textarea
          rows={3}
          className="font-mono text-xs"
          value={headers}
          onChange={(event) => setHeaders(event.target.value)}
          placeholder="Authorization: Bearer …"
        />
      </Label>
      {method !== "GET" && (
        <Label className="text-xs">Body. Cleared when you record.
          <Textarea
            rows={3}
            className="font-mono text-xs"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </Label>
      )}
      <Button type="button" onClick={record} disabled={busy || !url.trim()}>
        {busy ? "Recording…" : "Record"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {fixture && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Status {fixture.status}
            {fixture.truncated ? ` · stored body capped at ${MOCK_LIMITS.maxScenarioBodyBytes} characters` : ""}
            . Nothing from the request headers is in this preview.
          </p>
          <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 text-xs whitespace-pre-wrap break-all">
            {fixture.body || "(empty body)"}
          </pre>
          {stepCount >= MOCK_LIMITS.maxScenarioSteps ? (
            <p className="text-sm text-muted-foreground">
              The sequence already has {MOCK_LIMITS.maxScenarioSteps} steps. Remove one before adding this recording.
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={placed}
              onClick={() => {
                onAdd(fixture.step);
                setPlaced(true);
                setAdded("Added to the sequence. Save the mock to keep it.");
              }}
            >
              {placed ? "Added" : "Add to the sequence"}
            </Button>
          )}
          {added && <p className="text-sm text-green-700">{added}</p>}
        </div>
      )}
    </section>
  );
}

function parseHeaderLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const name = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (name && value && Object.keys(out).length < 8) out[name] = value;
  }
  return out;
}
