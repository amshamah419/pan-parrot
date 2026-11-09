import type { GenerateResult } from "./generate";
import type { MockBehavior, MockOperation, MockSpec } from "./mock-spec";

/** 2024-01-01T00:00:00Z. Fetch windows grow forward from the caller's since. */
export const FETCH_EPOCH = 1_704_067_200;

export interface StoredRecord {
  id: string;
  body: Record<string, unknown>;
}

export interface RuntimeState {
  records: StoredRecord[];
  seenIds: string[];
  scenarioIndex: number;
  fetchCursor?: string;
  /** Calls counted in the current rate-limit window. */
  rateCount?: number;
  /** Epoch ms when the current rate-limit window opened. */
  rateWindowStart?: number;
}

export function emptyRuntime(): RuntimeState {
  return { records: [], seenIds: [], scenarioIndex: 0 };
}

export function applyBehavior(input: {
  spec: MockSpec;
  operation: MockOperation;
  method: string;
  pathParams: Record<string, string>;
  query: Record<string, string>;
  bodyText: string;
  requestIndex: number;
  generated: GenerateResult;
  state: RuntimeState;
}): { result: GenerateResult; state: RuntimeState } {
  const behavior = input.spec.behavior;
  if (!behavior) return { result: input.generated, state: input.state };
  let result = input.generated;
  const effects = [...result.chaosEffects];
  const state = cloneState(input.state);

  if (behavior.state.enabled) {
    result = applyState(behavior, input, result, state, effects);
  }
  if (behavior.fetch.enabled && effects.includes("state-list")) {
    result = applyFetch(behavior, input, result, state, effects, "filter");
  } else if (
    behavior.fetch.enabled &&
    !effects.some((effect) => effect.startsWith("state-"))
  ) {
    result = applyFetch(behavior, input, result, state, effects, "synthesize");
  }
  if (behavior.scenario.enabled && behavior.scenario.steps.length > 0) {
    result = applyScenario(behavior, result, state, effects);
  }

  result = {
    ...result,
    chaosEffects: effects,
    headers: {
      ...result.headers,
      ...(effects.length ? { "x-pan-parrot-effects": effects.join(",") } : {}),
    },
  };
  return { result, state };
}

function applyState(
  behavior: MockBehavior,
  input: {
    operation: MockOperation;
    method: string;
    pathParams: Record<string, string>;
    bodyText: string;
    requestIndex: number;
    query: Record<string, string>;
  },
  generated: GenerateResult,
  state: RuntimeState,
  effects: string[],
): GenerateResult {
  const idField = behavior.state.idField;
  const verb = input.method.toUpperCase();
  const pathId = input.pathParams.id || input.pathParams[idField] || input.pathParams.sys_id;
  const incoming = parseObject(input.bodyText);
  if (verb === "POST") {
    const id = stringValue(incoming?.[idField]) || `rec_${input.requestIndex.toString(16).padStart(4, "0")}`;
    const body = { ...firstObject(generated.body), ...incoming, [idField]: id };
    if (behavior.fetch.enabled) {
      const cursor = parseTime(state.fetchCursor) ?? FETCH_EPOCH;
      body[behavior.fetch.timeField] = formatTime(cursor + 1, state.fetchCursor);
    }
    state.records.push({ id, body });
    trimRecords(state);
    effects.push("state-created");
    return { ...generated, status: 201, body: shapeLike(generated.body, [body], true), recordCount: 1 };
  }
  if (verb === "PUT" || verb === "PATCH") {
    const id = pathId || stringValue(incoming?.[idField]);
    const found = id ? state.records.find((record) => record.id === id) : undefined;
    if (!found) return missing(generated, id || "", effects);
    found.body = { ...found.body, ...incoming, [idField]: found.id };
    effects.push("state-updated");
    return { ...generated, status: 200, body: shapeLike(generated.body, [found.body], true), recordCount: 1 };
  }
  if (verb === "DELETE") {
    const id = pathId || "";
    const index = state.records.findIndex((record) => record.id === id);
    if (index < 0) return missing(generated, id, effects);
    const [removed] = state.records.splice(index, 1);
    effects.push("state-deleted");
    return { ...generated, status: 200, body: JSON.stringify({ deleted: true, [idField]: removed.id }), recordCount: 0 };
  }
  if (verb === "GET" && pathId) {
    const found = state.records.find((record) => record.id === pathId);
    if (!found) return missing(generated, pathId, effects);
    effects.push("state-read");
    return { ...generated, status: 200, body: shapeLike(generated.body, [found.body], true), recordCount: 1 };
  }
  if (verb === "GET" && state.records.length > 0) {
    effects.push("state-list");
    const bodies = state.records.map((record) => record.body);
    return { ...generated, status: 200, body: shapeLike(generated.body, bodies, false), recordCount: bodies.length };
  }
  return generated;
}

