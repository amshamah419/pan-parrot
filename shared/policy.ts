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
  specJsonBytes: 512 * 1024,
  sessionCookieName: "pp_session",
} as const;

/**
 * Ceilings for generated mock responses on a Netlify synchronous function.
 * Netlify allows 6 MB buffered and 20 MB streamed, and the function stops at 60 seconds.
 * Normal pages stay at 2 MB. Opt-in streams and downloads stop at 6 MB so the body
 * still fits if the platform buffers it.
 */
export const MOCK_LIMITS = {
  maxRecordsPerResponse: 500,
  maxResponseBytes: 2_000_000,
  maxDownloadBytes: 6_000_000,
  maxVirtualRecords: 20_000,
  maxOperations: 40,
  maxFields: 400,
  maxFieldDepth: 8,
  maxSpecBytes: 400_000,
  maxFetchedSpecBytes: 1_500_000,
  maxZipEntries: 20,
  maxZipUncompressedBytes: 2_000_000,
  maxZipRatio: 100,
  maxStoredRecords: 200,
  maxSeenIds: 2_000,
  maxScenarioSteps: 12,
  maxScenarioBodyBytes: 8_000,
  maxGraphqlSchemaChars: 100_000,
  maxGraphqlQueryChars: 20_000,
  maxGraphqlDepth: 8,
  maxGraphqlFields: 400,
} as const;

export const ENDPOINT_PATH_RE = /^[A-Za-z0-9_-]{4,64}$/;
