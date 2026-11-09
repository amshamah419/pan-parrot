import { describe, expect, it } from "vitest";
import { applyBehavior, emptyRuntime, FETCH_EPOCH, formatTime } from "./behavior";
import { defaultBehavior, defaultChaos, defaultPagination, type MockSpec } from "./mock-spec";
import type { GenerateResult } from "./generate";

function spec(behavior: MockSpec["behavior"]): MockSpec {
  return {
    version: 1,
    source: { kind: "manual", name: "Incidents" },
    operations: [
      {
        id: "list",
        method: "GET",
        pathTemplate: "/incidents",
        status: 200,
        contentType: "application/json",
        headers: {},
        list: true,
        envelope: { type: "array" },
        pagination: defaultPagination(),
        record: { name: "incident", kind: "object", children: [{ name: "id", kind: "id" }] },
      },
    ],
    chaos: defaultChaos(),
    totalRecords: 10,
    behavior,
  };
}

function generated(body = "[]"): GenerateResult {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body,
    recordCount: 0,
    chaosEffects: [],
    delayMs: 0,
    dripMs: 0,
    stream: false,
    capped: false,
  };
}

describe("stateful and fetch behavior", () => {
  it("stores a created record and returns it on GET", () => {
    const behavior = defaultBehavior();
    behavior.state.enabled = true;
    const created = applyBehavior({
      spec: spec(behavior),
      operation: spec(behavior).operations[0],
      method: "POST",
      pathParams: {},
      query: {},
      bodyText: JSON.stringify({ name: "Phishing" }),
      requestIndex: 1,
      generated: generated('{"id":"old"}'),
      state: emptyRuntime(),
    });
    expect(created.result.status).toBe(201);
    expect(JSON.parse(created.result.body).name).toBe("Phishing");
    const id = JSON.parse(created.result.body).id as string;
    const read = applyBehavior({
      spec: spec(behavior),
      operation: spec(behavior).operations[0],
      method: "GET",
      pathParams: { id },
      query: {},
      bodyText: "",
      requestIndex: 2,
      generated: generated("{}"),
      state: created.state,
    });
    expect(JSON.parse(read.result.body).name).toBe("Phishing");
  });

  it("plays scenario steps in order and then keeps the last one", () => {
    const behavior = defaultBehavior();
    behavior.scenario = {
      enabled: true,
      repeat: "last",
      steps: [
        { name: "ok", status: 200, body: '{"ok":1}' },
        { name: "down", status: 503, body: '{"ok":0}' },
      ],
    };
    let state = emptyRuntime();
    const statuses: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const next = applyBehavior({
        spec: spec(behavior),
        operation: spec(behavior).operations[0],
        method: "GET",
        pathParams: {},
        query: {},
        bodyText: "",
        requestIndex: index + 1,
        generated: generated("[]"),
        state,
      });
      statuses.push(next.result.status);
      state = next.state;
    }
    expect(statuses).toEqual([200, 503, 503]);
  });

  it("reveals a new fetch window and dedups a replay of the same since", () => {
    const behavior = defaultBehavior();
    behavior.fetch.enabled = true;
    behavior.fetch.perPoll = 2;
    behavior.fetch.windowSeconds = 60;
    const first = applyBehavior({
      spec: spec(behavior),
      operation: spec(behavior).operations[0],
      method: "GET",
      pathParams: {},
      query: { since: formatTime(FETCH_EPOCH, undefined) },
      bodyText: "",
      requestIndex: 1,
      generated: generated("[]"),
      state: emptyRuntime(),
    });
    const firstIds = (JSON.parse(first.result.body) as Array<{ id: string }>).map((row) => row.id);
    expect(firstIds).toHaveLength(2);
    const replay = applyBehavior({
      spec: spec(behavior),
      operation: spec(behavior).operations[0],
      method: "GET",
      pathParams: {},
      query: { since: formatTime(FETCH_EPOCH, undefined) },
      bodyText: "",
      requestIndex: 2,
      generated: generated("[]"),
      state: first.state,
    });
    expect(JSON.parse(replay.result.body)).toEqual([]);
    const next = applyBehavior({
      spec: spec(behavior),
      operation: spec(behavior).operations[0],
      method: "GET",
      pathParams: {},
      query: { since: first.state.fetchCursor || "" },
      bodyText: "",
      requestIndex: 3,
      generated: generated("[]"),
      state: replay.state,
    });
    const nextIds = (JSON.parse(next.result.body) as Array<{ id: string }>).map((row) => row.id);
    expect(nextIds).toHaveLength(2);
    expect(nextIds.some((id) => firstIds.includes(id))).toBe(false);
  });
});
