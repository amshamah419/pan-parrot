import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getPushDeliveries, pushEndpoint, saveMockSpec } from "@/lib/api";
import type { MockSpec, PushSpec } from "@shared/mock-spec";

const INTERVALS = [
  { value: 0, label: "Manual only" },
  { value: 15, label: "Every 15 minutes" },
  { value: 60, label: "Hourly" },
  { value: 1440, label: "Daily" },
];

export function PushPanel({
  endpointId,
  spec,
  onChange,
}: {
  endpointId: string;
  spec: MockSpec;
  onChange: (push: PushSpec) => void;
}) {
  const push = spec.push || {
    enabled: false,
    url: "",
    intervalMinutes: 0,
    batch: 1,
    retries: 1,
    signing: "none" as const,
  };
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deliveries, setDeliveries] = useState<Array<{ id: string; ok: boolean; attempts: number; status: number | null; error: string | null; created: string }>>([]);

  const update = (next: Partial<PushSpec>) => onChange({ ...push, secret: undefined, ...next });

  useEffect(() => {
    getPushDeliveries(endpointId).then((result) => setDeliveries(result.deliveries)).catch(() => setDeliveries([]));
  }, [endpointId]);

  const send = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    const next: MockSpec = { ...spec, push: { ...push, secret: secret || undefined } };
    try {
      await saveMockSpec(endpointId, next);
      setSecret("");
      onChange({ ...next.push!, secret: undefined, hasSecret: Boolean(secret || push.hasSecret) });
      const result = await pushEndpoint(endpointId);
      if (result.ok) {
        setStatus(`Sent. Upstream returned ${result.status} after ${result.attempts} attempt${result.attempts === 1 ? "" : "s"}.`);
      } else {
        setError(result.error || "Push failed");
      }
      const history = await getPushDeliveries(endpointId);
      setDeliveries(history.deliveries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not push");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Send generated events to a public https webhook or long-running listener. Private and internal addresses are rejected. The published site does not poll on a schedule, so the database can sleep. Push now can send up to three events, each retried on a 5xx or a network error. Redirects are not followed.
      </p>
      <div className="flex items-center justify-between rounded border px-3 py-2">
        <span className="text-sm">Send on the schedule</span>
        <Switch aria-label="Send on the schedule" checked={push.enabled} onCheckedChange={(enabled) => update({ enabled })} />
      </div>
      <Label className="text-xs">Target URL
        <Input value={push.url} placeholder="https://collector.example.com/webhook" onChange={(event) => update({ url: event.target.value })} />
      </Label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Label className="text-xs">Schedule
          <select className="mt-1 block w-full rounded border bg-background px-2 py-2 text-sm" value={push.intervalMinutes} onChange={(event) => update({ intervalMinutes: Number(event.target.value) })}>
            {INTERVALS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Label>
        <Label className="text-xs">Events per push now
          <Input type="number" min={1} max={3} value={push.batch} onChange={(event) => update({ batch: Number(event.target.value) || 1 })} />
        </Label>
        <Label className="text-xs">Retries
          <Input type="number" min={0} max={2} value={push.retries} onChange={(event) => update({ retries: Number(event.target.value) || 0 })} />
        </Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="text-xs">Signing
          <select className="mt-1 block w-full rounded border bg-background px-2 py-2 text-sm" value={push.signing} onChange={(event) => update({ signing: event.target.value as PushSpec["signing"] })}>
            <option value="none">None</option>
            <option value="hmac-sha256">HMAC-SHA256</option>
            <option value="bearer">Bearer token</option>
          </select>
        </Label>
        {push.signing !== "none" && (
          <Label className="text-xs">Secret. {push.hasSecret ? "One is saved. Leave this blank to keep it." : "Shown only until you push."}
            <Input type="password" value={secret} autoComplete="off" onChange={(event) => setSecret(event.target.value)} />
          </Label>
        )}
      </div>
      <Button type="button" onClick={send} disabled={busy || !push.url.trim()}>
        {busy ? "Pushing…" : "Push now"}
      </Button>
      {status && <p className="text-sm text-green-700" role="status">{status}</p>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {deliveries.length === 0 && (
        <p className="text-sm text-muted-foreground">No pushes yet. A private or non-https URL is rejected before anything is sent.</p>
      )}
      {deliveries.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {deliveries.map((row) => (
            <li key={row.id}>
              {row.ok ? "Sent" : "Failed"} · {row.status ?? "no response"} · {row.attempts} attempt{row.attempts === 1 ? "" : "s"}
              {row.error ? ` · ${row.error}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
