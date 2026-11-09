import { describe, expect, it } from "vitest";
import { parseXml, renderFieldXml } from "./xml";
import { specFromXml } from "./wsdl";
import { validateMockSpec } from "./mock-spec";

describe("xml", () => {
  it("reads attributes and refuses a DTD", () => {
    const root = parseXml(`<response status="success"><result><key>abc</key></result></response>`);
    expect(root.attributes[0].value).toBe("success");
    expect(root.children[0].children[0].text).toBe("abc");
    expect(() => parseXml(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`)).toThrow(/DTD/);
    expect(() => parseXml(`<foo>&custom;</foo>`)).toThrow(/custom entities/);
  });

  it("renders an element with an attribute and a wrong namespace", () => {
    const xml = renderFieldXml(
      {
        name: "response",
        kind: "object",
        xml: { namespace: "urn:lab" },
        children: [
          { name: "status", kind: "const", constValue: "success", xml: { attribute: true } },
          { name: "key", kind: "const", constValue: "dummy" },
        ],
      },
      { status: "success", key: "dummy" },
    );
    expect(xml).toContain('status="success"');
    expect(xml).toContain("<key>dummy</key>");
    expect(renderFieldXml(
      { name: "response", kind: "const", constValue: "ok" },
      "ok",
      { wrongNamespace: true },
    )).toContain("http://wrong.example/ns");
  });

  it("imports a WSDL operation and a sample document", () => {
    const wsdl = validateMockSpec(specFromXml(`
      <definitions name="Lab" xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/">
        <portType><operation name="GetThing"/></portType>
        <binding><operation name="GetThing"><soap:operation soapAction="urn:GetThing"/></operation></binding>
      </definitions>`));
    expect(wsdl.operations[0].envelope).toEqual({ type: "soap", version: "1.1" });
    expect(wsdl.operations[0].soapAction).toBe("urn:GetThing");
    const sample = validateMockSpec(specFromXml(`<event id="1"><src>203.0.113.5</src></event>`));
    expect(sample.operations[0].envelope.type).toBe("xml");
  });
});
