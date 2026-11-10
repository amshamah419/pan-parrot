import type { MockAuth, XsoarIntegration, XsoarParam } from "./mock-spec";

export interface InstanceRow {
  name: string;
  label: string;
  value: string;
  copy: string;
  note?: string;
}

export interface InstanceGuide {
  brand: string;
  display: string;
  rows: InstanceRow[];
  values: Array<{ name: string; value: unknown }>;
  download: { filename: string; json: string } | null;
}

interface RawParam {
  name?: string;
  display?: string;
  type?: number;
  required?: boolean;
  hidden?: unknown;
  defaultvalue?: unknown;
  displaypassword?: string;
}

interface Secrets {
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  clientToken?: string;
  accessToken?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  service?: string;
}

const URL_NAMES = new Set(["url", "server", "server_url", "base_url", "host", "api_url", "apiurl"]);
const NAMED_SECRET: Record<string, keyof Secrets> = {
  client_token: "clientToken",
  clienttoken: "clientToken",
  clienttoken_creds: "clientToken",
  access_token: "accessToken",
  accesstoken: "accessToken",
  accesstoken_creds: "accessToken",
  client_secret: "clientSecret",
  clientsecret: "clientSecret",
  clientsecret_creds: "clientSecret",
  access_key: "accessKeyId",
  accesskeyid: "accessKeyId",
  secret_key: "secretAccessKey",
  secretaccesskey: "secretAccessKey",
  region: "region",
  service: "service",
};

/** Keep the parameters a content developer types into an integration instance. */
export function xsoarFromDocument(document: unknown): XsoarIntegration | undefined {
  if (!document || typeof document !== "object") return undefined;
  const doc = document as {
    name?: string;
    display?: string;
    commonfields?: { id?: string };
    configuration?: RawParam[];
  };
  if (!Array.isArray(doc.configuration)) return undefined;
  const params = relevantParams(doc.configuration);
  const brand = String(doc.commonfields?.id || doc.name || "").trim().slice(0, 80);
  const display = String(doc.display || doc.name || brand).trim().slice(0, 120);
  if (!brand || !display || !params.length) return undefined;
  return { brand, display, params };
}

export function instanceGuide(
  integration: XsoarIntegration | undefined,
  auth: MockAuth | undefined,
  catchUrl: string,
): InstanceGuide | null {
  if (!integration?.params.length) return null;
  const endpoint = describeUrl(catchUrl);
  const secrets = secretsFrom(auth);
  const rows: InstanceRow[] = [];
  const data: Array<{ name: string; value: unknown }> = [];
  const used = new Set<string>();
  const params = integration.params;
  const urlParam = params.find((param) => isUrl(param));
  const credential = bestCredential(params, secrets);

  for (const param of params) {
    if (used.has(param.name)) continue;
    if (isUrl(param)) {
      used.add(param.name);
      rows.push({
        name: param.name,
        label: param.display,
        value: endpoint.href,
        copy: endpoint.href,
        note: params.some((item) => item.name === "port")
          ? "Catch URL. This integration also has a Port field, so check that note before you save the instance."
          : "This is the catch URL. The integration appends its own paths to it.",
      });
      data.push({ name: param.name, value: endpoint.href });
      continue;
    }
    if (param.name === "port") {
      used.add(param.name);
      rows.push({
        name: param.name,
        label: param.display || "Port",
        value: endpoint.port,
        copy: endpoint.port,
        note: urlParam
          ? "Panorama-style clients append :port and then /api/, which drops the /catch path. Clients that use the server field as a base URL ignore this."
          : undefined,
      });
      data.push({ name: param.name, value: endpoint.port });
      continue;
    }
    if (param.name === "insecure") {
      used.add(param.name);
      pushBoolean(rows, data, param, true, "On, so XSOAR accepts the catch URL certificate.");
      continue;
    }
    if (param.name === "proxy") {
      used.add(param.name);
      pushBoolean(rows, data, param, false, "Off, so the call goes straight to the catch URL.");
      continue;
    }
    if (param.name === "isFetch") {
      used.add(param.name);
      pushBoolean(rows, data, param, false, "Leave this off until a manual command hits the catch URL.");
      continue;
    }
    if (param.name === "first_fetch" || param.name === "fetch_time" || param.name === "max_fetch" || param.name === "incidents_per_fetch" || param.name === "fetch_limit") {
      used.add(param.name);
      const value = param.defaultValue || "";
      if (!value) continue;
      rows.push({
        name: param.name,
        label: param.display,
        value,
        copy: value,
        note: "YAML default. It is used only after you turn fetch on.",
      });
      data.push({ name: param.name, value });
      continue;
    }
    const named = NAMED_SECRET[param.name.toLowerCase()];
    if (named && secrets[named]) {
      used.add(param.name);
      const value = String(secrets[named]);
      if (param.type === 9) {
        rows.push({
          name: param.name,
          label: param.passwordLabel ? `${param.display} / ${param.passwordLabel}` : param.display,
          value,
          copy: value,
        });
        data.push({ name: param.name, value: { identifier: "", password: value, vaultInstanceId: "" } });
      } else {
        rows.push({ name: param.name, label: param.display, value, copy: value });
        data.push({ name: param.name, value });
      }
      continue;
    }
    if (param.type === 9) {
      if (!credential || param.name !== credential.name) continue;
      const filled = fillCredential(param, secrets);
      used.add(param.name);
      rows.push(filled.row);
      if (filled.json) data.push({ name: param.name, value: filled.json });
      continue;
    }
    if (param.type === 4 || param.name === "user" || param.name === "username") {
      if (param.type === 4 && credential?.type === 9 && (secrets.apiKey || secrets.token || secrets.clientSecret || secrets.password)) continue;
      const value = secretForPlain(param, secrets);
      if (!value) continue;
      used.add(param.name);
      rows.push({ name: param.name, label: param.display, value, copy: value });
      data.push({ name: param.name, value });
    }
  }

  if (!urlParam) {
    rows.unshift({
      name: "url",
      label: "Server URL",
      value: endpoint.href,
      copy: endpoint.href,
      note: "This YAML has no server URL parameter. Paste the catch URL into whichever field the integration uses as the host.",
    });
  }

  const safeBrand = integration.brand.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "instance";
  const body = {
    brand: integration.brand,
    name: `${integration.display} mock`.slice(0, 120),
    enabled: true,
    data,
  };
  return {
    brand: integration.brand,
    display: integration.display,
    rows,
    values: data,
    download: data.length
      ? { filename: `${safeBrand}-instance.json`, json: JSON.stringify(body, null, 2) }
      : null,
  };
}

