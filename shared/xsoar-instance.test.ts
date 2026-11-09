import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateMockSpec, type XsoarIntegration } from "./mock-spec";
import { instanceGuide, xsoarFromDocument } from "./xsoar-instance";
import { mockFromIntegrationYaml } from "./xsoar-yaml";

const github = {
  name: "GitHub",
  display: "GitHub",
  commonfields: { id: "GitHub" },
  configuration: [
    { name: "url", display: "Server URL", type: 0, defaultvalue: "https://api.github.com" },
    { name: "api_token", type: 9, displaypassword: "API Token" },
    { name: "credentials", display: "Credentials", type: 9 },
    { name: "token", display: "API Token", type: 4, hidden: true },
    { name: "insecure", display: "Trust any certificate (not secure)", type: 8, defaultvalue: "false" },
    { name: "proxy", display: "Use system proxy settings", type: 8 },
    { name: "isFetch", display: "Fetch incidents", type: 8 },
    { name: "fetch_time", display: "First fetch interval (in days)", type: 0, defaultvalue: "3" },
    { name: "user", display: "Repository owner", type: 0 },
  ],
};

const panorama: XsoarIntegration = {
  brand: "Panorama",
  display: "Palo Alto Networks PAN-OS",
  params: [
    { name: "server", display: "Server URL", type: 0, required: true },
    { name: "port", display: "Port", type: 0, defaultValue: "443" },
    { name: "credentials", display: "Credentials", type: 9, passwordLabel: "API Key" },
    { name: "key", display: "API Key (Deprecated)", type: 4 },
    { name: "insecure", display: "Trust any certificate (not secure)", type: 8 },
    { name: "proxy", display: "Use system proxy settings", type: 8 },
    { name: "isFetch", display: "Fetch incidents", type: 8 },
    { name: "first_fetch", display: "First fetch timestamp", type: 0, defaultValue: "24 hours" },
  ],
};

