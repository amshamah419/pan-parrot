import { describe, expect, it } from "vitest";
import { defaultRateLimit } from "./mock-spec";
import { nextRateSlot, rateLimitHeaders } from "./rate-quota";

const quota = { ...defaultRateLimit(), enabled: true, limit: 2, windowSeconds: 60, retryAfterSeconds: 3 };

describe("rate quota", () => {
  it("allows N calls and then 429 until the window rolls", () => {
    const start = 1_700_000_000_000;
    const first = nextRateSlot({ quota, count: 0, windowStart: 0, now: start });
    const second = nextRateSlot({ quota, count: first.count, windowStart: first.windowStart, now: start + 1000 });
    const third = nextRateSlot({ quota, count: second.count, windowStart: second.windowStart, now: start + 2000 });
    expect(first.limited).toBe(false);
    expect(first.remaining).toBe(1);
    expect(second.remaining).toBe(0);
    expect(third.limited).toBe(true);
    expect(third.remaining).toBe(0);
    expect(rateLimitHeaders(quota, third)["Retry-After"]).toBe("3");
    expect(rateLimitHeaders(quota, third)["X-RateLimit-Limit"]).toBe("2");
    expect(rateLimitHeaders(quota, second)["X-RateLimit-Reset"]).toBe(String(Math.ceil((start + 60_000) / 1000)));
    const later = nextRateSlot({ quota, count: third.count, windowStart: third.windowStart, now: start + 60_000 });
    expect(later.limited).toBe(false);
    expect(later.count).toBe(1);
    expect(later.remaining).toBe(1);
  });

  it("does nothing while disabled", () => {
    const slot = nextRateSlot({ quota: defaultRateLimit(), count: 9, windowStart: 1, now: 2 });
    expect(slot.limited).toBe(false);
    expect(slot.count).toBe(9);
    expect(rateLimitHeaders(defaultRateLimit(), slot)).toEqual({});
  });
});
