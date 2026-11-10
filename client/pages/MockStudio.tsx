import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrustBadge } from "@/components/TrustBadge";
import { MockAuthPanel } from "@/components/MockAuthPanel";
import { FlowPanel } from "@/components/FlowPanel";
import { PushPanel } from "@/components/PushPanel";
import { getEndpoint, resetRuntime, saveMockSpec } from "@/lib/api";
import { sampleRequest } from "@/lib/sample-call";
import { CollabPanel } from "@/components/CollabPanel";
import { CommandCoveragePanel } from "@/components/CommandCoverage";
import { InstanceGuidePanel } from "@/components/InstanceGuide";
import { FixturePanel } from "@/components/FixturePanel";
import { generateMockResponse, matchOperation } from "@shared/generate";
import { applyVendorPagination, type VendorPageStyle } from "@shared/pagination";
import {
  defaultAuth,
  defaultBehavior,
  defaultRateLimit,
  FIELD_KINDS,
  validateMockSpec,
  type ChaosSpec,
  type FieldKind,
  type FieldSpec,
  type MockOperation,
  type MockSpec,
  type RateQuota,
} from "@shared/mock-spec";
import { MOCK_LIMITS } from "@shared/policy";

export default function MockStudio() {
  const { endpointId = "" } = useParams();
  const [spec, setSpec] = useState<MockSpec | null>(null);
  const [url, setUrl] = useState("");
  const [access, setAccess] = useState<"owner" | "edit" | "view">("owner");
  const [published, setPublishedFlag] = useState(false);
  const [operationId, setOperationId] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [advancedText, setAdvancedText] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [previewChaos, setPreviewChaos] = useState(false);
  const [studioTab, setStudioTab] = useState("preview");
  const [sampleNote, setSampleNote] = useState("");
  const [locked, setLocked] = useState(false);
  const [lockToken, setLockToken] = useState("");
  const [notifyFirstCatch, setNotifyFirstCatch] = useState(false);

  useEffect(() => {
    getEndpoint(endpointId)
      .then((endpoint) => {
        setUrl(endpoint.url);
        setLocked(Boolean(endpoint.locked));
        setNotifyFirstCatch(Boolean(endpoint.notifyFirstCatch));
        setAccess(endpoint.access || "owner");
        setPublishedFlag(Boolean(endpoint.published));
        if (!endpoint.mockSpec) {
          setError("This endpoint has no generated mock yet.");
          return;
        }
        const validated = validateMockSpec(endpoint.mockSpec);
        setSpec(validated);
        setOperationId(validated.operations[0]?.id || "");
        setAdvancedText(JSON.stringify(validated, null, 2));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [endpointId]);

  const operation = spec?.operations.find((item) => item.id === operationId) || spec?.operations[0];
  const preview = useMemo(() => {
    if (!spec || !operation) return "";
    const trial: MockSpec = previewChaos
      ? spec
      : { ...spec, chaos: { ...spec.chaos, enabled: false } };
    const matched = matchOperation(trial, operation.method, samplePath(operation), {
      ...(operation.queryMatch || {}),
    });
    if (!matched) return "";
    const result = generateMockResponse({
      spec: trial,
      operation: matched.operation,
      pathParams: matched.pathParams,
      query: {
        limit: "2",
        [operation.pagination.limitParam]: "2",
        ...(operation.queryMatch || {}),
      },
      requestIndex: previewChaos ? trial.chaos.everyNth : 1,
      body: operation.envelope.type === "graphql" ? (trial.graphql?.exampleQuery || "query { __typename }") : undefined,
    });
    return result.body.slice(0, 4000);
  }, [spec, operation, previewChaos]);

  const updateOperation = (next: MockOperation) => {
    if (!spec) return;
    setSpec({
      ...spec,
      operations: spec.operations.map((item) => (item.id === next.id ? next : item)),
    });
  };

  const save = async () => {
    if (!spec) return;
    setError("");
    setSaved("");
    try {
      const validated = advanced ? validateMockSpec(JSON.parse(advancedText)) : validateMockSpec(spec);
      await saveMockSpec(endpointId, validated);
      setSpec(validated);
      setSaved("Saved. The catch URL is live.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  if (!spec || !operation) {
    return (
      <div className="container py-8">
        <p className="text-sm text-destructive">{error || "Loading…"}</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/dashboard">Back</Link>
        </Button>
      </div>
    );
  }

  const tryUrl = buildTryUrl(url, operation, spec.auth);
  const verification = spec.source.verification;
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSaved(value === url ? "Copied the catch URL." : "Copied the try URL.");
    } catch {
      setSaved("Select the URL and copy it.");
    }
  };

  return (
    <div className="container min-w-0 space-y-6 overflow-x-hidden py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/dashboard" className="underline">Mocks</Link>
          </p>
          <h1 className="text-2xl font-bold">{spec.source.name}</h1>
        </div>
        <div className="flex gap-2">
          <TrustBadge status={verification?.status} fidelity={spec.source.fidelity} />
          <Button variant="outline" asChild>
            <a href={`/api/endpoints/${endpointId}/export?format=zip`}>Export pytest</a>
          </Button>
          {access === "view" ? (
            <p className="self-center text-sm text-muted-foreground">View only</p>
          ) : (
            <Button onClick={save}>Save</Button>
          )}
        </div>
      </div>

      <CollabPanel
        endpointId={endpointId}
        access={access}
        published={published}
        onPublished={setPublishedFlag}
        onReverted={() => window.location.reload()}
      />

      <section className="rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">1. Paste this into the integration server URL</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-sm">{url}</code>
          <Button variant="outline" onClick={() => copy(url)}>Copy URL</Button>
        </div>
        {access !== "view" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span>{locked ? "Catch URL is locked." : "Catch URL is open to anyone who has the path."}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void fetch(`/api/endpoints/${endpointId}/lock`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ enabled: !locked }),
                })
                  .then(async (response) => {
                    const data = (await response.json()) as { lockToken?: string; error?: string };
                    if (!response.ok) throw new Error(data.error || "Could not update the lock");
                    setLocked(!locked);
                    setLockToken(data.lockToken || "");
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : "Could not update the lock"));
              }}
            >
              {locked ? "Remove lock" : "Lock this catch URL"}
            </Button>
            {lockToken && <code className="break-all">Lock token, shown once: {lockToken}</code>}
          </div>
        )}
        {access === "owner" && (
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span>Email me when this catch URL gets its first call. The note names the mock and leaves out the request.</span>
            <Switch
              checked={notifyFirstCatch}
              aria-label="Email me on the first call"
              onCheckedChange={(value) => {
                void fetch(`/api/endpoints/${endpointId}/notify`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ enabled: value }),
                })
                  .then(async (response) => {
                    if (!response.ok) throw new Error("Could not update the first-call email");
                    setNotifyFirstCatch(value);
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : "Could not update the first-call email"));
              }}
            />
          </div>
        )}
        <p className="mt-4 text-sm font-medium">2. Hit it once to see a page of records</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-xs">{tryUrl}</code>
          <Button variant="outline" onClick={() => copy(tryUrl)}>Copy try URL</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSampleNote("");
              const target = new URL(tryUrl, window.location.origin);
              const sameOrigin = `${target.pathname}${target.search}`;
              const sample = sampleRequest(operation, spec.auth);
              void fetch(sameOrigin, sample)
                .then(async (response) => {
                  const count = response.headers.get("x-pan-parrot-records");
                  setSampleNote(
                    `${response.status}${count ? ` · ${count} records` : ""}${response.ok ? "" : ". The call was rejected."}`,
                  );
                })
                .catch(() => setSampleNote("The sample call did not reach the catch URL."));
            }}
          >
            Send a sample call
          </Button>
        </div>
        {spec.auth.mode === "edgegrid" && spec.auth.edgegrid?.verify !== "format-only" && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p>
              A plain visit is rejected. This mock checks an EdgeGrid signature, which changes every request. Accept the header shape to curl it while you page through records. Turn the signature check back on from the Auth tab when the integration should sign for real.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={() =>
                setSpec({
                  ...spec,
                  auth: {
                    ...spec.auth,
                    edgegrid: { ...spec.auth.edgegrid!, verify: "format-only" },
                  },
                })
              }
            >
              Accept the header shape for local curls
            </Button>
          </div>
        )}
        {sampleNote && <p className="mt-2 text-sm">{sampleNote}</p>}
        {saved.startsWith("Copied") && (
          <p className="mt-2 text-sm text-green-700" role="status">{saved}</p>
        )}
        <nav aria-label="On this mock" className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["chaos", "Chaos and load test"],
              ["auth", "Auth"],
              ["flow", "Flow"],
              ["push", "Push"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setStudioTab(id);
                document.getElementById("mock-work")?.scrollIntoView({ block: "start" });
              }}
            >
              {label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => document.getElementById("fixtures-heading")?.scrollIntoView({ block: "start" })}
          >
            Export fixtures
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => document.getElementById("collab-heading")?.scrollIntoView({ block: "start" })}
          >
            Share
          </Button>
        </nav>
        <p className="mt-3 text-xs text-muted-foreground">
          A page holds at most {MOCK_LIMITS.maxRecordsPerResponse} records and{" "}
          {Math.round(MOCK_LIMITS.maxResponseBytes / 1_000_000)} MB. Streamed NDJSON and file downloads can grow to{" "}
          {Math.round(MOCK_LIMITS.maxDownloadBytes / 1_000_000)} MB, which is Netlify's buffered response limit.
          Netlify can stream 20 MB, and the function stops at 60 seconds, so this mock stops at 6 MB.
          This catalog has {spec.totalRecords.toLocaleString()} unique records.
          {spec.auth && spec.auth.mode !== "none" && spec.auth.mode !== "panos-key" && spec.auth.mode !== "api-key"
            ? " This mock checks dummy credentials. A plain browser visit will be rejected until the integration sends them."
            : ""}
          {operation.pack ? ` The response is a ${operation.pack.format} file named ${operation.pack.filename}.` : ""}
        </p>
      </section>

      <CommandCoveragePanel spec={spec} catchUrl={url} onChange={setSpec} />
      <InstanceGuidePanel spec={spec} catchUrl={url} />
      <FixturePanel endpointId={endpointId} spec={spec} catchUrl={url} />

      {verification && (
        <section className="rounded-lg border p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">How this mock was checked</p>
            {verification.docUrl && (
              <a className="underline" href={verification.docUrl} target="_blank" rel="noreferrer">
                Vendor docs
              </a>
            )}
          </div>
          {verification.checkedAt && (
            <p className="mt-1 text-muted-foreground">Checked {verification.checkedAt}</p>
          )}
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {(verification.differences || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {(spec.source.unsupported || []).length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Not imported: {spec.source.unsupported?.join(" · ")}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label className="text-xs">
          Operation
          <select
            className="mt-1 block rounded border bg-background px-2 py-2 text-sm"
            value={operation.id}
            onChange={(event) => setOperationId(event.target.value)}
          >
            {spec.operations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.method} {item.pathTemplate}
                {item.fallback ? " · fallback" : ""}
                {item.priority ? ` · priority ${item.priority}` : ""}
              </option>
            ))}
          </select>
        </Label>
        <Label className="text-xs">
          Pagination
          <select
            aria-label="Pagination style"
            className="mt-1 block rounded border bg-background px-2 py-2 text-sm"
            value={operation.pagination.style === "header" ? "cursor" : operation.pagination.style}
            onChange={(event) =>
              updateOperation(applyVendorPagination(operation, event.target.value as VendorPageStyle))
            }
          >
            <option value="none">Single page</option>
            <option value="offset">Offset and limit</option>
            <option value="page">Page number</option>
            <option value="cursor">Cursor / next token</option>
            <option value="link">Link header</option>
            <option value="akamai">Akamai offset line</option>
          </select>
        </Label>
      </div>

      <Tabs value={studioTab} onValueChange={setStudioTab}>
        <TabsList id="mock-work" className="flex h-auto flex-wrap">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="shape">Shape</TabsTrigger>
          <TabsTrigger value="chaos">Chaos</TabsTrigger>
          <TabsTrigger value="match">Match</TabsTrigger>
          <TabsTrigger value="flow">Flow</TabsTrigger>
          <TabsTrigger value="push">Push</TabsTrigger>
          <TabsTrigger value="auth">Auth</TabsTrigger>
        </TabsList>
        <TabsContent value="preview" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <span>Stream NDJSON</span>
                <Switch
                  checked={Boolean(operation.stream)}
                  onCheckedChange={(stream) => updateOperation({ ...operation, stream })}
                />
              </label>
              <Label className="text-xs">
                Download bytes, 0 for a normal page
                <Input
                  type="number"
                  min={0}
                  max={MOCK_LIMITS.maxDownloadBytes}
                  value={operation.downloadBytes || 0}
                  onChange={(event) =>
                    updateOperation({
                      ...operation,
                      downloadBytes: Math.min(MOCK_LIMITS.maxDownloadBytes, Math.max(0, Number(event.target.value) || 0)),
                    })
                  }
                />
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <span>Show chaos</span>
              <Switch checked={previewChaos} onCheckedChange={setPreviewChaos} />
            </div>
          </div>
          <pre className="max-h-[32rem] overflow-auto rounded border bg-muted/40 p-3 text-xs whitespace-pre-wrap break-all">
            {preview}
          </pre>
        </TabsContent>
        <TabsContent value="shape" className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded border px-3 py-2">
            <div>
              <p className="text-sm font-medium">GraphQL</p>
              <p className="text-xs text-muted-foreground">Paste SDL or introspection JSON. Queries are answered from the selection set. first and after page a connection.</p>
            </div>
            <Switch
              aria-label="GraphQL endpoint"
              checked={operation.envelope.type === "graphql"}
              onCheckedChange={(on) => {
                const operations = spec.operations.map((item) =>
                  item.id === operation.id
                    ? { ...item, envelope: on ? ({ type: "graphql" } as const) : ({ type: "object" } as const), list: on ? false : item.list }
                    : item,
                );
                setSpec({
                  ...spec,
                  operations,
                  graphql: on ? spec.graphql || { schema: "", exampleQuery: "query { __typename }" } : spec.graphql,
                });
              }}
            />
          </div>
          {operation.envelope.type === "graphql" && (
            <div className="space-y-3">
              <Label className="text-xs">Schema
                <Textarea
                  aria-label="GraphQL schema"
                  rows={8}
                  className="font-mono text-xs"
                  placeholder="type Query { issues(first: Int, after: String): IssueConnection }"
                  value={spec.graphql?.schema || ""}
                  onChange={(event) => setSpec({ ...spec, graphql: { schema: event.target.value, exampleQuery: spec.graphql?.exampleQuery } })}
                />
              </Label>
              <Label className="text-xs">Example query, shown in the preview
                <Textarea
                  aria-label="Example GraphQL query"
                  rows={4}
                  className="font-mono text-xs"
                  value={spec.graphql?.exampleQuery || ""}
                  onChange={(event) => setSpec({ ...spec, graphql: { schema: spec.graphql?.schema || "", exampleQuery: event.target.value } })}
                />
              </Label>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="advanced">Edit the raw spec</Label>
            <Switch id="advanced" checked={advanced} onCheckedChange={setAdvanced} />
          </div>
          {advanced ? (
            <Textarea
              value={advancedText}
              onChange={(event) => setAdvancedText(event.target.value)}
              rows={18}
              className="font-mono text-xs"
            />
          ) : (
            <FieldEditor
              field={operation.record}
              xmlMode={operation.envelope.type === "xml" || operation.envelope.type === "soap" || operation.contentType.includes("xml")}
              onChange={(record) => updateOperation({ ...operation, record })}
            />
          )}
        </TabsContent>
        <TabsContent value="chaos" className="space-y-3">
          <ChaosEditor
            chaos={spec.chaos}
            totalRecords={spec.totalRecords}
            onChange={(chaos, totalRecords) => setSpec({ ...spec, chaos, totalRecords })}
          />
          <FetchBackoff
            quota={spec.rateLimit ?? defaultRateLimit()}
            onChange={(rateLimit) => setSpec({ ...spec, rateLimit })}
          />
        </TabsContent>
        <TabsContent value="match" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              This operation is chosen when the method and path match, and these rules match too. A higher priority wins. If nothing stricter matches, the operation marked as the fallback answers.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const id = `rule-${Date.now().toString(36)}`;
                const clone: MockOperation = {
                  ...operation,
                  id,
                  priority: (operation.priority || 0) + 1,
                  fallback: false,
                  headerMatch: undefined,
                  bodyMatch: undefined,
                  queryMatch: undefined,
                  graphqlOperation: undefined,
                };
                setSpec({ ...spec, operations: [...spec.operations, clone] });
                setOperationId(id);
                setSaved("");
              }}
            >
              Add a rule for this path
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="text-xs">Priority
              <Input
                type="number"
                value={operation.priority ?? 0}
                onChange={(event) => updateOperation({ ...operation, priority: Number(event.target.value) || 0 })}
              />
            </Label>
            <div className="flex items-center justify-between rounded border px-3">
              <span className="text-sm">Fallback if nothing else matches</span>
              <Switch
                checked={Boolean(operation.fallback)}
                onCheckedChange={(fallback) => updateOperation({ ...operation, fallback })}
              />
            </div>
          </div>
          <Label className="text-xs">Query rules, one key=value per line. A form body field counts the same way.
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={pairsToText(operation.queryMatch)}
              onChange={(event) => updateOperation({ ...operation, queryMatch: textToPairs(event.target.value) })}
            />
          </Label>
          <Label className="text-xs">Header rules, one name=value per line. Leave the value empty to require only the header.
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={pairsToText(operation.headerMatch)}
              onChange={(event) => updateOperation({ ...operation, headerMatch: textToPairs(event.target.value) })}
            />
          </Label>
          <Label className="text-xs">GraphQL operation name
            <Input
              aria-label="GraphQL operation name"
              placeholder="IssuesTable"
              value={operation.graphqlOperation || ""}
              onChange={(event) => updateOperation({ ...operation, graphqlOperation: event.target.value || undefined })}
            />
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="text-xs">Body path. JSONPath can use [*], ..name, and one [?(@.field=="value")]. XPath can use [2], [@attr="value"], and [text()="value"].
              <Input
                aria-label="Body path"
                placeholder='$.items[*].id or /response/item[@id="a"]'
                value={operation.bodyMatch?.path || ""}
                onChange={(event) =>
                  updateOperation({
                    ...operation,
                    bodyMatch: event.target.value
                      ? { path: event.target.value, equals: operation.bodyMatch?.equals }
                      : undefined,
                  })
                }
              />
            </Label>
            <Label className="text-xs">Body value
              <Input
                placeholder="closed"
                value={operation.bodyMatch?.equals || ""}
                onChange={(event) =>
                  updateOperation({
                    ...operation,
                    bodyMatch: operation.bodyMatch?.path
                      ? { path: operation.bodyMatch.path, equals: event.target.value }
                      : undefined,
                  })
                }
              />
            </Label>
          </div>
        </TabsContent>
        <TabsContent value="flow">
          <FlowPanel
            behavior={spec.behavior || defaultBehavior()}
            onChange={(behavior) => setSpec({ ...spec, behavior })}
            onReset={() => {
              void resetRuntime(endpointId).then(() => setSaved("Saved calls cleared.")).catch((err) => {
                setError(err instanceof Error ? err.message : "Could not reset");
              });
            }}
          />
        </TabsContent>
        <TabsContent value="push">
          <PushPanel
            endpointId={endpointId}
            spec={spec}
            onChange={(push) => setSpec({ ...spec, push })}
          />
        </TabsContent>
        <TabsContent value="auth">
          <MockAuthPanel
            auth={spec.auth || defaultAuth()}
            onChange={(auth) => setSpec({ ...spec, auth })}
          />
        </TabsContent>
      </Tabs>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !saved.startsWith("Copied") && (
        <p className="text-sm text-green-700" role="status">{saved}</p>
      )}
    </div>
  );
}

