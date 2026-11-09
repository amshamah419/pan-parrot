import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ChaosSpec, MockAuth, MockSpec } from "./mock-spec";

export interface AuthRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  scheme: string;
  host: string;
}

export interface AuthDecision {
  handled: boolean;
  ok: boolean;
  status: number;
  body: string;
  headers: Record<string, string>;
  chaosEffects: string[];
}

const COOKIE = "pp-mock";

export function checkMockAuth(
  spec: MockSpec,
  request: AuthRequest,
  now = Date.now(),
  chaos?: ChaosSpec | null,
): AuthDecision {
  const auth = spec.auth;
  if (!auth || auth.mode === "none") return pass();
  const effects: string[] = [];
  const tripped = Boolean(chaos?.enabled);
  if (tripped && chaos?.authDenied) {
    effects.push("auth-denied");
    return fail(403, "Forbidden", effects, auth);
  }
  if (auth.mode === "oauth2" && auth.oauth2 && normalizePath(request.path) === normalizePath(auth.oauth2.tokenPath)) {
    if (tripped && chaos?.authTokenFailure) {
      effects.push("auth-token-failure");
      return {
        handled: true,
        ok: false,
        status: 500,
        body: JSON.stringify({ error: "server_error", error_description: "Token endpoint failed" }),
        headers: { "content-type": "application/json; charset=utf-8" },
        chaosEffects: effects,
      };
    }
    return issueOAuth(auth, request, now, effects);
  }
  if (auth.mode === "session" && auth.session && normalizePath(request.path) === normalizePath(auth.session.loginPath)) {
    return issueSession(auth, request, now, effects);
  }
  if (auth.mode === "panos-key" && auth.panos && request.query.type === "keygen") {
    if (request.query.user === auth.panos.username && request.query.password === auth.panos.password) {
      return {
        handled: true,
        ok: true,
        status: 200,
        body: panosKeygenXml(auth.panos.apiKey),
        headers: { "content-type": "application/xml; charset=utf-8" },
        chaosEffects: effects,
      };
    }
    return fail(403, "Invalid credential", effects, auth);
  }
  if (tripped && chaos?.authExpired && auth.mode !== "signed-headers") {
    effects.push("auth-expired");
    return fail(401, "Token expired", effects, auth);
  }
  if (tripped && chaos?.authClockSkew && (auth.mode === "edgegrid" || auth.mode === "signed-headers")) {
    effects.push("auth-clock-skew");
    return fail(401, "Clock skew", effects, auth);
  }
  const ok = credentialMatches(auth, request, now);
  if (!ok) return fail(401, "Unauthorized", effects, auth);
  return pass(effects);
}

export function signEdgeGrid(input: {
  method: string;
  scheme: string;
  host: string;
  path: string;
  body?: string;
  clientToken: string;
  accessToken: string;
  clientSecret: string;
  timestamp: string;
  nonce: string;
}): string {
  const contentHash =
    input.method.toUpperCase() === "POST" && input.body
      ? createHash("sha256").update(input.body.slice(0, 131_072)).digest("base64")
      : "";
  const unsigned = `EG1-HMAC-SHA256 client_token=${input.clientToken};access_token=${input.accessToken};timestamp=${input.timestamp};nonce=${input.nonce};`;
  const data = [input.method.toUpperCase(), input.scheme, input.host, input.path, "", contentHash, unsigned].join("\t");
  const signingKey = createHmac("sha256", input.clientSecret).update(input.timestamp).digest("base64");
  const signature = createHmac("sha256", signingKey).update(data).digest("base64");
  return `${unsigned}signature=${signature}`;
}

