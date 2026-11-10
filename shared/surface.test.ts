import { describe, expect, it } from "vitest";
import { ipInCidrs, validCidrList } from "./cidr";
import { CATCH_ID_BYTES, catchIdBits, isAdminSurface, isBadCrawler, isScannerPath } from "./surface";
import { signGate, verifyGate } from "./gate-cookie";

describe("public surface", () => {
  it("treats generated catch ids as 128 bits", () => {
    expect(CATCH_ID_BYTES).toBe(16);
    expect(catchIdBits()).toBe(128);
  });

  it("blocks common scanner paths and leaves catch urls alone", () => {
    expect(isScannerPath("/.env")).toBe(true);
    expect(isScannerPath("/.git/config")).toBe(true);
    expect(isScannerPath("/wp-admin/install.php")).toBe(true);
    expect(isScannerPath("/xmlrpc.php")).toBe(true);
    expect(isScannerPath("/cgi-bin/test")).toBe(true);
    expect(isScannerPath("/catch/abcdefghij")).toBe(false);
    expect(isScannerPath("/api/health")).toBe(false);
  });

  it("flags known scanner user agents", () => {
    expect(isBadCrawler("sqlmap/1.7")).toBe(true);
    expect(isBadCrawler("Mozilla/5.0")).toBe(false);
    expect(isBadCrawler("python-requests/2.31")).toBe(false);
  });

  it("recognizes the admin surface", () => {
    expect(isAdminSurface("/admin")).toBe(true);
    expect(isAdminSurface("/api/admin/users")).toBe(true);
    expect(isAdminSurface("/dashboard")).toBe(false);
  });

  it("matches an address inside a CIDR and rejects the rest", () => {
    expect(validCidrList("10.0.0.0/8, 192.168.1.9")).toBe(true);
    expect(validCidrList("not-an-ip")).toBe(false);
    expect(ipInCidrs("10.1.2.3", "10.0.0.0/8")).toBe(true);
    expect(ipInCidrs("11.0.0.1", "10.0.0.0/8")).toBe(false);
    expect(ipInCidrs("192.168.1.9", "192.168.1.9")).toBe(true);
  });

  it("signs a gate cookie that expires", async () => {
    const secret = "test-session-secret-should-be-32b!!";
    const token = await signGate(Math.floor(Date.now() / 1000) + 60, secret);
    expect(await verifyGate(token, secret)).toBe(true);
    expect(await verifyGate(token, "other-session-secret-should-be-32b!!")).toBe(false);
    const expired = await signGate(Math.floor(Date.now() / 1000) - 10, secret);
    expect(await verifyGate(expired, secret)).toBe(false);
  });
});
