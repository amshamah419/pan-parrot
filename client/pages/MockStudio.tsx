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
import { CollabPanel } from "@/components/CollabPanel";
import { generateMockResponse, matchOperation } from "@shared/generate";
import {
  defaultAuth,
  defaultBehavior,
  FIELD_KINDS,
  validateMockSpec,
  type ChaosSpec,
  type FieldKind,
  type FieldSpec,
  type MockOperation,
  type MockSpec,
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

  useEffect(() => {
    getEndpoint(endpointId)
      .then((endpoint) => {
        setUrl(endpoint.url);
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
      setSaved("Copied.");
    } catch {
      setSaved("Select the URL and copy it.");
    }
  };

  return (
    <div className="container space-y-6 py-6">
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
        <p className="mt-4 text-sm font-medium">2. Hit it once to see a page of records</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-xs">{tryUrl}</code>
          <Button variant="outline" onClick={() => copy(tryUrl)}>Copy try URL</Button>
        </div>
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
      </div>

      <Tabs defaultValue="preview">
        <TabsList className="flex h-auto flex-wrap">
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
        <TabsContent value="chaos">
          <ChaosEditor
            chaos={spec.chaos}
            totalRecords={spec.totalRecords}
            onChange={(chaos, totalRecords) => setSpec({ ...spec, chaos, totalRecords })}
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
          <Label className="text-xs">Query rules, one key=value per line
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="text-xs">Body path, JSONPath or XPath
              <Input
                placeholder="$.status or /response/@status"
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
      {saved && <p className="text-sm text-green-700">{saved}</p>}
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
  const params = new URLSearchParams();
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
        <Label>Flaky behavior</Label>
        <Switch checked={chaos.enabled} onCheckedChange={(value) => toggle("enabled", value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
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
            value={totalRecords}
            onChange={(event) => onChange(chaos, Number(event.target.value) || 1)}
          />
        </Label>
      </div>
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
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between text-sm">
          <span>{label}</span>
          <Switch checked={Boolean(chaos[key])} onCheckedChange={(value) => toggle(key, value)} />
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
