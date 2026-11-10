import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getShares,
  getVersions,
  revertVersion,
  setPublished,
  shareEndpoint,
  unshareEndpoint,
} from "@/lib/api";

export function CollabPanel({
  endpointId,
  access,
  published,
  onPublished,
  onReverted,
}: {
  endpointId: string;
  access: "owner" | "edit" | "view";
  published: boolean;
  onPublished: (value: boolean) => void;
  onReverted: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"view" | "edit">("view");
  const [shares, setShares] = useState<Array<{ email: string; role: string }>>([]);
  const [versions, setVersions] = useState<Array<{ id: string; summary: string; actorEmail: string; created: string; changes: string[] }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (access === "owner") {
      getShares(endpointId).then(setShares).catch(() => setShares([]));
    }
    getVersions(endpointId).then(setVersions).catch(() => setVersions([]));
  }, [access, endpointId]);

  return (
    <section className="rounded-lg border p-4" aria-labelledby="collab-heading">
      <h2 id="collab-heading" className="text-sm font-medium">People and history</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Share with other signed-in @paloaltonetworks.com addresses. The catch URL itself stays unauthenticated. Publishing adds the mock to the shared catalog so anyone signed in can clone it.
      </p>
      {access === "owner" && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">List in the shared catalog</span>
            <Switch
              checked={published}
              aria-label="List in the shared catalog"
              onCheckedChange={(value) => {
                void setPublished(endpointId, value).then(() => onPublished(value)).catch((err) => setError(err.message));
              }}
            />
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void shareEndpoint(endpointId, email.trim(), role)
                .then((rows) => {
                  setShares(rows);
                  setEmail("");
                  setError("");
                })
                .catch((err) => setError(err instanceof Error ? err.message : "Could not share"));
            }}
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="colleague@paloaltonetworks.com"
              aria-label="Email address to share with"
              className="max-w-sm"
            />
            <select className="rounded border bg-background px-2 text-sm" aria-label="Access" value={role} onChange={(event) => setRole(event.target.value as "view" | "edit")}>
              <option value="view">Can view</option>
              <option value="edit">Can edit</option>
            </select>
            <Button type="submit">Share</Button>
          </form>
          {shares.length === 0 && (
            <p className="text-sm text-muted-foreground">No one else can open this mock yet.</p>
          )}
          <ul className="space-y-1 text-sm">
            {shares.map((share) => (
              <li key={share.email} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-all">{share.email} · {share.role}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void unshareEndpoint(endpointId, share.email).then(() => setShares((rows) => rows.filter((row) => row.email !== share.email)))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {versions.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Saves show up here after you click Save.</p>
      )}
      {versions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium">Recent saves</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {versions.map((version) => (
              <li key={version.id} className="space-y-1 rounded border px-2 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{version.summary} · {version.actorEmail}</span>
                  {access !== "view" && (
                    <Button type="button" variant="outline" size="sm" onClick={() => void revertVersion(endpointId, version.id).then(onReverted).catch((err) => setError(err.message))}>
                      Revert
                    </Button>
                  )}
                </div>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {(version.changes || ["The spec would not change."]).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
