import type { RateQuota } from "./mock-spec";

export interface RateSlot {
  limited: boolean;
  count: number;
  windowStart: number;
  remaining: number;
  resetEpoch: number;
  retryAfter: number;
}

/** Count one call in the current window. The caller stores count and windowStart. */
export function nextRateSlot(input: {
  quota: RateQuota;
  count: number;
  windowStart: number;
  now: number;
}): RateSlot {
  const quota = input.quota;
  if (!quota.enabled) {
    return { limited: false, count: input.count, windowStart: input.windowStart, remaining: quota.limit, resetEpoch: 0, retryAfter: 0 };
  }
  const windowMs = quota.windowSeconds * 1000;
  let start = input.windowStart;
  let count = input.count;
  if (!start || input.now - start >= windowMs) {
    start = input.now;
    count = 0;
  }
  count += 1;
  const limited = count > quota.limit;
  return {
    limited,
    count,
    windowStart: start,
    remaining: Math.max(0, quota.limit - count),
    resetEpoch: Math.ceil((start + windowMs) / 1000),
    retryAfter: quota.retryAfterSeconds,
  };
}

export function rateLimitHeaders(quota: RateQuota, slot: RateSlot): Record<string, string> {
  if (!quota.enabled) return {};
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(quota.limit),
    "X-RateLimit-Remaining": String(slot.remaining),
    "X-RateLimit-Reset": String(slot.resetEpoch),
  };
  if (slot.limited) headers["Retry-After"] = String(slot.retryAfter);
  return headers;
}
