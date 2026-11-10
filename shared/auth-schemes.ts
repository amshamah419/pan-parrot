import { createCipheriv, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { localName, parseXml, type XmlElement } from "./xml";

export interface SchemeRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  /** URL query only. Form fields belong in the body and must not enter the canonical query. */
  urlQuery?: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  host: string;
}

export function signAwsSigV4(input: {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  amzDate: string;
}): string {
  const signed = ["host", "x-amz-date"];
  const canonical = canonicalRequest(input.method, input.path, input.query, input.headers, input.body, signed);
  const scope = `${input.amzDate.slice(0, 8)}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", input.amzDate, scope, sha256Hex(canonical)].join("\n");
  const signature = hmac(signingKey(input.secretAccessKey, input.amzDate.slice(0, 8), input.region, input.service), stringToSign).toString("hex");
  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`;
}

export function awsSigV4Matches(
  request: SchemeRequest,
  auth: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    service: string;
    sessionAccessKeyId?: string;
    anyService?: boolean;
  },
  now: number,
): boolean {
  const authorization = header(request, "authorization");
  const parsed = parseSigV4(authorization);
  if (!parsed) return false;
  const keyOk = parsed.accessKeyId === auth.accessKeyId || (auth.sessionAccessKeyId != null && parsed.accessKeyId === auth.sessionAccessKeyId);
  if (!keyOk || parsed.region !== auth.region) return false;
  if (!auth.anyService && parsed.service !== auth.service) return false;
  const amzDate = header(request, "x-amz-date");
  if (!awsDateFresh(amzDate, now)) return false;
  if (parsed.date !== amzDate.slice(0, 8)) return false;
  const canonical = canonicalRequest(
    request.method,
    request.path,
    request.urlQuery ?? request.query,
    { ...request.headers, host: header(request, "host") || request.host },
    request.body,
    parsed.signedHeaders,
  );
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, parsed.scope, sha256Hex(canonical)].join("\n");
  const signature = hmac(signingKey(auth.secretAccessKey, parsed.date, parsed.region, parsed.service), stringToSign).toString("hex");
  return safeEqual(signature, parsed.signature);
}

export function digestChallenge(password: string, realm: string, now: number): string {
  const exp = Math.floor(now / 1000) + 600;
  const mac = createHmac("sha256", password).update(String(exp)).digest("base64url");
  return `Digest realm="${realm}", nonce="${exp}.${mac}", algorithm=MD5, qop="auth"`;
}

export function digestMatches(
  request: SchemeRequest,
  auth: { realm: string; username: string; password: string },
  now: number,
): boolean {
  const fields = parseDigest(header(request, "authorization"));
  if (!fields) return false;
  if (fields.username !== auth.username || fields.realm !== auth.realm) return false;
  if (!digestNonceFresh(fields.nonce, auth.password, now)) return false;
  const ha1 = md5(`${auth.username}:${auth.realm}:${auth.password}`);
  const uri = fields.uri || request.path;
  const ha2 = md5(`${request.method.toUpperCase()}:${uri}`);
  const expected = fields.qop
    ? md5(`${ha1}:${fields.nonce}:${fields.nc}:${fields.cnonce}:${fields.qop}:${ha2}`)
    : md5(`${ha1}:${fields.nonce}:${ha2}`);
  return safeEqual(expected, fields.response);
}

export function signJwt(input: {
  secret: string;
  issuer: string;
  audience: string;
  exp: number;
  extra?: Record<string, string | number>;
}): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iss: input.issuer, aud: input.audience, exp: input.exp, ...input.extra }));
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", input.secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function jwtMatches(
  token: string,
  auth: { hmacSecret: string; issuer: string; audience: string },
  now: number,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  let header: { alg?: string };
  let claims: { iss?: string; aud?: string | string[]; exp?: number; nbf?: number };
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as { alg?: string };
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as typeof claims;
  } catch {
    return false;
  }
  if (header.alg !== "HS256") return false;
  const expected = createHmac("sha256", auth.hmacSecret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  if (!safeEqual(expected, parts[2])) return false;
  if (typeof claims.exp !== "number") return false;
  const skew = 60;
  const seconds = Math.floor(now / 1000);
  if (claims.exp < seconds - skew) return false;
  if (typeof claims.nbf === "number" && claims.nbf > seconds + skew) return false;
  if (auth.issuer && claims.iss !== auth.issuer) return false;
  if (auth.audience) {
    const aud = claims.aud;
    const ok = aud === auth.audience || (Array.isArray(aud) && aud.includes(auth.audience));
    if (!ok) return false;
  }
  return true;
}