function relevantParams(configuration: RawParam[]): XsoarParam[] {
  const visible = configuration.filter((param) => param && typeof param.name === "string" && param.hidden !== true);
  const picked: RawParam[] = [];
  const url = visible.find((param) => URL_NAMES.has(String(param.name).toLowerCase()))
    || visible.find((param) => /server url|base url/i.test(String(param.display || "")));
  if (url) picked.push(url);
  for (const name of ["port", "insecure", "proxy", "isFetch", "first_fetch", "fetch_time", "max_fetch", "incidents_per_fetch", "fetch_limit"]) {
    if (name === "fetch_time" && picked.some((param) => param.name === "first_fetch")) continue;
    if ((name === "incidents_per_fetch" || name === "fetch_limit") && picked.some((param) => param.name === "max_fetch" || param.name === "incidents_per_fetch")) continue;
    const found = visible.find((param) => param.name === name);
    if (found) picked.push(found);
  }
  const credentials = visible.filter((param) => {
    const name = String(param.name);
    if (picked.some((item) => item.name === name)) return false;
    if (param.type === 9 || param.type === 4) return true;
    return ["user", "username", "client_id", "client_secret", "api_key", "apikey", "token", "key", "client_token", "access_token", "access_key", "secret_key", "region", "service"].includes(name);
  });
  credentials.sort((a, b) => Number(b.type === 9) - Number(a.type === 9));
  picked.push(...credentials.slice(0, 6));
  const seen = new Set<string>();
  const params: XsoarParam[] = [];
  for (const param of picked) {
    const name = String(param.name);
    if (seen.has(name) || !/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(name)) continue;
    seen.add(name);
    const type = Number(param.type);
    params.push({
      name,
      display: String(param.display || param.displaypassword || name).replace(/\s+/g, " ").trim().slice(0, 160) || name,
      type: Number.isInteger(type) && type >= 0 && type <= 30 ? type : 0,
      required: Boolean(param.required),
      defaultValue: param.defaultvalue == null ? undefined : String(param.defaultvalue).trim().slice(0, 80) || undefined,
      passwordLabel: param.displaypassword ? String(param.displaypassword).slice(0, 80) : undefined,
    });
    if (params.length >= 16) break;
  }
  return params;
}

function isUrl(param: XsoarParam): boolean {
  return URL_NAMES.has(param.name.toLowerCase());
}

function pushBoolean(
  rows: InstanceRow[],
  data: Array<{ name: string; value: unknown }>,
  param: XsoarParam,
  value: boolean,
  note: string,
) {
  rows.push({
    name: param.name,
    label: param.display,
    value: value ? "true" : "false",
    copy: value ? "true" : "false",
    note,
  });
  data.push({ name: param.name, value });
}

function bestCredential(params: XsoarParam[], secrets: Secrets): XsoarParam | undefined {
  const creds = params.filter((param) => param.type === 9);
  if (!creds.length) return undefined;
  return creds
    .map((param) => ({ param, score: credentialScore(param, secrets) }))
    .sort((a, b) => b.score - a.score)[0].param;
}

