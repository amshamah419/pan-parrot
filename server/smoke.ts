export type SmokeCheck = { name: string; ok: boolean; detail?: string };

export async function runSmoke(
  baseRaw: string,
  options: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ ok: boolean; checks: SmokeCheck[] }> {
  const base = baseRaw.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const checks: SmokeCheck[] = [];

  const record = async (
    name: string,
    path: string,
    init: RequestInit | undefined,
    expect: (response: Response, text: string) => string | null,
  ) => {
    try {
      const response = await fetchImpl(`${base}${path}`, init);
      const text = await response.text();
      const problem = expect(response, text);
      checks.push({ name, ok: !problem, detail: problem || undefined });
    } catch (error) {
      checks.push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : "request failed",
      });
    }
  };

  await record("health", "/api/health", undefined, (response, text) => {
    if (response.status !== 200) return `status ${response.status}: ${text.slice(0, 180)}`;
    const headerProblem = requiredHeaders(response, base);
    if (headerProblem) return headerProblem;
    return healthProblem(text);
  });
  await record("ping", "/api/ping", undefined, (response, text) => {
    if (response.status !== 200) return `status ${response.status}: ${text.slice(0, 180)}`;
    return healthProblem(text);
  });
  await record("home", "/", undefined, (response, text) => {
    if (response.status !== 200) return `status ${response.status}`;
    if (!/unofficial/i.test(text)) return "home page is missing the unofficial-tool notice";
    if (!/noindex/i.test(text)) return "home page is missing noindex";
    return null;
  });
  await record("robots", "/robots.txt", undefined, (response, text) => {
    if (response.status !== 200) return `status ${response.status}`;
    if (!text.includes("Disallow: /")) return "robots.txt does not disallow the site";
    return null;
  });
  await record(
    "reject non-PAN email",
    "/api/auth/request",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "person@gmail.com" }),
    },
    (response, text) => {
      if (response.status !== 200) return `status ${response.status}`;
      if (!text.includes("Check your email")) return "sign-in response was not the generic message";
      if (text.includes("devCode")) return "rejected address received a sign-in code";
      return null;
    },
  );
  await record("studio requires sign-in", "/api/endpoints", undefined, (response) =>
    response.status === 401 ? null : `status ${response.status}`,
  );
  await record("unknown catch URL", "/catch/missing-smoke-path", undefined, (response) =>
    response.status === 404 ? null : `status ${response.status}`,
  );

  if (options.token) {
    await exerciseToken(base, options.token, fetchImpl, checks);
  }

  return { ok: checks.every((check) => check.ok), checks };
}

async function exerciseToken(
  base: string,
  token: string,
  fetchImpl: typeof fetch,
  checks: SmokeCheck[],
) {
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const path = `smoke${Date.now().toString(36)}`;
  let endpointId = "";
  try {
    const created = await fetchImpl(`${base}/api/endpoints`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Smoke", customPath: path }),
    });
    const createdText = await created.text();
    if (created.status !== 200) {
      checks.push({ name: "token can create a mock", ok: false, detail: `status ${created.status}: ${createdText.slice(0, 180)}` });
      return;
    }
    endpointId = (JSON.parse(createdText) as { id?: string }).id || "";
    checks.push({ name: "token can create a mock", ok: Boolean(endpointId), detail: endpointId ? undefined : "response had no id" });
    const hit = await fetchImpl(`${base}/catch/${path}`);
    checks.push({ name: "catch URL accepts a call", ok: hit.status === 200, detail: hit.status === 200 ? undefined : `status ${hit.status}` });
    await hit.text();
  } catch (error) {
    checks.push({ name: "token can create a mock", ok: false, detail: error instanceof Error ? error.message : "request failed" });
  } finally {
    if (endpointId) {
      try {
        const removed = await fetchImpl(`${base}/api/endpoints/${endpointId}`, {
          method: "DELETE",
          headers,
        });
        checks.push({ name: "token can delete the smoke mock", ok: removed.status === 200, detail: removed.status === 200 ? undefined : `status ${removed.status}` });
        await removed.text();
      } catch (error) {
        checks.push({ name: "token can delete the smoke mock", ok: false, detail: error instanceof Error ? error.message : "request failed" });
      }
    }
  }
}

function healthProblem(text: string): string | null {
  try {
    const body = JSON.parse(text) as { ok?: boolean; database?: string };
    if (body.ok !== true || body.database !== "up") return `unexpected body ${text.slice(0, 180)}`;
    return null;
  } catch {
    return "health body was not JSON";
  }
}

function requiredHeaders(response: Response, base: string): string | null {
  const csp = response.headers.get("content-security-policy") || "";
  if (!csp.includes("frame-ancestors 'none'")) return "missing frame-ancestors CSP";
  if (response.headers.get("x-content-type-options") !== "nosniff") return "missing nosniff";
  if (response.headers.get("x-frame-options") !== "DENY") return "missing X-Frame-Options";
  const cache = response.headers.get("cache-control") || "";
  if (!cache.includes("no-store")) return "health response is cacheable";
  if (base.startsWith("https:") && !response.headers.get("strict-transport-security")) {
    return "missing HSTS";
  }
  return null;
}