export function wsSecurityMatches(body: string, auth: { username: string; password: string }, now: number): boolean {
  let root: XmlElement;
  try {
    root = parseXml(body.slice(0, 256 * 1024));
  } catch {
    return false;
  }
  const token = findLocal(root, "UsernameToken");
  if (!token) return false;
  const username = textOf(token, "Username");
  const password = textOf(token, "Password");
  if (username !== auth.username || !password) return false;
  const type = attributeOf(token, "Password", "Type");
  const digest = type.toLowerCase().endsWith("passworddigest");
  if (!digest) return safeEqual(password, auth.password);
  const nonce = textOf(token, "Nonce");
  const created = textOf(token, "Created");
  if (!nonce || !created || !createdFresh(created, now)) return false;
  let nonceBytes: Buffer;
  try {
    nonceBytes = Buffer.from(nonce, "base64");
  } catch {
    return false;
  }
  const expected = createHash("sha1")
    .update(Buffer.concat([nonceBytes, Buffer.from(created, "utf8"), Buffer.from(auth.password, "utf8")] as unknown as Uint8Array[]) as unknown as Uint8Array)
    .digest("base64");
  return safeEqual(expected, password);
}

export function ntlmChallenge(password: string): Buffer {
  return createHmac("sha256", password).update("ntlm-challenge").digest().subarray(0, 8);
}

export function ntlmType2(password: string): string {
  const challenge = ntlmChallenge(password);
  const target = Buffer.from("PARROT", "utf16le");
  const message = Buffer.alloc(40 + target.length);
  message.write("NTLMSSP\0", 0, "ascii");
  message.writeUInt32LE(2, 8);
  message.writeUInt16LE(target.length, 12);
  message.writeUInt16LE(target.length, 14);
  message.writeUInt32LE(40, 16);
  message.writeUInt32LE(0x00000201 | 0x00000004, 20);
  challenge.copy(message as unknown as Uint8Array, 24);
  target.copy(message as unknown as Uint8Array, 40);
  return message.toString("base64");
}

export function ntlmType3(input: { username: string; password: string; domain: string }): string {
  const challenge = ntlmChallenge(input.password);
  const nt = ntlmV2Response(input.username, input.password, input.domain, challenge);
  const user = Buffer.from(input.username, "utf16le");
  const domain = Buffer.from(input.domain, "utf16le");
  const header = 64;
  const message = Buffer.alloc(header + nt.length + domain.length + user.length);
  message.write("NTLMSSP\0", 0, "ascii");
  message.writeUInt32LE(3, 8);
  writeField(message, 20, nt.length, header);
  writeField(message, 28, domain.length, header + nt.length);
  writeField(message, 36, user.length, header + nt.length + domain.length);
  nt.copy(message as unknown as Uint8Array, header);
  domain.copy(message as unknown as Uint8Array, header + nt.length);
  user.copy(message as unknown as Uint8Array, header + nt.length + domain.length);
  return message.toString("base64");
}