describe("XSOAR instance guide", () => {
  it("keeps the parameters a developer pastes and drops hidden duplicates", () => {
    const integration = xsoarFromDocument(github);
    expect(integration?.brand).toBe("GitHub");
    expect(integration?.params.map((param) => param.name)).toEqual([
      "url",
      "insecure",
      "proxy",
      "isFetch",
      "fetch_time",
      "api_token",
      "credentials",
      "user",
    ]);
    const guide = instanceGuide(integration, { mode: "none" }, "http://localhost:8080/catch/demo/");
    expect(guide?.rows.find((row) => row.name === "url")?.value).toBe("http://localhost:8080/catch/demo");
    expect(guide?.rows.find((row) => row.name === "insecure")?.value).toBe("true");
    expect(guide?.rows.find((row) => row.name === "proxy")?.value).toBe("false");
    expect(guide?.rows.find((row) => row.name === "isFetch")?.value).toBe("false");
    expect(guide?.rows.find((row) => row.name === "fetch_time")?.value).toBe("3");
    expect(guide?.rows.some((row) => row.name === "token")).toBe(false);
    const downloaded = JSON.parse(guide?.download?.json || "{}") as { data: Array<{ name: string; value: unknown }> };
    expect(downloaded.data.find((item) => item.name === "url")?.value).toBe("http://localhost:8080/catch/demo");
    expect(downloaded.data.find((item) => item.name === "insecure")?.value).toBe(true);
    expect(downloaded.data.find((item) => item.name === "api_token")).toBeUndefined();
  });

  it("puts the PAN-OS dummy API key in the credentials password", () => {
    const guide = instanceGuide(panorama, {
      mode: "panos-key",
      panos: { username: "lab-admin", password: "dummy-not-a-real-password", apiKey: "dummy-panos-api-key" },
    }, "http://localhost:8080/catch/pan");
    const credentials = guide?.rows.find((row) => row.name === "credentials");
    expect(credentials?.value).toBe("dummy-panos-api-key");
    expect(credentials?.note).toMatch(/password box/);
    expect(guide?.rows.find((row) => row.name === "port")?.value).toBe("8080");
    expect(guide?.rows.some((row) => row.name === "key")).toBe(false);
    const downloaded = JSON.parse(guide?.download?.json || "{}") as { brand: string; data: Array<{ name: string; value: { password?: string } }> };
    expect(downloaded.brand).toBe("Panorama");
    expect(downloaded.data.find((item) => item.name === "credentials")?.value.password).toBe("dummy-panos-api-key");
  });

  it("returns nothing when the YAML has no configuration list", () => {
    expect(xsoarFromDocument({ name: "Hello", script: { commands: [] } })).toBeUndefined();
    expect(instanceGuide(undefined, { mode: "none" }, "http://localhost/catch/x")).toBeNull();
  });

  it("stores the configuration on a mock built from integration YAML", () => {
    const spec = mockFromIntegrationYaml(`
name: HelloWorld
display: Hello World
commonfields:
  id: HelloWorld
configuration:
  - display: Server URL
    name: url
    type: 0
    required: true
  - display: API Key
    name: apikey
    type: 4
    required: true
  - display: Trust any certificate (not secure)
    name: insecure
    type: 8
  - display: Use system proxy settings
    name: proxy
    type: 8
script:
  commands:
    - name: hello-world
      description: GET /hello
      outputs:
        - contextPath: Hello.Message
          type: String
`);
    expect(spec.source.xsoar?.brand).toBe("HelloWorld");
    const guide = instanceGuide(spec.source.xsoar, { mode: "api-key", apiKey: { in: "header", name: "x-api-key", value: "dummy-key" } }, "https://parrot.example/catch/hello");
    expect(guide?.rows.find((row) => row.name === "apikey")?.value).toBe("dummy-key");
    expect(guide?.rows.find((row) => row.name === "url")?.value).toBe("https://parrot.example/catch/hello");
    expect(guide?.rows.find((row) => row.name === "port")).toBeUndefined();
    const again = validateMockSpec(spec);
    expect(again.source.xsoar?.params.map((param) => param.name)).toContain("apikey");
  });

  it("fills each Akamai credential from the edgegrid dummy values", () => {
    const guide = instanceGuide({
      brand: "Akamai WAF SIEM",
      display: "Akamai WAF SIEM",
      params: [
        { name: "host", display: "Server URL", type: 0, required: true },
        { name: "clienttoken_creds", display: "Client token", type: 9, passwordLabel: "Client token" },
        { name: "accesstoken_creds", display: "Access token", type: 9, passwordLabel: "Access token" },
        { name: "clientsecret_creds", display: "Client secret", type: 9, passwordLabel: "Client secret" },
      ],
    }, {
      mode: "edgegrid",
      edgegrid: { clientToken: "dummy-client", accessToken: "dummy-access", clientSecret: "dummy-secret", verify: "signature" },
    }, "https://parrot.example/catch/akamai");
    expect(guide?.rows.find((row) => row.name === "host")?.value).toBe("https://parrot.example/catch/akamai");
    expect(guide?.rows.find((row) => row.name === "clienttoken_creds")?.value).toBe("dummy-client");
    expect(guide?.rows.find((row) => row.name === "accesstoken_creds")?.value).toBe("dummy-access");
    expect(guide?.rows.find((row) => row.name === "clientsecret_creds")?.value).toBe("dummy-secret");
  });

  it("ships parameter names for the curated presets", () => {
    const catalog = JSON.parse(readFileSync("public/presets/instance-params.json", "utf8")) as Record<string, XsoarIntegration>;
    expect(catalog["github-github"].params.some((param) => param.name === "url")).toBe(true);
    expect(catalog["pan-os-panorama"].params.some((param) => param.name === "server")).toBe(true);
    expect(catalog["akamai-waf-siem"].brand).toBe("Akamai WAF SIEM");
  });
});
