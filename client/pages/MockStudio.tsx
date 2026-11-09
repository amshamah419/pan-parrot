import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getEndpoint, saveMockSpec } from "@/lib/api";
import { generateMockResponse, matchOperation } from "@shared/generate";
import {
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
    const matched = matchOperation(trial, operation.method, samplePath(operation));
    if (!matched) return "";
    const result = generateMockResponse({
      spec: trial,
      operation: matched.operation,
      pathParams: matched.pathParams,
      query: { limit: "2", [operation.pagination.limitParam]: "2" },
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

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Plug this into the integration server URL</p>
          <code className="text-sm">{url}</code>
          <h1 className="mt-2 text-2xl font-bold">{spec.source.name}</h1>
          <div className="mt-2 flex gap-2">
            <Badge>{spec.source.fidelity || spec.source.kind}</Badge>
            <Badge variant="secondary">{spec.operations.length} operations</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button onClick={save}>Save mock</Button>
        </div>
      </div>
      {(spec.source.notes || []).map((note) => (
        <p key={note} className="text-sm text-muted-foreground">{note}</p>
      ))}
      {(spec.source.unsupported || []).length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Not imported: {spec.source.unsupported?.join(" · ")}
        </div>
      )}
      <p className="text-sm">
        One response returns at most {MOCK_LIMITS.maxRecordsPerResponse} records and{" "}
        {Math.round(MOCK_LIMITS.maxResponseBytes / 1_000_000)} MB. Ask for more with pagination.
        The virtual catalog can hold {spec.totalRecords.toLocaleString()} unique records
        (ceiling {MOCK_LIMITS.maxVirtualRecords.toLocaleString()}).
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Label>Operation</Label>
          <select
            className="w-full rounded border bg-background px-2 py-2 text-sm"
            value={operation.id}
            onChange={(event) => setOperationId(event.target.value)}
          >
            {spec.operations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.method} {item.pathTemplate}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between">
            <Label htmlFor="advanced">Advanced JSON</Label>
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
              onChange={(record) => updateOperation({ ...operation, record })}
            />
          )}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Live preview</h2>
            <div className="flex items-center gap-2 text-sm">
              <span>Show chaos</span>
              <Switch checked={previewChaos} onCheckedChange={setPreviewChaos} />
            </div>
          </div>
          <pre className="max-h-[28rem] overflow-auto rounded border p-3 text-xs whitespace-pre-wrap break-all">
            {preview}
          </pre>
          <ChaosEditor
            chaos={spec.chaos}
            totalRecords={spec.totalRecords}
            onChange={(chaos, totalRecords) => setSpec({ ...spec, chaos, totalRecords })}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-700">{saved}</p>}
    </div>
  );
}

function samplePath(operation: MockOperation): string {
  return operation.pathTemplate.replace(/\{[^}]+\}/g, "50170");
}

function FieldEditor({
  field,
  onChange,
}: {
  field: FieldSpec;
  onChange: (field: FieldSpec) => void;
}) {
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
      {field.kind === "string" && (
        <Input
          value={field.example || ""}
          onChange={(event) => onChange({ ...field, example: event.target.value })}
          placeholder="example value (ids and times are still generated)"
        />
      )}
      {field.kind === "object" && (
        <div className="space-y-2 pl-3">
          {(field.children || []).map((child, index) => (
            <div key={`${child.name}-${index}`}>
              <FieldEditor
                field={child}
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
          ["malformedJson", "Break the JSON"],
          ["wrongContentType", "Send text/html"],
          ["randomErrors", "429 / 500 / 503 with Retry-After"],
          ["latency", "Add about 2 seconds"],
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
