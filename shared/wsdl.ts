import { defaultChaos, defaultPagination, type MockOperation, type MockSpec } from "./mock-spec";
import { fieldsFromElement, localName, parseXml, type XmlElement } from "./xml";

export function specFromXml(text: string): MockSpec {
  const root = parseXml(text);
  if (localName(root.name).toLowerCase() === "definitions") return specFromWsdl(root);
  const record = fieldsFromElement(root);
  return {
    version: 1,
    source: {
      kind: "sample",
      name: "Sample XML",
      fidelity: "generated",
      notes: ["Field names, attributes, and namespaces were inferred from the pasted XML."],
    },
    operations: [
      operation({
        id: "xml-sample",
        method: "POST",
        pathTemplate: "/",
        summary: "Respond with the pasted XML shape",
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        record,
      }),
    ],
    chaos: defaultChaos("xml"),
    totalRecords: 20,
    auth: { mode: "none" },
  };
}

function specFromWsdl(root: XmlElement): MockSpec {
  const operations = new Map<string, MockOperation>();
  const soap12 = contains(root, "http://schemas.xmlsoap.org/wsdl/soap12/");
  walk(root, (element) => {
    if (localName(element.name) !== "operation") return;
    const name = attribute(element, "name");
    if (!name) return;
    const action =
      attribute(element, "soapAction") ||
      element.children.map((child) => attribute(child, "soapAction")).find(Boolean) ||
      operations.get(name)?.soapAction;
    const record = fieldsFromElement({
      name,
      attributes: [],
      children: [
        {
          name: "result",
          attributes: [],
          children: [],
          text: "ok",
        },
      ],
      text: "",
      namespace: targetNamespace(root),
      prefix: "tns",
    });
    operations.set(name, operation({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "operation",
      method: "POST",
      pathTemplate: "/",
      summary: name,
      envelope: { type: "soap", version: soap12 ? "1.2" : "1.1" },
      contentType: soap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
      soapAction: action,
      requestElement: name,
      record,
    }));
  });
  if (operations.size === 0) throw new Error("WSDL did not contain any operations");
  return {
    version: 1,
    source: {
      kind: "wsdl",
      name: attribute(root, "name") || "SOAP service",
      fidelity: "generated",
      notes: [
        "Operations come from the WSDL. Embedded schemas are not fully expanded, so response elements are a small stand-in you can edit.",
      ],
      unsupported: ["WSDL imports, XML Schema complex types, and WS-Policy are not expanded."],
    },
    operations: [...operations.values()].slice(0, 40),
    chaos: defaultChaos("soap"),
    totalRecords: 20,
    auth: { mode: "none" },
  };
}

function operation(input: Omit<MockOperation, "headers" | "pagination" | "status" | "list"> & { status?: number }): MockOperation {
  return {
    status: input.status ?? 200,
    headers: {},
    list: false,
    pagination: { ...defaultPagination(), style: "none" },
    ...input,
  };
}

function walk(element: XmlElement, visit: (element: XmlElement) => void) {
  visit(element);
  for (const child of element.children) walk(child, visit);
}

function contains(element: XmlElement, uri: string): boolean {
  if (element.namespace === uri || element.attributes.some((attribute) => attribute.value === uri)) return true;
  return element.children.some((child) => contains(child, uri));
}

function attribute(element: XmlElement, name: string): string | undefined {
  return element.attributes.find((item) => item.name === name)?.value;
}

function targetNamespace(root: XmlElement): string | undefined {
  return attribute(root, "targetNamespace");
}