function applyFetch(
  behavior: MockBehavior,
  input: { query: Record<string, string> },
  generated: GenerateResult,
  state: RuntimeState,
  effects: string[],
  mode: "filter" | "synthesize",
): GenerateResult {
  const fetch = behavior.fetch;
  const sinceRaw = input.query[fetch.sinceParam] || input.query[fetch.firstFetchParam] || "";
  const since = parseTime(sinceRaw) ?? parseTime(state.fetchCursor) ?? FETCH_EPOCH;
  const windowEnd = since + fetch.windowSeconds;
  const sample = sinceRaw || state.fetchCursor;
  const fresh: Record<string, unknown>[] = [];
  if (mode === "filter") {
    for (const record of extractRecords(generated.body)) {
      const when = parseTime(stringValue(record[fetch.timeField]));
      if (when != null && (when <= since || when > windowEnd)) continue;
      const id = stringValue(record.id) || stringValue(record[behavior.state.idField]);
      if (fetch.dedup && id && state.seenIds.includes(id)) continue;
      fresh.push(record);
      if (id) state.seenIds.push(id);
    }
  } else {
    const existing = extractRecords(generated.body);
    const source = existing.length ? existing : [{ id: "evt" }];
    for (let index = 0; index < fetch.perPoll; index += 1) {
      const when = since + Math.floor(((index + 1) * fetch.windowSeconds) / (fetch.perPoll + 1));
      const base = { ...source[index % source.length] };
      const id = `evt_${windowEnd.toString(36)}_${index}`;
      base.id = id;
      if (fetch.timeField !== "id") base[fetch.timeField] = formatTime(when, sample);
      if (fetch.dedup && state.seenIds.includes(id)) continue;
      fresh.push(base);
      state.seenIds.push(id);
    }
  }
  trimSeen(state);
  if (fresh.length > 0) state.fetchCursor = formatTime(windowEnd, sample || state.fetchCursor);
  effects.push(fresh.length ? "fetch-new" : "fetch-empty");
  return {
    ...generated,
    body: shapeLike(generated.body, fresh, false),
    recordCount: fresh.length,
  };
}

function applyScenario(
  behavior: MockBehavior,
  generated: GenerateResult,
  state: RuntimeState,
  effects: string[],
): GenerateResult {
  const steps = behavior.scenario.steps;
  const index =
    behavior.scenario.repeat === "loop"
      ? state.scenarioIndex % steps.length
      : Math.min(state.scenarioIndex, steps.length - 1);
  const step = steps[index];
  state.scenarioIndex += 1;
  effects.push(`scenario-${index + 1}`);
  return {
    ...generated,
    status: step.status ?? generated.status,
    body: step.body ?? generated.body,
    recordCount: step.body ? 0 : generated.recordCount,
  };
}

function missing(generated: GenerateResult, id: string, effects: string[]): GenerateResult {
  effects.push("state-missing");
  return {
    ...generated,
    status: 404,
    body: JSON.stringify({ error: "No saved record", id }),
    recordCount: 0,
  };
}

function shapeLike(sample: string, records: unknown[], single: boolean): string {
  try {
    const parsed = JSON.parse(sample) as unknown;
    if (Array.isArray(parsed)) return JSON.stringify(single ? records.slice(0, 1) : records);
    if (parsed && typeof parsed === "object") {
      const key = Object.keys(parsed as Record<string, unknown>).find((name) =>
        Array.isArray((parsed as Record<string, unknown>)[name]),
      );
      if (key) {
        return JSON.stringify({
          ...(parsed as Record<string, unknown>),
          [key]: single ? records.slice(0, 1) : records,
        });
      }
    }
  } catch {
    return JSON.stringify(single ? records[0] : records);
  }
  return JSON.stringify(single ? records[0] : records);
}

function extractRecords(body: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(isRecord);
    if (parsed && typeof parsed === "object") {
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) return value.filter(isRecord);
      }
      if (isRecord(parsed)) return [parsed];
    }
  } catch {
    return [];
  }
  return [];
}

function firstObject(body: string): Record<string, unknown> {
  return extractRecords(body)[0] || {};
}

function parseObject(text: string): Record<string, unknown> | null {
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : "";
}

export function parseTime(value: string | undefined): number | null {
  if (!value) return null;
  if (/^\d{13}$/.test(value)) return Math.floor(Number(value) / 1000);
  if (/^\d{10}$/.test(value)) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

export function formatTime(epoch: number, sample: string | undefined): string {
  if (sample && /^\d{13}$/.test(sample)) return String(epoch * 1000);
  if (sample && /^\d{10}$/.test(sample)) return String(epoch);
  return new Date(epoch * 1000).toISOString().replace(".000Z", "Z");
}

function cloneState(state: RuntimeState): RuntimeState {
  return {
    records: state.records.map((record) => ({ id: record.id, body: { ...record.body } })),
    seenIds: state.seenIds.slice(),
    scenarioIndex: state.scenarioIndex,
    fetchCursor: state.fetchCursor,
    rateCount: state.rateCount,
    rateWindowStart: state.rateWindowStart,
  };
}

function trimRecords(state: RuntimeState) {
  if (state.records.length > 200) state.records.splice(0, state.records.length - 200);
}

function trimSeen(state: RuntimeState) {
  if (state.seenIds.length > 2_000) state.seenIds.splice(0, state.seenIds.length - 2_000);
}