function credentialMatches(auth: MockAuth, request: AuthRequest, now: number): boolean {
  if (auth.mode === "api-key" && auth.apiKey) {
    const presented =
      auth.apiKey.in === "header"
        ? header(request, auth.apiKey.name)
        : auth.apiKey.in === "query"
          ? request.query[auth.apiKey.name]
          : formValue(request.body, auth.apiKey.name) || request.query[auth.apiKey.name];
    return safeEqual(presented, auth.apiKey.value);
  }
  if (auth.mode === "basic" && auth.basic) {
    const expected = Buffer.from(`${auth.basic.username}:${auth.basic.password}`).toString("base64");
    return header(request, "authorization") === `Basic ${expected}`;
  }
  if (auth.mode === "bearer" && auth.bearer) {
    return header(request, "authorization") === `Bearer ${auth.bearer.token}`;
  }
  if (auth.mode === "oauth2" && auth.oauth2) {
    const token = header(request, "authorization").replace(/^Bearer /i, "");
    return verifyIssuedToken(token, auth.oauth2.clientSecret, now);
  }
  if (auth.mode === "session" && auth.session) {
    const cookie = readCookie(header(request, "cookie"), COOKIE);
    return verifyIssuedToken(cookie, auth.session.password, now);
  }
  if (auth.mode === "panos-key" && auth.panos) {
    return safeEqual(request.query.key || formValue(request.body, "key"), auth.panos.apiKey);
  }
  if (auth.mode === "edgegrid" && auth.edgegrid) {
    return verifyEdgeGrid(auth, request);
  }
  if (auth.mode === "signed-headers" && auth.signedHeaders) {
    return auth.signedHeaders.names.every((name) => header(request, name).length > 0);
  }
  return false;
}

function verifyEdgeGrid(auth: MockAuth, request: AuthRequest): boolean {
  const edge = auth.edgegrid;
  if (!edge) return false;
  const authorization = header(request, "authorization");
  if (!authorization.startsWith("EG1-HMAC-SHA256 ")) return false;
  const fields = Object.fromEntries(
    authorization
      .slice("EG1-HMAC-SHA256 ".length)
      .split(";")
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? ["", ""] : [part.slice(0, index), part.slice(index + 1)];
      })
      .filter((part) => part[0] && part[1])
      .map(([key, value]) => [key, value]),
  );
  if (fields.client_token !== edge.clientToken || fields.access_token !== edge.accessToken) return false;
  if (!fields.timestamp || !fields.nonce || !fields.signature) return false;
  if (edge.verify === "format-only") return true;
  const stamped = Date.parse(fields.timestamp.replace(/(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})\+0000/, "$1-$2-$3T$4:$5:$6Z"));
  if (!Number.isFinite(stamped) || Math.abs(Date.now() - stamped) > 30_000) return false;
  const expected = signEdgeGrid({
    method: request.method,
    scheme: request.scheme,
    host: request.host,
    path: request.path + queryString(request.query),
    body: request.body,
    clientToken: edge.clientToken,
    accessToken: edge.accessToken,
    clientSecret: edge.clientSecret,
    timestamp: fields.timestamp,
    nonce: fields.nonce,
  });
  const actualSignature = fields.signature;
  const expectedSignature = expected.split("signature=")[1] || "";
  return safeEqual(actualSignature, expectedSignature);
}

function issueOAuth(auth: MockAuth, request: AuthRequest, now: number, effects: string[]): AuthDecision {
  const oauth = auth.oauth2;
  if (!oauth) return fail(401, "invalid_client", effects, auth);
  const body = new URLSearchParams(request.body);
  const id = body.get("client_id") || request.query.client_id || "";
  const secret = body.get("client_secret") || request.query.client_secret || "";
  const basic = decodeBasic(header(request, "authorization"));
  const clientId = id || basic?.username || "";
  const clientSecret = secret || basic?.password || "";
  if (clientId !== oauth.clientId || clientSecret !== oauth.clientSecret) {
    return fail(401, "invalid_client", effects, auth);
  }
  const exp = Math.floor(now / 1000) + oauth.ttlSeconds;
  const access = issueToken(oauth.clientSecret, exp);
  const payload =
    oauth.shape === "microsoft"
      ? { token_type: "Bearer", expires_in: oauth.ttlSeconds, ext_expires_in: oauth.ttlSeconds, access_token: access }
      : oauth.shape === "crowdstrike"
        ? { access_token: access, expires_in: oauth.ttlSeconds, token_type: "bearer" }
        : { access_token: access, token_type: "Bearer", expires_in: oauth.ttlSeconds };
  return {
    handled: true,
    ok: true,
    status: 200,
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json; charset=utf-8" },
    chaosEffects: effects,
  };
}