function credentialScore(param: XsoarParam, secrets: Secrets): number {
  const label = `${param.passwordLabel || ""} ${param.display} ${param.name}`.toLowerCase();
  let score = param.name === "credentials" ? 1 : 0;
  if (/api key|token|secret/.test(label)) score += 2;
  if (/basic|username/.test(label) && secrets.username) score += 5;
  if (/client/.test(label) && secrets.clientId) score += 5;
  if (/api key|token|secret/.test(label) && (secrets.apiKey || secrets.token || secrets.clientSecret)) score += 4;
  return score;
}

function fillCredential(
  param: XsoarParam,
  secrets: Secrets,
): { row: InstanceRow; json: Record<string, string> | null } | null {
  const label = `${param.passwordLabel || ""} ${param.display} ${param.name}`.toLowerCase();
  const wantsKey = /api key|token|secret|client secret/.test(label);
  let identifier = "";
  let password = "";
  if (wantsKey && (secrets.apiKey || secrets.token || secrets.clientSecret)) {
    identifier = secrets.clientId || "";
    password = secrets.apiKey || secrets.token || secrets.clientSecret || "";
  } else if (secrets.clientId && secrets.clientSecret && /client/.test(label)) {
    identifier = secrets.clientId;
    password = secrets.clientSecret;
  } else {
    identifier = secrets.username || "";
    password = secrets.password || secrets.token || secrets.apiKey || "";
  }
  if (!identifier && !password) {
    return {
      row: {
        name: param.name,
        label: param.passwordLabel ? `${param.display} / ${param.passwordLabel}` : param.display,
        value: "",
        copy: "",
        note: "This mock does not check a value for this field.",
      },
      json: null,
    };
  }
  const shown = identifier ? `identifier ${identifier}, password ${password}` : password;
  const note = wantsKey && secrets.apiKey
    ? "Paste the dummy value into the password box. This integration reads that box as the API key."
    : undefined;
  return {
    row: {
      name: param.name,
      label: param.passwordLabel ? `${param.display} / ${param.passwordLabel}` : param.display,
      value: shown,
      copy: identifier ? `identifier: ${identifier}\npassword: ${password}` : password,
      note,
    },
    json: { identifier, password, vaultInstanceId: "" },
  };
}

function secretForPlain(param: XsoarParam, secrets: Secrets): string {
  if (param.name === "user" || param.name === "username") return secrets.username || "";
  return secrets.apiKey || secrets.token || secrets.clientSecret || "";
}

function secretsFrom(auth: MockAuth | undefined): Secrets {
  if (!auth || auth.mode === "none" || auth.mode === "signed-headers") return {};
  if (auth.mode === "api-key" && auth.apiKey) return { token: auth.apiKey.value, apiKey: auth.apiKey.value };
  if (auth.mode === "basic" && auth.basic) return { username: auth.basic.username, password: auth.basic.password };
  if (auth.mode === "bearer" && auth.bearer) return { token: auth.bearer.token };
  if (auth.mode === "oauth2" && auth.oauth2) return { clientId: auth.oauth2.clientId, clientSecret: auth.oauth2.clientSecret };
  if (auth.mode === "session" && auth.session) return { username: auth.session.username, password: auth.session.password };
  if (auth.mode === "panos-key" && auth.panos) return { username: auth.panos.username, password: auth.panos.password, apiKey: auth.panos.apiKey };
  if (auth.mode === "edgegrid" && auth.edgegrid) {
    return { clientToken: auth.edgegrid.clientToken, accessToken: auth.edgegrid.accessToken, clientSecret: auth.edgegrid.clientSecret };
  }
  if (auth.mode === "sigv4" && auth.sigv4) {
    return { accessKeyId: auth.sigv4.accessKeyId, secretAccessKey: auth.sigv4.secretAccessKey, region: auth.sigv4.region, service: auth.sigv4.service };
  }
  if (auth.mode === "digest" && auth.digest) return { username: auth.digest.username, password: auth.digest.password };
  if (auth.mode === "jwt" && auth.jwt) return { token: auth.jwt.hmacSecret };
  if (auth.mode === "wsse" && auth.wsse) return { username: auth.wsse.username, password: auth.wsse.password };
  if (auth.mode === "ntlm" && auth.ntlm) return { username: auth.ntlm.username, password: auth.ntlm.password };
  return {};
}

function describeUrl(catchUrl: string): { href: string; port: string } {
  const href = catchUrl.trim().replace(/\/$/, "");
  try {
    const url = new URL(href);
    return { href, port: url.port || (url.protocol === "https:" ? "443" : "80") };
  } catch {
    return { href, port: "443" };
  }
}