function buildTryUrl(url: string, operation: MockOperation, auth: MockSpec["auth"]): string {
  const base = `${url.replace(/\/$/, "")}${samplePath(operation)}`;
  if (auth?.mode === "panos-key" && auth.panos) {
    const params = new URLSearchParams(operation.queryMatch || { type: "op" });
    if (params.get("type") === "keygen") {
      params.set("user", auth.panos.username);
      params.set("password", auth.panos.password);
    } else {
      params.set("key", auth.panos.apiKey);
    }
    return `${url.replace(/\/$/, "")}/api?${params.toString()}`;
  }
  const params = new URLSearchParams(operation.queryMatch || {});
  if (operation.pagination.style !== "none") params.set(operation.pagination.limitParam, "2");
  if (auth?.mode === "api-key" && auth.apiKey?.in === "query") {
    params.set(auth.apiKey.name, auth.apiKey.value);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function pairsToText(pairs: Record<string, string> | undefined): string {
  return Object.entries(pairs || {}).map(([key, value]) => `${key}=${value}`).join("\n");
}

function textToPairs(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const index = line.indexOf("=");
    const key = (index === -1 ? line : line.slice(0, index)).trim();
    const value = index === -1 ? "" : line.slice(index + 1).trim();
    if (key) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function samplePath(operation: MockOperation): string {
  return operation.pathTemplate.replace(/\{[^}]+\}/g, "50170");
}

function FieldEditor({
  field,
  onChange,
  depth = 0,
  xmlMode = false,
}: {
  field: FieldSpec;
  onChange: (field: FieldSpec) => void;
  depth?: number;
  xmlMode?: boolean;
}) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <div className="space-y-2 rounded border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={field.name}
          onChange={(event) => onChange({ ...field, name: event.target.value })}
          className="h-8 max-w-[12rem]"
        />
        <select
          className="rounded border bg-background px-2 py-1 text-sm"
          value={field.kind}
          onChange={(event) =>
            onChange({
              ...field,
              kind: event.target.value as FieldKind,
              children: event.target.value === "object" ? field.children || [] : field.children,
              enumValues: event.target.value === "enum" ? field.enumValues || ["a", "b"] : field.enumValues,
            })
          }
        >
          {FIELD_KINDS.map((kind) => (
            <option key={kind} value={kind}>{kind}</option>
          ))}
        </select>
        {field.kind === "timestamp" && (
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            value={field.format || "iso"}
            onChange={(event) =>
              onChange({ ...field, format: event.target.value as FieldSpec["format"] })
            }
          >
            <option value="iso">iso</option>
            <option value="unix">unix</option>
            <option value="unix-ms">unix ms</option>
            <option value="unix-string">unix string</option>
          </select>
        )}
      </div>
      {field.kind === "enum" && (
        <Input
          value={(field.enumValues || []).join(", ")}
          onChange={(event) =>
            onChange({
              ...field,
              enumValues: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
            })
          }
          placeholder="comma-separated values"
        />
      )}
        {xmlMode && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={Boolean(field.xml?.attribute)}
              onChange={(event) =>
                onChange({
                  ...field,
                  xml: { ...field.xml, attribute: event.target.checked },
                })
              }
            />
            XML attribute
          </label>
        )}
        {field.kind === "const" && (
          <Input
            value={String(field.constValue ?? "")}
            onChange={(event) => onChange({ ...field, constValue: event.target.value })}
            placeholder="constant value"
          />
        )}
        {field.kind === "string" && (
        <Input
          value={field.example || ""}
          onChange={(event) => onChange({ ...field, example: event.target.value })}
          placeholder="example value (ids and times are still generated)"
        />
      )}
      {field.kind === "object" && (
        <div className="space-y-2 pl-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide" : "Show"} {field.children?.length || 0} nested fields
          </Button>
          {open && (field.children || []).map((child, index) => (
            <div key={`${child.name}-${index}`}>
              <FieldEditor
                field={child}
                depth={depth + 1}
                xmlMode={xmlMode}
                onChange={(next) => {
                  const children = field.children?.slice() || [];
                  children[index] = next;
                  onChange({ ...field, children });
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...field,
                    children: field.children?.filter((_, childIndex) => childIndex !== index),
                  })
                }
              >
                Remove {child.name}
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...field,
                children: [...(field.children || []), { name: "field", kind: "string" }],
              })
            }
          >
            Add field
          </Button>
        </div>
      )}
    </div>
  );
}

