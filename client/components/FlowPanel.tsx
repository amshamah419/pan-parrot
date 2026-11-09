import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { defaultBehavior, type MockBehavior, type ScenarioStep } from "@shared/mock-spec";
import { MOCK_LIMITS } from "@shared/policy";
import { RecordCall } from "@/components/RecordCall";

export function FlowPanel({
  behavior,
  onChange,
  onReset,
}: {
  behavior: MockBehavior;
  onChange: (behavior: MockBehavior) => void;
  onReset: () => void;
}) {
  const flow = behavior || defaultBehavior();
  const addStep = (step: ScenarioStep) => {
    const steps = [...flow.scenario.steps, step].slice(0, MOCK_LIMITS.maxScenarioSteps);
    onChange({
      ...flow,
      scenario: { ...flow.scenario, enabled: true, steps },
    });
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The preview stays a sample. These options change what the catch URL returns, and they are saved with the mock.
      </p>
      <RecordCall stepCount={flow.scenario.steps.length} onAdd={addStep} />
      <section className="space-y-3 rounded border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Saved records</p>
            <p className="text-xs text-muted-foreground">POST stores a record. GET, PUT, and DELETE use that copy.</p>
          </div>
          <Switch
            checked={flow.state.enabled}
            onCheckedChange={(enabled) => onChange({ ...flow, state: { ...flow.state, enabled } })}
          />
        </div>
        {flow.state.enabled && (
          <Label className="text-xs">Id field
            <Input value={flow.state.idField} onChange={(event) => onChange({ ...flow, state: { ...flow.state, idField: event.target.value } })} />
          </Label>
        )}
      </section>
      <section className="space-y-3 rounded border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Call sequence</p>
            <p className="text-xs text-muted-foreground">Call 1 returns the first step, call 2 the next. After the last step, that response repeats.</p>
          </div>
          <Switch
            checked={flow.scenario.enabled}
            onCheckedChange={(enabled) =>
              onChange({
                ...flow,
                scenario: {
                  ...flow.scenario,
                  enabled,
                  steps: flow.scenario.steps.length ? flow.scenario.steps : [
                    { name: "Healthy", status: 200 },
                    { name: "Upstream down", status: 503, body: '{"error":"upstream unavailable"}' },
                  ],
                },
              })
            }
          />
        </div>
        {flow.scenario.enabled && flow.scenario.steps.map((step, index) => (
          <div key={`${step.name}-${index}`} className="grid gap-2 rounded bg-muted/40 p-2 sm:grid-cols-[1fr_6rem]">
            <Label className="text-xs">{step.name || `Call ${index + 1}`}
              <Textarea
                rows={2}
                className="mt-1 font-mono text-xs"
                placeholder="Leave empty to keep the generated body"
                value={step.body || ""}
                onChange={(event) => {
                  const steps = flow.scenario.steps.slice();
                  steps[index] = { ...step, body: event.target.value };
                  onChange({ ...flow, scenario: { ...flow.scenario, steps } });
                }}
              />
            </Label>
            <Label className="text-xs">Status
              <Input
                value={step.status ?? ""}
                onChange={(event) => {
                  const steps = flow.scenario.steps.slice();
                  const status = Number(event.target.value);
                  steps[index] = { ...step, status: Number.isFinite(status) ? status : undefined };
                  onChange({ ...flow, scenario: { ...flow.scenario, steps } });
                }}
              />
            </Label>
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Fetch over time</p>
            <p className="text-xs text-muted-foreground">Each poll after `since` or `first_fetch` reveals a new time window. The same since returns nothing once those ids were sent.</p>
          </div>
          <Switch
            checked={flow.fetch.enabled}
            onCheckedChange={(enabled) => onChange({ ...flow, fetch: { ...flow.fetch, enabled } })}
          />
        </div>
        {flow.fetch.enabled && (
          <div className="grid gap-2 sm:grid-cols-3">
            <Label className="text-xs">Since parameter
              <Input value={flow.fetch.sinceParam} onChange={(event) => onChange({ ...flow, fetch: { ...flow.fetch, sinceParam: event.target.value } })} />
            </Label>
            <Label className="text-xs">Seconds per poll
              <Input type="number" value={flow.fetch.windowSeconds} onChange={(event) => onChange({ ...flow, fetch: { ...flow.fetch, windowSeconds: Number(event.target.value) || 300 } })} />
            </Label>
            <Label className="text-xs">New records per poll
              <Input type="number" value={flow.fetch.perPoll} onChange={(event) => onChange({ ...flow, fetch: { ...flow.fetch, perPoll: Number(event.target.value) || 3 } })} />
            </Label>
          </div>
        )}
      </section>
      <Button type="button" variant="outline" onClick={onReset}>Reset saved calls</Button>
    </div>
  );
}
