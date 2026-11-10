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
import { clearPresetCatalogCache, loadPresetCatalog, type PresetCatalogEntry } from "@/lib/preset-catalog";
import type { UserEndpoint } from "@shared/api";
import { Sparkles } from "lucide-react";

export function IntegrationPicker({
  onCreated,
}: {
  onCreated?: (endpoint: UserEndpoint) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<PresetCatalogEntry[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [vendorOnly, setVendorOnly] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState("");
  const [specText, setSpecText] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [progressYaml, setProgressYaml] = useState("");
  const [contentPath, setContentPath] = useState("");
  const [clientSource, setClientSource] = useState("");
  const [testData, setTestData] = useState<{ name: string; text: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCatalogState("loading");
    loadPresetCatalog()
      .then((presets) => {
        if (cancelled) return;
        setCatalog(presets);
        setCatalogState("ready");
      })
      .catch(() => {
        if (!cancelled) setCatalogState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, catalogAttempt]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rank = (entry: PresetCatalogEntry) =>
      entry.verification?.status === "vendor" || entry.fidelity === "vendor" ? 2 : entry.curated ? 1 : 0;
    const ranked = [...catalog].sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name));
    return ranked
      .filter((entry) => !vendorOnly || rank(entry) === 2)
      .filter((entry) =>
        !needle || `${entry.name} ${entry.pack} ${entry.summary || ""}`.toLowerCase().includes(needle),
      )
      .slice(0, 30);
  }, [catalog, query, vendorOnly]);

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

  const importProgress = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await importSpec({
        kind: "spec",
        text: progressYaml,
        contentPath: contentPath.trim() || undefined,
        clientSource: clientSource.trim() || undefined,
        testData,
      });
      const mockSpec = result.mockSpec as { source?: { name?: string } } | undefined;
      if (!mockSpec) throw new Error("Import did not return a mock");
      const endpoint = await createEndpoint({
        name: mockSpec.source?.name || "Integration",
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
          <TabsList className="flex h-auto w-full flex-wrap">
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="sample">Sample JSON</TabsTrigger>
            <TabsTrigger value="spec">API spec</TabsTrigger>
            <TabsTrigger value="progress">In progress</TabsTrigger>
          </TabsList>
          <TabsContent value="catalog" className="space-y-3">
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => usePreset("akamai-waf-siem", "Akamai WAF SIEM")}
            >
              Start with Akamai WAF SIEM
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="preset-search" className="sr-only">Search integrations</Label>
              <Input
                id="preset-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Okta, CrowdStrike, Sentinel..."
                className="min-w-0 flex-1"
              />
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vendorOnly}
                  onChange={(event) => setVendorOnly(event.target.checked)}
                />
                From vendor docs
              </label>
            </div>
            <div className="max-h-80 overflow-y-auto rounded border">
              {matches.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left hover:bg-muted"
                  disabled={busy}
                  aria-label={`Use ${entry.name}`}
                  onClick={() => usePreset(entry.id, entry.name)}
                >
                  <span>
                    <span className="block text-sm font-medium">{entry.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.summary ? entry.summary.slice(0, 140) : entry.pack}
                    </span>
                  </span>
                  <TrustBadge
                    status={entry.verification?.status}
                    fidelity={entry.fidelity}
                    docUrl={entry.verification?.docUrl}
                  />
                </button>
              ))}
              {catalogState === "loading" && (
                <p className="p-3 text-sm text-muted-foreground">Loading the catalog…</p>
              )}
              {catalogState === "error" && (
                <div className="space-y-2 p-3">
                  <p className="text-sm text-destructive">Could not load the integration catalog.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      clearPresetCatalogCache();
                      setCatalogAttempt((attempt) => attempt + 1);
                    }}
                  >
                    Retry
                  </Button>
                </div>
              )}
              {catalogState === "ready" && matches.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No integrations match. Clear the search or turn off From vendor docs.
                </p>
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
              OpenAPI 3, Swagger 2, a Postman v2 collection, a WSDL, a sample XML document, a GraphQL schema (SDL or introspection JSON), or an XSOAR integration YAML. An integration YAML becomes one operation per command. URLs must be public https. A zip is read for its first text file and then mocked as a zip download.
            </p>
            <Label htmlFor="spec-text">Paste OpenAPI, WSDL, XML, or YAML</Label>
            <Textarea
              id="spec-text"
              value={specText}
              onChange={(event) => setSpecText(event.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder="Paste JSON, YAML, WSDL, or XML"
            />
            <Label htmlFor="spec-url">Or a public https URL</Label>
            <Input
              id="spec-url"
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
              <label className="flex max-w-full flex-col gap-1 text-sm">
                Upload a file
                <input
                  type="file"
                  accept=".json,.yaml,.yml,.xml,.wsdl,.zip,application/json,text/yaml,application/zip"
                  className="max-w-full text-sm"
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
          <TabsContent value="progress" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste the integration YAML, or give a demisto/content path such as Packs/HelloWorld/Integrations/HelloWorld. Add test_data JSON files or the Python client when you have them. Each command becomes one operation. A matching test_data file is the response. Otherwise the outputs context paths are the shape. The path is taken from the Python client when the command can be found.
            </p>
            <Label htmlFor="progress-yaml">Integration YAML</Label>
            <Textarea
              id="progress-yaml"
              value={progressYaml}
              onChange={(event) => setProgressYaml(event.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder="name: MyIntegration"
            />
            <Label htmlFor="content-path">Or a demisto/content path</Label>
            <Input
              id="content-path"
              value={contentPath}
              onChange={(event) => setContentPath(event.target.value)}
              placeholder="Packs/HelloWorld/Integrations/HelloWorld"
            />
            <Label htmlFor="client-source">Python client, if it is not in that path</Label>
            <Textarea
              id="client-source"
              value={clientSource}
              onChange={(event) => setClientSource(event.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder="def hello_world_command(client, args):"
            />
            <label className="flex max-w-full flex-col gap-1 text-sm">
              test_data JSON files
              <input
                type="file"
                accept=".json,application/json"
                multiple
                className="max-w-full text-sm"
                onChange={async (event) => {
                  const chosen = [...(event.target.files || [])].slice(0, 12);
                  const loaded: { name: string; text: string }[] = [];
                  for (const file of chosen) {
                    if (file.size > 100_000) continue;
                    loaded.push({ name: file.name, text: await file.text() });
                  }
                  setTestData(loaded);
                }}
              />
            </label>
            {testData.length > 0 && (
              <p className="text-xs text-muted-foreground">{testData.length} test_data file{testData.length === 1 ? "" : "s"} ready.</p>
            )}
            <Button
              disabled={busy || (!progressYaml.trim() && !contentPath.trim())}
              onClick={() =>
                importProgress()
              }
            >
              Build command mocks
            </Button>
          </TabsContent>
        </Tabs>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