function FetchBackoff({
  quota,
  onChange,
}: {
  quota: RateQuota;
  onChange: (quota: RateQuota) => void;
}) {
  const setNumber = (key: "limit" | "windowSeconds" | "retryAfterSeconds", value: string) =>
    onChange({ ...quota, [key]: Number(value) || 0 });
  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="fetch-backoff">Fetch backoff</Label>
          <p className="text-xs text-muted-foreground">
            After this many calls in the window, the catch URL returns 429 with Retry-After and X-RateLimit-Limit, Remaining, and Reset. Reset is the unix time the window ends. This is separate from the random 429 switch above.
          </p>
        </div>
        <Switch
          id="fetch-backoff"
          checked={quota.enabled}
          onCheckedChange={(enabled) => onChange({ ...quota, enabled })}
          aria-label="Fetch backoff"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Label className="text-xs">
          Calls before 429
          <Input
            aria-label="Calls before 429"
            type="number"
            min={1}
            max={10000}
            value={quota.limit}
            onChange={(event) => setNumber("limit", event.target.value)}
          />
        </Label>
        <Label className="text-xs">
          Window seconds
          <Input
            aria-label="Window seconds"
            type="number"
            min={1}
            max={3600}
            value={quota.windowSeconds}
            onChange={(event) => setNumber("windowSeconds", event.target.value)}
          />
        </Label>
        <Label className="text-xs">
          Retry-After seconds
          <Input
            aria-label="Retry-After seconds"
            type="number"
            min={0}
            max={3600}
            value={quota.retryAfterSeconds}
            onChange={(event) => setNumber("retryAfterSeconds", event.target.value)}
          />
        </Label>
      </div>
    </div>
  );
}

