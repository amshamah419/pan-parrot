import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const secret = "test-session-secret-should-be-long";

describe("signed sessions", () => {
  it("round-trips a session id and expiry", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = signSession({ sid: "11111111-1111-1111-1111-111111111111", exp }, secret);
    expect(verifySession(token, secret)).toEqual({
      sid: "11111111-1111-1111-1111-111111111111",
      exp,
    });
  });

  it("rejects a different secret, a flipped signature, and an expired token", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = signSession(
      { sid: "11111111-1111-1111-1111-111111111111", exp },
      secret,
    );
    expect(
      verifySession(token, "another-secret-that-is-also-32ch"),
    ).toBeNull();

    const [payload, signature] = token.split(".");
    const flipped = `${signature.slice(0, -1)}${signature.endsWith("a") ? "b" : "a"}`;
    expect(verifySession(`${payload}.${flipped}`, secret)).toBeNull();

    const expired = signSession(
      { sid: "11111111-1111-1111-1111-111111111111", exp: Math.floor(Date.now() / 1000) - 5 },
      secret,
    );
    expect(verifySession(expired, secret)).toBeNull();
  });

  it("rejects a tampered payload and unsigned junk", () => {
    const token = signSession(
      {
        sid: "11111111-1111-1111-1111-111111111111",
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      secret,
    );
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        sid: "22222222-2222-2222-2222-222222222222",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString("base64url");
    expect(verifySession(`${forged}.${signature}`, secret)).toBeNull();
    expect(verifySession("not-a-token", secret)).toBeNull();
    expect(verifySession(undefined, secret)).toBeNull();
  });
});
