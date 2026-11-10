import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/api";

interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created: string;
  expires: string;
  lastUsed: string | null;
}

export function ApiTokens() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [name, setName] = useState("");
  const [days, setDays] = useState("90");
  const [readScope, setReadScope] = useState(true);
  const [writeScope, setWriteScope] = useState(true);
  const [revealed, setRevealed] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    listApiTokens().then(setRows).catch((err) => setError(err instanceof Error ? err.message : "Could not load tokens"));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const scopes = [readScope ? "mocks:read" : "", writeScope ? "mocks:write" : ""].filter(Boolean);
      const created = await createApiToken({ name: name.trim(), days: Number(days), scopes });
      setRevealed(created.token);
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a token");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Personal API tokens</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        A token calls <code>/api/v1</code>. It is shown once, stored only as a hash, and expires. The default is 90 days and the maximum is one year. Creating or revoking a token still requires this signed-in session.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="laptop"
          className="max-w-xs"
          aria-label="Token name"
        />
        <Input
          value={days}
          onChange={(event) => setDays(event.target.value)}
          inputMode="numeric"
          className="w-24"
          aria-label="Expiry in days"
        />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={readScope} onChange={(event) => setReadScope(event.target.checked)} />
          mocks:read
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={writeScope} onChange={(event) => setWriteScope(event.target.checked)} />
          mocks:write
        </label>
        <Button type="button" variant="outline" disabled={busy || !name.trim() || (!readScope && !writeScope)} onClick={create}>
          Create token
        </Button>
      </div>
      {revealed && (
        <p className="mt-3 break-all rounded bg-muted px-3 py-2 font-mono text-xs">
          {revealed}
          <span className="mt-1 block font-sans text-muted-foreground">Copy it now. Reloading this page hides it.</span>
        </p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {row.name} <code className="text-xs text-muted-foreground">{row.prefix}…</code>
              <span className="ml-2 text-xs text-muted-foreground">
                {row.scopes.join(" ")} · expires {new Date(row.expires).toLocaleDateString()}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void revokeApiToken(row.id).then(load).catch((err) => setError(err instanceof Error ? err.message : "Could not revoke"));
              }}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