export function ntlmMatches(authorization: string, auth: { username: string; password: string; domain: string }): "challenge" | boolean {
  const token = authorization.replace(/^NTLM\s+/i, "").trim();
  if (!authorization.toLowerCase().startsWith("ntlm ") || !token) return "challenge";
  let message: Buffer;
  try {
    message = Buffer.from(token, "base64");
  } catch {
    return false;
  }
  if (message.length < 12 || message.toString("ascii", 0, 7) !== "NTLMSSP") return false;
  const type = message.readUInt32LE(8);
  if (type === 1) return "challenge";
  if (type !== 3) return false;
  const user = readField(message, 36);
  const domain = readField(message, 28);
  const nt = readField(message, 20);
  if (!user || !nt) return false;
  if (user.toString("utf16le").toUpperCase() !== auth.username.toUpperCase()) return false;
  if (auth.domain && domain && domain.toString("utf16le").toUpperCase() !== auth.domain.toUpperCase()) return false;
  return ntlmResponseMatches(auth.username, auth.password, auth.domain, ntlmChallenge(auth.password), nt);
}

function ntlmResponseMatches(username: string, password: string, domain: string, challenge: Buffer, nt: Buffer): boolean {
  if (nt.length >= 16) {
    const proof = nt.subarray(0, 16);
    const blob = nt.subarray(16);
    const expected = hmacMd5(ntowfv2(username, password, domain), Buffer.concat([challenge, blob] as Uint8Array[]));
    if (safeEqual(proof.toString("hex"), expected.toString("hex"))) return true;
  }
  if (nt.length === 24) {
    try {
      return safeEqual(nt.toString("hex"), ntlmV1Response(password, challenge).toString("hex"));
    } catch {
      return false;
    }
  }
  return false;
}

function ntlmV2Response(username: string, password: string, domain: string, challenge: Buffer): Buffer {
  const blob = Buffer.concat([
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    Buffer.from("0102030405060708", "hex"),
    Buffer.from("1122334455667788", "hex"),
    Buffer.alloc(4),
  ] as Uint8Array[]);
  const proof = hmacMd5(ntowfv2(username, password, domain), Buffer.concat([challenge, blob] as Uint8Array[]));
  return Buffer.concat([proof, blob] as Uint8Array[]);
}

function ntowfv2(username: string, password: string, domain: string): Buffer {
  return hmacMd5(md4(Buffer.from(password, "utf16le")), Buffer.from(username.toUpperCase() + domain, "utf16le"));
}

function ntlmV1Response(password: string, challenge: Buffer): Buffer {
  const hash = md4(Buffer.from(password, "utf16le"));
  const material = Buffer.concat([hash, Buffer.alloc(5)] as Uint8Array[]);
  return Buffer.concat([0, 7, 14].map((offset) => desEncrypt(material.subarray(offset, offset + 7), challenge)) as Uint8Array[]);
}

function canonicalRequest(
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  body: string,
  signedHeaders: string[],
): string {
  const canonicalHeaders = signedHeaders
    .map((name) => `${name}:${(headers[name] || "").trim().replace(/\s+/g, " ")}`)
    .join("\n");
  const canonicalQuery = Object.entries(query)
    .map(([key, value]) => [awsEncode(key), awsEncode(value)] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const declared = (headers["x-amz-content-sha256"] || "").trim();
  const hashed = declared === "UNSIGNED-PAYLOAD" ? declared : sha256Hex(body || "");
  return [method.toUpperCase(), canonicalUri(path), canonicalQuery, `${canonicalHeaders}\n`, signedHeaders.join(";"), hashed].join("\n");
}

function parseSigV4(value: string): { accessKeyId: string; date: string; region: string; service: string; scope: string; signedHeaders: string[]; signature: string } | null {
  if (!value.startsWith("AWS4-HMAC-SHA256 ")) return null;
  const credential = /Credential=([^,\s]+)/.exec(value)?.[1] || "";
  const signed = /SignedHeaders=([^,\s]+)/.exec(value)?.[1] || "";
  const signature = /Signature=([0-9a-fA-F]+)/.exec(value)?.[1] || "";
  const parts = credential.split("/");
  if (parts.length !== 5 || parts[4] !== "aws4_request" || !signature) return null;
  const signedHeaders = signed.split(";").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!signedHeaders.includes("host")) return null;
  return {
    accessKeyId: parts[0],
    date: parts[1],
    region: parts[2],
    service: parts[3],
    scope: parts.slice(1).join("/"),
    signedHeaders,
    signature: signature.toLowerCase(),
  };
}

