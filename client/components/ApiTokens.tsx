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

function expiryLabel(iso: string): string {
  const remaining = new Date(iso).getTime() - Date.now();
  if (remaining < 24 * 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(remaining / 60000));
    return minutes < 90 ? `expires in ${minutes} min` : "expires in 1 hour";
  }
  return `expires ${new Date(iso).toLocaleDateString()}`;
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
  const [release, setRelease] = useState<{ version: string; filename: string } | null>(null);
  const [installToken, setInstallToken] = useState("");
  const [copied, setCopied] = useState(false);

  const installCommand = release && installToken
    ? `pipx install "https://${installToken}@${window.location.host}/api/v1/cli/${release.filename}"`
    : "";

  const load = () => {
    listApiTokens().then(setRows).catch((err) => setError(err instanceof Error ? err.message : "Could not load tokens"));
  };

  useEffect(() => {
    load();
    void fetch("/api/v1/cli", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.filename && body?.version) setRelease({ version: body.version, filename: body.filename });
      })
      .catch(() => setError("Could not load the CLI release"));
    void createApiToken({ name: "CLI install", scopes: ["cli:download"] })
      .then((created) => {
        setInstallToken(created.token);
        load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not prepare the install link"));
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
      {release && (
        <div className="mt-3 rounded bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Install panparrot {release.version}. The command carries a <code>cli:download</code> token that lasts 1 hour and can only download the wheel. It cannot read or change mocks. Do not paste a login token into this URL. The package is not on public PyPI. The download button uses this signed-in session.
          </p>
          <pre className="mt-2 overflow-auto font-mono text-xs text-foreground">{installCommand || "Preparing an install link…"}</pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!installCommand}
              onClick={() => {
                void navigator.clipboard.writeText(installCommand).then(() => {
                  setCopied(true);
                }).catch(() => setError("Could not copy the install command"));
              }}
            >
              {copied ? "Copied" : "Copy install command"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void fetch(`/api/v1/cli/${release.filename}`, { credentials: "include" })
                  .then(async (response) => {
                    if (!response.ok) throw new Error("Could not download the CLI");
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = release.filename;
                    link.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : "Could not download the CLI"));
              }}
            >
              Download wheel
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Reloading this page mints a new install link. The login token, shown once when you create it, is a different credential.</p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {row.name} <code className="text-xs text-muted-foreground">{row.prefix}…</code>
              <span className="ml-2 text-xs text-muted-foreground">
                {row.scopes.join(" ")} · {expiryLabel(row.expires)}
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
