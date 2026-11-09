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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrustBadge } from "@/components/TrustBadge";
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
  verification?: { status?: string; docUrl?: string };
}

export function IntegrationPicker({
  onCreated,
}: {
  onCreated?: (endpoint: UserEndpoint) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
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
    const rank = (entry: CatalogEntry) =>
      entry.verification?.status === "verified" || entry.fidelity === "verified" ? 2 : entry.curated ? 1 : 0;
    const ranked = [...catalog].sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name));
    return ranked
      .filter((entry) => !verifiedOnly || rank(entry) === 2)
      .filter((entry) =>
        !needle || `${entry.name} ${entry.pack} ${entry.summary || ""}`.toLowerCase().includes(needle),
      )
      .slice(0, 30);
  }, [catalog, query, verifiedOnly]);

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

  const importText = async (kind: "sample" | "spec", text: string, url?: string, zipBase64?: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await importSpec({ kind, text, url, zipBase64 });
      const mockSpec = result.mockSpec as { source?: { name?: string } } | undefined;
      if (!mockSpec) throw new Error("Import did not return a mock");
      const endpoint = await createEndpoint({
        name: mockSpec.source?.name || "Imported API",
        mockSpec,
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
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a mock</DialogTitle>
          <DialogDescription>
            Pick a vendor API, paste one JSON response, or import a spec. The next screen gives you a URL to paste into the XSOAR integration.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="catalog">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="sample">Sample JSON</TabsTrigger>
            <TabsTrigger value="spec">API spec</TabsTrigger>
          </TabsList>
          <TabsContent value="catalog" className="space-y-3">
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => usePreset("akamai-waf-siem", "Akamai WAF SIEM")}
            >
              Start with Akamai WAF SIEM
            </Button>
            <div className="flex items-center gap-3">
              <Input
                id="preset-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Okta, CrowdStrike, Sentinel..."
              />
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(event) => setVerifiedOnly(event.target.checked)}
                />
                Verified
              </label>
            </div>
            <div className="max-h-80 overflow-y-auto rounded border">
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
                      {entry.summary ? entry.summary.slice(0, 140) : entry.pack}
                    </span>
                  </span>
                  <TrustBadge status={entry.verification?.status} fidelity={entry.fidelity} />
                </button>
              ))}
              {matches.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No matches.</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="sample" className="space-y-3">
            <Label htmlFor="sample-json">Paste one real response</Label>
            <Textarea
              id="sample-json"
              value={sample}
              onChange={(event) => setSample(event.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder='[{"id":"1","created":"2024-01-01T00:00:00Z"}]'
            />
            <Button disabled={busy || !sample.trim()} onClick={() => importText("sample", sample)}>
              Build a mock from this JSON
            </Button>
          </TabsContent>
          <TabsContent value="spec" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              OpenAPI 3, Swagger 2, a Postman v2 collection, a WSDL, a sample XML document, or an XSOAR integration YAML. An integration YAML becomes one operation per command. URLs must be public https. A zip is read for its first text file and then mocked as a zip download.
            </p>
            <Textarea
              id="spec-text"
              value={specText}
              onChange={(event) => setSpecText(event.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder="Paste JSON, YAML, WSDL, or XML"
            />
            <Input
              value={specUrl}
              onChange={(event) => setSpecUrl(event.target.value)}
              placeholder="https://example.com/openapi.yaml"
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !specText.trim()} onClick={() => importText("spec", specText)}>
                Import pasted spec
              </Button>
              <Button variant="outline" disabled={busy || !specUrl.trim()} onClick={() => importText("spec", "", specUrl)}>
                Import from URL
              </Button>
              <label className="inline-flex items-center">
                <input
                  type="file"
                  accept=".json,.yaml,.yml,.xml,.wsdl,.zip,application/json,text/yaml,application/zip"
                  className="text-sm"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 380 * 1024) {
                      setError("File is larger than 380 KB");
                      return;
                    }
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
                      let binary = "";
                      for (const byte of bytes) binary += String.fromCharCode(byte);
                      await importText("spec", "", undefined, btoa(binary));
                      return;
                    }
                    await importText("spec", new TextDecoder().decode(bytes));
                  }}
                />
              </label>
            </div>
          </TabsContent>
        </Tabs>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
