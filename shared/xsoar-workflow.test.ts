import { describe, expect, it } from "vitest";
import { generateMockResponse } from "./generate";
import { buildIntegrationMock } from "./xsoar-workflow";
import { contentDirectoryUrl } from "../server/xsoar-content";

const YAML = `
name: HelloWorld
display: Hello World
commonfields:
  id: HelloWorld
configuration:
  - display: Server URL
    name: url
    type: 0
    required: true
script:
  commands:
    - name: hello-world
      description: Say hello. GET /docs-only
      outputs:
        - contextPath: Hello.Message
          type: String
    - name: ping
      arguments:
        - name: host
    - name: silent
      description: No outputs and no arguments
`;

const CLIENT = `
def hello_world_command(client, args):
    return client.say_hello(args.get("name"))

class Client:
    def say_hello(self, name):
        return self._http_request("GET", "/hello/{name}")

def main():
    commands = {"hello-world": hello_world_command}
`;

describe("integration in progress", () => {
  it("uses the client path, seeds test_data, and lists a command with no mock", () => {
    const built = buildIntegrationMock({
      yaml: YAML,
      clientSource: CLIENT,
      testData: [
        { name: "test_data/hello_world.json", text: JSON.stringify({ Message: "hi", Count: 2 }) },
      ],
    });
    const hello = built.spec.operations.find((operation) => operation.id === "hello-world");
    const ping = built.spec.operations.find((operation) => operation.id === "ping");
    expect(hello?.method).toBe("GET");
    expect(hello?.pathTemplate).toBe("/hello/{id}");
    expect(hello?.fixture).toBe(JSON.stringify({ Message: "hi", Count: 2 }));
    expect(ping?.pathTemplate).toBe("/ping");
    expect(ping?.record.children?.[0].name).toBe("host");
    expect(built.spec.operations.some((operation) => operation.id === "silent")).toBe(false);
    expect(built.spec.source.coverage).toEqual([
      { command: "hello-world", operationId: "hello-world", response: "test_data", pathFrom: "client", fixture: "hello_world.json" },
      { command: "ping", operationId: "ping", response: "arguments", pathFrom: "command-name", fixture: undefined },
      { command: "silent", operationId: undefined, response: "none", pathFrom: "none", fixture: undefined },
    ]);
    expect(built.spec.source.xsoar?.brand).toBe("HelloWorld");
    const body = generateMockResponse({
      spec: built.spec,
      operation: hello!,
      pathParams: {},
      query: {},
      requestIndex: 1,
    });
    expect(JSON.parse(body.body)).toEqual({ Message: "hi", Count: 2 });
  });

  it("lets a mapping replace the client path and unwraps mock_response", () => {
    const built = buildIntegrationMock({
      yaml: YAML,
      clientSource: CLIENT,
      mappings: [{ command: "hello-world", method: "POST", path: "/v2/hello" }],
      testData: [
        {
          name: "hello-world.json",
          text: JSON.stringify({ args: {}, mock_response: { Message: "wrapped" } }),
        },
      ],
    });
    const hello = built.spec.operations[0];
    expect(hello.pathTemplate).toBe("/v2/hello");
    expect(hello.method).toBe("POST");
    expect(built.spec.source.coverage?.[0].pathFrom).toBe("mapped");
    expect(JSON.parse(hello.fixture || "")).toEqual({ Message: "wrapped" });
  });

  it("keeps a description path when the client does not name the command", () => {
    const built = buildIntegrationMock({ yaml: YAML });
    expect(built.spec.operations[0].pathTemplate).toBe("/docs-only");
    expect(built.spec.source.coverage?.[0]).toMatchObject({ response: "outputs", pathFrom: "description" });
    expect(built.spec.source.fidelity).toBe("shape");
  });

  it("rejects a content path that is not a demisto integration directory", () => {
    expect(contentDirectoryUrl("Packs/HelloWorld/Integrations/HelloWorld")).toBe(
      "https://api.github.com/repos/demisto/content/contents/Packs/HelloWorld/Integrations/HelloWorld?ref=master",
    );
    expect(() => contentDirectoryUrl("https://example.com/secret")).toThrow(/Packs\/Name/);
    expect(() => contentDirectoryUrl("Packs/../Integrations/HelloWorld")).toThrow(/Packs\/Name/);
  });
});
