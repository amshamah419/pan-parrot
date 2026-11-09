import { describe, expect, it } from "vitest";
import { mockFromIntegrationYaml } from "./xsoar-yaml";

const YAML = `
name: HelloWorld
display: Hello World
script:
  commands:
    - name: hello-world
      description: Say hello. GET /hello
      outputs:
        - contextPath: Hello.Message
          type: String
        - contextPath: Hello.Count
          type: Number
    - name: ping
      arguments:
        - name: host
`;

describe("integration YAML", () => {
  it("builds one operation per command", () => {
    const spec = mockFromIntegrationYaml(YAML);
    expect(spec.source.name).toBe("Hello World");
    expect(spec.source.fidelity).toBe("shape");
    expect(spec.operations.map((operation) => [operation.method, operation.pathTemplate])).toEqual([
      ["GET", "/hello"],
      ["GET", "/ping"],
    ]);
    expect(spec.operations[1].record.children?.[0].name).toBe("host");
  });
});
