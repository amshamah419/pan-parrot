import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createEndpoint, importSpec } from "@/lib/api";
import type { UserEndpoint } from "@shared/api";
import { Sparkles } from "lucide-react";

interface CatalogEntry {
  id: string;
  name: string;
  pack: string;
  fidelity?: string;
  curated?: boolean;
  summary?: string;
  operations?: number;
}

export function IntegrationPicker({
  onCreated,
}: {
  onCreated?: (endpoint: UserEndpoint) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState("Akamai WAF SIEM");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState("");
  const [specText, setSpecText] = useState("");
  const [specUrl, setSpecUrl] = useState("");

  useEffect(() => {
    if (!open || catalog.length) return;
    fetch("/presets/index.json")
      .then((response) => response.json())
      .then((data) => setCatalog(data.presets || []))
      .catch(() => setError("Could not load the integration catalog"));
  }, [open, catalog.length]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const ranked = [...catalog].sort((a, b) => Number(b.curated) - Number(a.curated));
    if (!needle) return ranked.slice(0, 20);
    return ranked
      .filter((entry) =>
        `${entry.name} ${entry.pack} ${entry.summary || ""}`.toLowerCase().includes(needle),
      )
      .slice(0, 20);
  }, [catalog, query]);

  const usePreset = async (id: string, name: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/presets/integrations/${id}.json`);
      if (!response.ok) throw new Error("Preset file is missing");
      const preset = await response.json();
      const endpoint = await createEndpoint({
        name,
        mockSpec: preset.spec,
      });
      onCreated?.(endpoint);
      setOpen(false);
      navigate(`/mock/${endpoint.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the mock");
    } finally {
      setBusy(false);
    }
  };

  const importText = async (kind: "sample" | "spec", text: string, url?: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await importSpec({ kind, text, url });
      const endpoint = await createEndpoint({
        name: (result.mockSpec as { source?: { name?: string } }).source?.name || "Imported API",
        mockSpec: result.mockSpec,
      });
      onCreated?.(endpoint);
      setOpen(false);
      navigate(`/mock/${endpoint.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Sparkles className="mr-2 h-4 w-4" />
          Mock an integration
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start from a real API</DialogTitle>
          <DialogDescription>
            Pick an XSOAR integration, paste a sample, or import an OpenAPI, Swagger, or Postman spec. You will get a catch URL to paste into the integration's server field.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => usePreset("akamai-waf-siem", "Akamai WAF SIEM")}
          >
            Start with Akamai WAF SIEM
          </Button>
          <div className="space-y-2">
            <Label htmlFor="preset-search">Search XSOAR integrations</Label>
            <Input
              id="preset-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Okta, CrowdStrike, Defender, Graph..."
            />
            <div className="max-h-48 overflow-y-auto rounded border">
              {matches.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left hover:bg-muted"
                  disabled={busy}
                  onClick={() => usePreset(entry.id, entry.name)}
                >
                  <span>
                    <span className="block text-sm font-medium">{entry.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.pack}
                      {entry.summary ? ` · ${entry.summary.slice(0, 110)}` : ""}
                    </span>
                  </span>
                  <Badge variant={entry.curated ? "default" : "secondary"}>
                    {entry.curated ? "curated" : entry.fidelity || "sample"}
                  </Badge>
                </button>
              ))}
              {matches.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No matches.</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sample-json">Or paste a sample JSON response</Label>
            <Textarea
              id="sample-json"
              value={sample}
              onChange={(event) => setSample(event.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder='[{"id":"1","created":"2024-01-01T00:00:00Z"}]'
            />
            <Button
              variant="outline"
              disabled={busy || !sample.trim()}
              onClick={() => importText("sample", sample)}
            >
              Infer shape from sample
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spec-text">Or OpenAPI 3 / Swagger 2 / Postman collection</Label>
            <Textarea
              id="spec-text"
              value={specText}
              onChange={(event) => setSpecText(event.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder="Paste JSON or YAML"
            />
            <Input
              value={specUrl}
              onChange={(event) => setSpecUrl(event.target.value)}
              placeholder="https://example.com/openapi.yaml"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={busy || !specText.trim()}
                onClick={() => importText("spec", specText)}
              >
                Import pasted spec
              </Button>
              <Button
                variant="outline"
                disabled={busy || !specUrl.trim()}
                onClick={() => importText("spec", "", specUrl)}
              >
                Import from URL
              </Button>
              <label className="inline-flex items-center">
                <input
                  type="file"
                  accept=".json,.yaml,.yml,application/json,text/yaml"
                  className="text-sm"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 512 * 1024) {
                      setError("File is larger than 512 KB");
                      return;
                    }
                    const text = await file.text();
                    await importText("spec", text);
                  }}
                />
              </label>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