function signingKey(secret: string, date: string, region: string, service: string): Buffer {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

function awsDateFresh(value: string, now: number): boolean {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) return false;
  const stamped = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  return Math.abs(now - stamped) <= 15 * 60 * 1000;
}

function canonicalUri(path: string): string {
  const value = path.startsWith("/") ? path : `/${path}`;
  return value.split("/").map((part) => awsEncode(decodeURIComponentSafe(part))).join("/");
}

function digestNonceFresh(nonce: string, password: string, now: number): boolean {
  const [expText, mac] = nonce.split(".");
  const exp = Number(expText);
  if (!mac || !Number.isFinite(exp)) return false;
  const expected = createHmac("sha256", password).update(String(exp)).digest("base64url");
  if (!safeEqual(mac, expected)) return false;
  const stamp = exp * 1000;
  return stamp > now && stamp <= now + 11 * 60 * 1000;
}

function parseDigest(value: string): { username: string; realm: string; nonce: string; uri: string; response: string; qop: string; nc: string; cnonce: string } | null {
  if (!value.toLowerCase().startsWith("digest ")) return null;
  const fields: Record<string, string> = {};
  for (const match of value.slice(7).matchAll(/(\w+)=("([^"]*)"|[^,]*)/g)) {
    fields[match[1].toLowerCase()] = (match[3] ?? match[2]).trim();
  }
  if (!fields.username || !fields.realm || !fields.nonce || !fields.response) return null;
  return {
    username: fields.username,
    realm: fields.realm,
    nonce: fields.nonce,
    uri: fields.uri || "",
    response: fields.response,
    qop: fields.qop || "",
    nc: fields.nc || "",
    cnonce: fields.cnonce || "",
  };
}

function createdFresh(value: string, now: number): boolean {
  const stamped = Date.parse(value);
  return Number.isFinite(stamped) && Math.abs(now - stamped) <= 5 * 60 * 1000;
}

function findLocal(element: XmlElement, name: string): XmlElement | undefined {
  if (localName(element.name) === name) return element;
  for (const child of element.children) {
    const found = findLocal(child, name);
    if (found) return found;
  }
  return undefined;
}

function textOf(element: XmlElement, name: string): string {
  return findLocal(element, name)?.text.trim() || "";
}

function attributeOf(element: XmlElement, name: string, attribute: string): string {
  const node = findLocal(element, name);
  return node?.attributes.find((item) => localName(item.name) === attribute)?.value || "";
}

function writeField(message: Buffer, offset: number, length: number, pointer: number) {
  message.writeUInt16LE(length, offset);
  message.writeUInt16LE(length, offset + 2);
  message.writeUInt32LE(pointer, offset + 4);
}

function readField(message: Buffer, offset: number): Buffer | null {
  if (message.length < offset + 8) return null;
  const length = message.readUInt16LE(offset);
  const pointer = message.readUInt32LE(offset + 4);
  if (length > 4096 || pointer < 0 || pointer + length > message.length) return null;
  return message.subarray(pointer, pointer + length);
}

function desEncrypt(key7: Buffer, data: Buffer): Buffer {
  const cipher = createCipheriv("des-ecb", expandDesKey(key7) as unknown as Uint8Array, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data as unknown as Uint8Array) as unknown as Uint8Array, cipher.final() as unknown as Uint8Array]);
}

