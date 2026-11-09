import { describe, expect, it } from "vitest";
import { assertPublicHttpsUrl, headersForRedirect, isBlockedAddress } from "./ssrf";
import { HttpError } from "./http";

describe("spec URL checks", () => {
  it("blocks private, loopback, and link-local addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.20",
      "172.16.0.5",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fd00::1",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("1.1.1.1")).toBe(false);
  });

  it("rejects non-public spec URLs before any fetch", () => {
    for (const url of [
      "http://example.com/openapi.json",
      "https://127.0.0.1/openapi.json",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/openapi.json",
      "https://metadata.google.internal/spec",
      "https://user:pass@example.com/openapi.json",
      "https://example.com:8443/openapi.json",
      "https://10.0.0.5/openapi.json",
      "https://app.internal/openapi.yaml",
    ]) {
      expect(() => assertPublicHttpsUrl(url), url).toThrow(HttpError);
    }
  });

  it("accepts a normal https URL", () => {
    const url = assertPublicHttpsUrl("https://example.com/openapi.yaml");
    expect(url.hostname).toBe("example.com");
  });

  it("drops credential headers when a redirect changes host", () => {
    const headers = new Headers({
      authorization: "Bearer super-secret-token",
      cookie: "session=abc",
      accept: "application/json",
    });
    const same = headersForRedirect(
      new URL("https://api.example.com/a"),
      new URL("https://api.example.com/b"),
      headers,
    );
    expect(same.get("authorization")).toBe("Bearer super-secret-token");
    const moved = headersForRedirect(
      new URL("https://api.example.com/a"),
      new URL("https://cdn.example.com/b"),
      headers,
    );
    expect(moved.get("authorization")).toBeNull();
    expect(moved.get("cookie")).toBeNull();
    expect(moved.get("accept")).toBe("application/json");
  });
});