function ChaosEditor({
  chaos,
  totalRecords,
  onChange,
}: {
  chaos: ChaosSpec;
  totalRecords: number;
  onChange: (chaos: ChaosSpec, totalRecords: number) => void;
}) {
  const toggle = (key: keyof ChaosSpec, value: boolean) =>
    onChange({ ...chaos, [key]: value }, totalRecords);
  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="flaky-behavior">Flaky behavior</Label>
        <Switch id="flaky-behavior" aria-label="Flaky behavior" checked={chaos.enabled} onCheckedChange={(value) => toggle("enabled", value)} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Label className="text-xs">
          Seed
          <Input
            value={chaos.seed}
            onChange={(event) => onChange({ ...chaos, seed: event.target.value }, totalRecords)}
          />
        </Label>
        <Label className="text-xs">
          Virtual records
          <Input
            type="number"
            aria-label="Virtual records"
            value={totalRecords}
            onChange={(event) => onChange(chaos, Number(event.target.value) || 1)}
          />
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        This is the catalog a load test walks, up to 20,000. One response still returns at most 500 records. Use the pagination control to page through the rest.
      </p>
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          className={chaos.mode === "probability" ? "font-medium underline" : ""}
          onClick={() => onChange({ ...chaos, mode: "probability" }, totalRecords)}
        >
          Probability
        </button>
        <button
          type="button"
          className={chaos.mode === "every-nth" ? "font-medium underline" : ""}
          onClick={() => onChange({ ...chaos, mode: "every-nth" }, totalRecords)}
        >
          Every Nth
        </button>
      </div>
      {chaos.mode === "probability" ? (
        <Label className="text-xs">
          Probability ({chaos.probability})
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={chaos.probability}
            onChange={(event) =>
              onChange({ ...chaos, probability: Number(event.target.value) }, totalRecords)
            }
          />
        </Label>
      ) : (
        <Label className="text-xs">
          Every Nth request
          <Input
            type="number"
            min={1}
            value={chaos.everyNth}
            onChange={(event) =>
              onChange({ ...chaos, everyNth: Number(event.target.value) || 1 }, totalRecords)
            }
          />
        </Label>
      )}
      {(
        [
          ["duplicateRecords", "Duplicate a record"],
          ["missingFields", "Drop timestamps"],
          ["mixedTimestamps", "Mix timestamp formats and zones"],
          ["outOfOrder", "Reverse the page"],
          ["wrongTypes", "Null out some fields"],
          ["truncatedJson", "Cut the body short"],
          ["slowDrip", "Slow drip"],
          ["partial", "Partial response"],
          ["malformedJson", "Break the JSON"],
          ["wrongContentType", "Send text/html"],
          ["randomErrors", "429 / 500 / 503 with Retry-After"],
          ["latency", "Add about 2 seconds"],
          ["malformedXml", "Break the XML"],
          ["wrongNamespace", "Wrong XML namespace"],
          ["soapFault", "SOAP fault"],
          ["authExpired", "Expire the token"],
          ["authDenied", "Random 401 / 403"],
          ["authTokenFailure", "Fail the token endpoint"],
          ["authClockSkew", "Reject clock skew"],
          ["graphqlErrors", "GraphQL error in the body"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between text-sm">
          <span id={`chaos-${key}`}>{label}</span>
          <Switch aria-labelledby={`chaos-${key}`} checked={Boolean(chaos[key])} onCheckedChange={(value) => toggle(key, value)} />
        </div>
      ))}
      <Label className="text-xs">
        Pagination glitch
        <select
          className="mt-1 w-full rounded border bg-background px-2 py-1"
          value={chaos.paginationGlitch}
          onChange={(event) =>
            onChange(
              { ...chaos, paginationGlitch: event.target.value as ChaosSpec["paginationGlitch"] },
              totalRecords,
            )
          }
        >
          <option value="none">None</option>
          <option value="repeat">Repeat the same page</option>
          <option value="skip">Skip a page</option>
          <option value="endless">Cursor never ends</option>
        </select>
      </Label>
      <p className="text-xs text-muted-foreground">
        The same seed and request number reproduce the same glitch. The request log shows both.
        Record ids stay unique across pages unless duplicate records is on.
      </p>
    </div>
  );
}
