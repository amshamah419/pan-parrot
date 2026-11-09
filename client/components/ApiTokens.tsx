import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/api";

interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string | null;
}

export function ApiTokens() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [name, setName] = useState("");
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
      const created = await createApiToken(name.trim());
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
        A token can create and export mocks from the CLI. It is shown once and is not stored in the browser. Creating or revoking a token still requires this signed-in session.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="laptop"
          className="max-w-xs"
        />
        <Button type="button" variant="outline" disabled={busy || !name.trim()} onClick={create}>
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
