/** Limits shared by the API and the dashboard copy. */
export const POLICY = {
  allowedDomain: "paloaltonetworks.com",
  sessionTtlSeconds: 60 * 60 * 24 * 7,
  challengeTtlMs: 10 * 60 * 1000,
  maxVerifyAttempts: 5,
  codeDigits: 8,
  defaultRetentionDays: 14,
  defaultMaxRequestsPerEndpoint: 200,
  defaultMaxBodyBytes: 256 * 1024,
  maxMockBodyBytes: 64 * 1024,
  maxMockDelayMs: 5_000,
  maxEndpointsPerUser: 20,
  apiJsonBytes: 96 * 1024,
  sessionCookieName: "pp_session",
} as const;

export const ENDPOINT_PATH_RE = /^[A-Za-z0-9_-]{4,64}$/;
