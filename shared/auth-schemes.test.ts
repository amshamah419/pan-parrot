import { describe, expect, it } from "vitest";
import {
  awsSigV4Matches,
  digestChallenge,
  digestMatches,
  jwtMatches,
  md4,
  ntlmMatches,
  ntlmType2,
  ntlmType3,
  signAwsSigV4,
  signJwt,
  wsSecurityMatches,
} from "./auth-schemes";

const now = Date.parse("2026-11-09T12:00:00Z");

describe("remaining auth schemes", () => {
  it("hashes with MD4 the way NTLM expects", () => {
    expect(md4(Buffer.alloc(0)).toString("hex")).toBe("31d6cfe0d16ae931b73c59d7e0c089c0");
    expect(md4(Buffer.from("a")).toString("hex")).toBe("bde52cb31de33e46245e05fbdbd6fb24");
  });

  it("verifies SigV4 and rejects a stale date or the wrong key", () => {
    const amzDate = "20261109T120000Z";
    const headers = { host: "s3.example.com", "x-amz-date": amzDate };
    const authorization = signAwsSigV4({
      method: "GET",
      path: "/bucket/object",
      query: { "list-type": "2" },
      headers,
      body: "",
      accessKeyId: "AKIA_DUMMY",
      secretAccessKey: "dummy-secret-key",
      region: "us-east-1",
      service: "s3",
      amzDate,
    });
    const request = {
      method: "GET",
      path: "/bucket/object",
      query: { "list-type": "2" },
      headers: { ...headers, authorization },
      body: "",
      host: "s3.example.com",
    };
    const auth = { accessKeyId: "AKIA_DUMMY", secretAccessKey: "dummy-secret-key", region: "us-east-1", service: "s3" };
    expect(awsSigV4Matches(request, auth, now)).toBe(true);
    expect(awsSigV4Matches(request, { ...auth, secretAccessKey: "other-secret" }, now)).toBe(false);
    expect(awsSigV4Matches({ ...request, headers: { ...request.headers, "x-amz-date": "20200101T000000Z" } }, auth, now)).toBe(false);
  });

  it("checks JWT issuer, audience, expiry, and rejects alg none", () => {
    const token = signJwt({ secret: "dummy-hmac", issuer: "lab", audience: "parrot", exp: Math.floor(now / 1000) + 60 });
    const auth = { hmacSecret: "dummy-hmac", issuer: "lab", audience: "parrot" };
    expect(jwtMatches(token, auth, now)).toBe(true);
    expect(jwtMatches(token, { ...auth, audience: "other" }, now)).toBe(false);
    expect(jwtMatches(token, auth, now + 10 * 60 * 1000)).toBe(false);
    const [h, p] = token.split(".");
    const none = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${p}.`;
    expect(jwtMatches(none, auth, now)).toBe(false);
    expect(h).toBeTruthy();
  });

  it("issues a digest challenge and accepts the matching response", () => {
    const password = "dummy-not-a-real-password";
    const challenge = digestChallenge(password, "pan-parrot", now);
    const nonce = /nonce="([^"]+)"/.exec(challenge)?.[1] || "";
    const ha1 = md5(`${"lab"}:pan-parrot:${password}`);
    const ha2 = md5("GET:/data");
    const response = md5(`${ha1}:${nonce}:00000001:abc:auth:${ha2}`);
    const header = `Digest username="lab", realm="pan-parrot", nonce="${nonce}", uri="/data", qop=auth, nc=00000001, cnonce="abc", response="${response}"`;
    const request = { method: "GET", path: "/data", query: {}, headers: { authorization: header }, body: "", host: "parrot.example" };
    expect(digestMatches(request, { realm: "pan-parrot", username: "lab", password }, now + 1000)).toBe(true);
    expect(digestMatches(request, { realm: "pan-parrot", username: "lab", password: "wrong" }, now + 1000)).toBe(false);
  });

  it("checks a SOAP UsernameToken password digest", () => {
    const created = "2026-11-09T12:00:00Z";
    const nonce = Buffer.from("nonce-bytes").toString("base64");
    const password = "dummy-not-a-real-password";
    const digest = require("node:crypto").createHash("sha1").update(Buffer.concat([Buffer.from("nonce-bytes"), Buffer.from(created), Buffer.from(password)] as unknown as Uint8Array[])).digest("base64");
    const body = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"><soap:Header><wsse:Security><wsse:UsernameToken><wsse:Username>lab</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</wsse:Password><wsse:Nonce>${nonce}</wsse:Nonce><wsu:Created xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</wsu:Created></wsse:UsernameToken></wsse:Security></soap:Header><soap:Body/></soap:Envelope>`;
    expect(wsSecurityMatches(body, { username: "lab", password }, now)).toBe(true);
    expect(wsSecurityMatches(body, { username: "lab", password: "nope" }, now)).toBe(false);
    expect(wsSecurityMatches("<!DOCTYPE foo [<!ENTITY x 'y'>]><foo/>", { username: "lab", password }, now)).toBe(false);
  });

  it("walks an NTLM type 1 to type 3 handshake and checks the password", () => {
    const password = "dummy-not-a-real-password";
    const type1 = Buffer.alloc(32);
    type1.write("NTLMSSP\0", 0, "ascii");
    type1.writeUInt32LE(1, 8);
    expect(ntlmMatches(`NTLM ${type1.toString("base64")}`, { username: "lab", password, domain: "" })).toBe("challenge");
    const type2 = ntlmType2(password);
    expect(type2.length).toBeGreaterThan(10);
    const type3 = ntlmType3({ username: "lab", password, domain: "CORP" });
    expect(ntlmMatches(`NTLM ${type3}`, { username: "lab", password, domain: "CORP" })).toBe(true);
    expect(ntlmMatches(`NTLM ${type3}`, { username: "lab", password: "other-password", domain: "CORP" })).toBe(false);
  });
});

function md5(value: string): string {
  return require("node:crypto").createHash("md5").update(value).digest("hex");
}