function issueSession(auth: MockAuth, request: AuthRequest, now: number, effects: string[]): AuthDecision {
  const session = auth.session;
  if (!session) return fail(401, "Unauthorized", effects, auth);
  const body = readLogin(request.body);
  if (body.username !== session.username || body.password !== session.password) {
    return fail(401, "Unauthorized", effects, auth);
  }
  const exp = Math.floor(now / 1000) + 3600;
  const token = issueToken(session.password, exp);
  return {
    handled: true,
    ok: true,
    status: 200,
    body: JSON.stringify({ ok: true }),
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `${COOKIE}=${token}; Path=/catch; HttpOnly; SameSite=Lax`,
    },
    chaosEffects: effects,
  };
}

function issueToken(secret: string, exp: number): string {
  const payload = String(exp);
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `pptok.${payload}.${sig}`;
}

function verifyIssuedToken(token: string, secret: string, now: number): boolean {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "pptok") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = createHmac("sha256", secret).update(parts[1]).digest("base64url");
  return safeEqual(parts[2], expected);
}

function panosKeygenXml(apiKey: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><response status="success"><result><key>${escape(apiKey)}</key></result></response>`;
}

function fail(status: number, message: string, effects: string[], auth: MockAuth): AuthDecision {
  if (auth.mode === "panos-key") {
    return {
      handled: true,
      ok: false,
      status,
      body: `<?xml version="1.0" encoding="UTF-8"?><response status="error" code="${status}"><msg>${escape(message)}</msg></response>`,
      headers: { "content-type": "application/xml; charset=utf-8" },
      chaosEffects: effects,
    };
  }
  if (auth.mode === "oauth2") {
    return {
      handled: true,
      ok: false,
      status,
      body: JSON.stringify({ error: message === "Token expired" ? "invalid_token" : "invalid_client", error_description: message }),
      headers: { "content-type": "application/json; charset=utf-8" },
      chaosEffects: effects,
    };
  }
  return {
    handled: true,
    ok: false,
    status,
    body: JSON.stringify({ error: message, status }),
    headers: { "content-type": "application/json; charset=utf-8" },
    chaosEffects: effects,
  };
}

function pass(effects: string[] = []): AuthDecision {
  return { handled: false, ok: true, status: 200, body: "", headers: {}, chaosEffects: effects };
}

function header(request: AuthRequest, name: string): string {
  return request.headers[name.toLowerCase()] || "";
}

function readCookie(headerValue: string, name: string): string {
  const match = headerValue.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : "";
}

function formValue(body: string, name: string): string {
  if (!body) return "";
  if (body.includes("name=")) {
    const match = new RegExp(`name="${name}"[\\s\\S]{0,80}\\r\\n\\r\\n([^\\r\\n]{0,200})`).exec(body);
    if (match) return match[1];
  }
  return new URLSearchParams(body).get(name) || "";
}

function readLogin(body: string): { username: string; password: string } {
  try {
    const parsed = JSON.parse(body) as { username?: string; password?: string; user?: string };
    return { username: parsed.username || parsed.user || "", password: parsed.password || "" };
  } catch {
    const params = new URLSearchParams(body);
    return { username: params.get("username") || params.get("user") || "", password: params.get("password") || "" };
  }
}

function decodeBasic(value: string): { username: string; password: string } | null {
  if (!value.startsWith("Basic ")) return null;
  const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
  const index = decoded.indexOf(":");
  if (index < 0) return null;
  return { username: decoded.slice(0, index), password: decoded.slice(index + 1) };
}

function queryString(query: Record<string, string>): string {
  const text = new URLSearchParams(query).toString();
  return text ? `?${text}` : "";
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function safeEqual(left: string | undefined, right: string): boolean {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a as unknown as Uint8Array, b as unknown as Uint8Array);
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] || char);
}