function expandDesKey(key56: Buffer): Buffer {
  const key = Buffer.alloc(8);
  key[0] = key56[0];
  key[1] = ((key56[0] << 7) | (key56[1] >>> 1)) & 0xff;
  key[2] = ((key56[1] << 6) | (key56[2] >>> 2)) & 0xff;
  key[3] = ((key56[2] << 5) | (key56[3] >>> 3)) & 0xff;
  key[4] = ((key56[3] << 4) | (key56[4] >>> 4)) & 0xff;
  key[5] = ((key56[4] << 3) | (key56[5] >>> 5)) & 0xff;
  key[6] = ((key56[5] << 2) | (key56[6] >>> 6)) & 0xff;
  key[7] = (key56[6] << 1) & 0xff;
  for (let index = 0; index < 8; index += 1) {
    const bits = key[index];
    let parity = 0;
    for (let bit = 1; bit < 8; bit += 1) parity ^= (bits >>> bit) & 1;
    key[index] = (bits & 0xfe) | (parity ^ 1);
  }
  return key;
}

export function md4(data: Buffer): Buffer {
  const bytes = Buffer.alloc(Math.ceil((data.length + 9) / 64) * 64);
  data.copy(bytes as unknown as Uint8Array);
  bytes[data.length] = 0x80;
  bytes.writeUInt32LE(data.length * 8, bytes.length - 8);
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  const f = (x: number, y: number, z: number) => ((x & y) | (~x & z)) >>> 0;
  const g = (x: number, y: number, z: number) => ((x & y) | (x & z) | (y & z)) >>> 0;
  const h = (x: number, y: number, z: number) => (x ^ y ^ z) >>> 0;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const x = Array.from({ length: 16 }, (_, index) => bytes.readUInt32LE(offset + index * 4));
    let aa = a;
    let bb = b;
    let cc = c;
    let dd = d;
    const step = (fn: (x: number, y: number, z: number) => number, va: number, vb: number, vc: number, vd: number, word: number, shift: number, add: number) =>
      rotate((va + fn(vb, vc, vd) + word + add) >>> 0, shift);
    const r1 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const s1 = [3, 7, 11, 19];
    for (let i = 0; i < 16; i += 4) {
      aa = step(f, aa, bb, cc, dd, x[r1[i]], s1[0], 0);
      dd = step(f, dd, aa, bb, cc, x[r1[i + 1]], s1[1], 0);
      cc = step(f, cc, dd, aa, bb, x[r1[i + 2]], s1[2], 0);
      bb = step(f, bb, cc, dd, aa, x[r1[i + 3]], s1[3], 0);
    }
    const r2 = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
    const s2 = [3, 5, 9, 13];
    for (let i = 0; i < 16; i += 4) {
      aa = step(g, aa, bb, cc, dd, x[r2[i]], s2[0], 0x5a827999);
      dd = step(g, dd, aa, bb, cc, x[r2[i + 1]], s2[1], 0x5a827999);
      cc = step(g, cc, dd, aa, bb, x[r2[i + 2]], s2[2], 0x5a827999);
      bb = step(g, bb, cc, dd, aa, x[r2[i + 3]], s2[3], 0x5a827999);
    }
    const r3 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
    const s3 = [3, 9, 11, 15];
    for (let i = 0; i < 16; i += 4) {
      aa = step(h, aa, bb, cc, dd, x[r3[i]], s3[0], 0x6ed9eba1);
      dd = step(h, dd, aa, bb, cc, x[r3[i + 1]], s3[1], 0x6ed9eba1);
      cc = step(h, cc, dd, aa, bb, x[r3[i + 2]], s3[2], 0x6ed9eba1);
      bb = step(h, bb, cc, dd, aa, x[r3[i + 3]], s3[3], 0x6ed9eba1);
    }
    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }
  const out = Buffer.alloc(16);
  out.writeUInt32LE(a, 0);
  out.writeUInt32LE(b, 4);
  out.writeUInt32LE(c, 8);
  out.writeUInt32LE(d, 12);
  return out;
}

function rotate(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function hmacMd5(key: Buffer, data: Buffer): Buffer {
  return createHmac("md5", key as unknown as Uint8Array).update(data as unknown as Uint8Array).digest();
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key as unknown as Uint8Array).update(value).digest();
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function header(request: { headers: Record<string, string> }, name: string): string {
  return request.headers[name.toLowerCase()] || "";
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a as unknown as Uint8Array, b as unknown as Uint8Array);
}
