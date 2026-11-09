import type { FieldSpec } from "./mock-spec";

const MAX_CHARS = 256 * 1024;
const MAX_DEPTH = 32;
const MAX_NODES = 4_000;
const MAX_ATTRIBUTES = 40;

export interface XmlAttribute {
  name: string;
  prefix?: string;
  value: string;
}

export interface XmlElement {
  name: string;
  prefix?: string;
  namespace?: string;
  attributes: XmlAttribute[];
  children: XmlElement[];
  text: string;
}

export function parseXml(source: string): XmlElement {
  const text = source.replace(/^\uFEFF/, "");
  if (text.length > MAX_CHARS) throw new Error("XML document is too large");
  if (/<!DOCTYPE|<!ENTITY|<!ELEMENT|<!ATTLIST|<!NOTATION/i.test(text)) {
    throw new Error("XML DTD and entity declarations are not allowed");
  }
  const parser = new Parser(text);
  const roots = parser.parseNodes(0);
  const elements = roots.filter((node): node is XmlElement => typeof node !== "string");
  if (elements.length !== 1) throw new Error("XML document needs one root element");
  return elements[0];
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderXml(element: XmlElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>${renderElement(element)}`;
}

export function soapEnvelope(
  version: "1.1" | "1.2",
  inner: string,
  fault?: string,
): string {
  const ns =
    version === "1.2"
      ? "http://www.w3.org/2003/05/soap-envelope"
      : "http://schemas.xmlsoap.org/soap/envelope/";
  const body = fault
    ? version === "1.2"
      ? `<soap:Fault><soap:Code><soap:Value>soap:Receiver</soap:Value></soap:Code><soap:Reason><soap:Text>${escapeXml(fault)}</soap:Text></soap:Reason></soap:Fault>`
      : `<soap:Fault><faultcode>soap:Server</faultcode><faultstring>${escapeXml(fault)}</faultstring></soap:Fault>`
    : inner;
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${ns}"><soap:Body>${body}</soap:Body></soap:Envelope>`;
}

export function localName(value: string): string {
  const index = value.indexOf(":");
  return index === -1 ? value : value.slice(index + 1);
}

export function fieldsFromElement(element: XmlElement): FieldSpec {
  return elementToField(element);
}

export function renderFieldXml(
  field: FieldSpec,
  value: unknown,
  options?: { wrongNamespace?: boolean },
): string {
  const element = fieldToElement(field, value, options);
  if (options?.wrongNamespace && !element.namespace) {
    element.namespace = "http://wrong.example/ns";
  }
  return renderXml(element);
}

function renderElement(element: XmlElement): string {
  const name = element.prefix ? `${element.prefix}:${element.name}` : element.name;
  const attrs = element.attributes
    .map((attribute) => {
      const attrName = attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
      return ` ${attrName}="${escapeXml(attribute.value)}"`;
    })
    .join("");
  const ns = element.namespace
    ? element.prefix
      ? ` xmlns:${element.prefix}="${escapeXml(element.namespace)}"`
      : ` xmlns="${escapeXml(element.namespace)}"`
    : "";
  const inner =
    escapeXml(element.text) + element.children.map((child) => renderElement(child)).join("");
  if (!inner) return `<${name}${ns}${attrs}/>`;
  return `<${name}${ns}${attrs}>${inner}</${name}>`;
}

function fieldToElement(
  field: FieldSpec,
  value: unknown,
  options?: { wrongNamespace?: boolean },
): XmlElement {
  if (field.kind === "array") {
    const item = field.item || { name: "item", kind: "string" };
    const values = Array.isArray(value) ? value : [];
    return {
      name: field.name,
      attributes: [],
      children: values.map((entry) => fieldToElement(item, entry, options)),
      text: "",
    };
  }
  const namespace = field.xml?.namespace
    ? options?.wrongNamespace
      ? `${field.xml.namespace}/wrong`
      : field.xml.namespace
    : undefined;
  if (field.kind !== "object" || !field.children?.length) {
    return {
      name: field.name,
      prefix: field.xml?.prefix,
      namespace,
      attributes: [],
      children: [],
      text: value == null ? "" : String(value),
    };
  }
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const attributes: XmlAttribute[] = [];
  const children: XmlElement[] = [];
  for (const child of field.children) {
    if (record[child.name] == null && child.optional) continue;
    if (child.xml?.attribute) {
      attributes.push({
        name: child.name,
        prefix: child.xml.prefix,
        value: record[child.name] == null ? "" : String(record[child.name]),
      });
      continue;
    }
    if (child.kind === "array") {
      const item = child.item || { name: "item", kind: "string" };
      const values = Array.isArray(record[child.name]) ? (record[child.name] as unknown[]) : [];
      for (const entry of values) children.push(fieldToElement({ ...item, name: item.name || child.name }, entry, options));
      continue;
    }
    children.push(fieldToElement(child, record[child.name], options));
  }
  return {
    name: field.name,
    prefix: field.xml?.prefix,
    namespace,
    attributes,
    children,
    text: "",
  };
}

function elementToField(element: XmlElement): FieldSpec {
  const attributes: FieldSpec[] = element.attributes
    .filter((attribute) => attribute.name !== "xmlns" && !attribute.name.startsWith("xmlns:"))
    .map((attribute) => ({
      name: safeName(attribute.name),
      kind: "string" as const,
      example: attribute.value.slice(0, 80),
      xml: { attribute: true, prefix: attribute.prefix },
    }));
  const groups = new Map<string, XmlElement[]>();
  for (const child of element.children) {
    const key = child.name;
    groups.set(key, [...(groups.get(key) || []), child]);
  }
  const children: FieldSpec[] = [...attributes];
  for (const [name, items] of groups) {
    if (items.length > 1) {
      children.push({
        name: safeName(name),
        kind: "array",
        item: elementToField(items[0]),
        minItems: 1,
        maxItems: Math.min(5, items.length),
      });
    } else {
      children.push(elementToField(items[0]));
    }
  }
  if (children.length === 0) {
    return {
      name: safeName(element.name),
      kind: "string",
      example: element.text.slice(0, 80),
      xml: xmlMeta(element),
    };
  }
  return {
    name: safeName(element.name),
    kind: "object",
    children,
    xml: xmlMeta(element),
  };
}

function xmlMeta(element: XmlElement): FieldSpec["xml"] {
  if (!element.namespace && !element.prefix) return undefined;
  return { namespace: element.namespace, prefix: element.prefix };
}

function safeName(value: string): string {
  const name = localName(value).replace(/[^A-Za-z0-9_.:@$-]/g, "").slice(0, 80);
  return name || "field";
}

class Parser {
  private index = 0;
  private nodes = 0;

  constructor(private readonly text: string) {}

  parseNodes(depth: number): Array<XmlElement | string> {
    if (depth > MAX_DEPTH) throw new Error("XML nesting is too deep");
    const nodes: Array<XmlElement | string> = [];
    while (this.index < this.text.length) {
      if (this.text.startsWith("</", this.index)) break;
      if (this.text.startsWith("<!--", this.index)) {
        this.skipUntil("-->");
        continue;
      }
      if (this.text.startsWith("<?", this.index)) {
        this.skipUntil("?>");
        continue;
      }
      if (this.text.startsWith("<!", this.index)) {
        throw new Error("XML declarations other than elements are not allowed");
      }
      if (this.text[this.index] === "<") {
        nodes.push(this.parseElement(depth));
        continue;
      }
      const text = this.readText();
      if (text.trim()) nodes.push(text);
    }
    return nodes;
  }

  private parseElement(depth: number): XmlElement {
    this.nodes += 1;
    if (this.nodes > MAX_NODES) throw new Error("XML document has too many elements");
    this.index += 1;
    const qualified = this.readName();
    const { prefix, name } = splitName(qualified);
    const attributes = this.readAttributes();
    const namespaces = namespaceMap(attributes);
    const element: XmlElement = {
      name,
      prefix,
      namespace: prefix ? namespaces.get(prefix) : namespaces.get(""),
      attributes: attributes
        .filter((attribute) => attribute.name !== "xmlns" && attribute.prefix !== "xmlns")
        .map((attribute) => ({ name: attribute.name, prefix: attribute.prefix, value: attribute.value })),
      children: [],
      text: "",
    };
    this.skipSpace();
    if (this.text.startsWith("/>", this.index)) {
      this.index += 2;
      return element;
    }
    if (this.text[this.index] !== ">") throw new Error("XML element is not closed");
    this.index += 1;
    const inner = this.parseNodes(depth + 1);
    const close = `</${qualified}>`;
    if (!this.text.startsWith("</", this.index)) throw new Error("XML element is missing an end tag");
    const endName = this.readEndName();
    if (endName !== qualified) throw new Error("XML end tag does not match");
    const text = inner.filter((node): node is string => typeof node === "string").join("");
    element.text = text.trim();
    element.children = inner.filter((node): node is XmlElement => typeof node !== "string");
    return element;
  }

  private readAttributes(): XmlAttribute[] {
    const attributes: XmlAttribute[] = [];
    while (this.index < this.text.length) {
      this.skipSpace();
      if (this.text.startsWith("/>", this.index) || this.text[this.index] === ">") break;
      const qualified = this.readName();
      this.skipSpace();
      if (this.text[this.index] !== "=") throw new Error("XML attribute is missing a value");
      this.index += 1;
      this.skipSpace();
      const quote = this.text[this.index];
      if (quote !== '"' && quote !== "'") throw new Error("XML attribute value must be quoted");
      this.index += 1;
      const start = this.index;
      while (this.index < this.text.length && this.text[this.index] !== quote) this.index += 1;
      const raw = this.text.slice(start, this.index);
      this.index += 1;
      const { prefix, name } = splitName(qualified);
      attributes.push({ name, prefix, value: decodeEntities(raw) });
      if (attributes.length > MAX_ATTRIBUTES) throw new Error("XML element has too many attributes");
    }
    return attributes;
  }

  private readEndName(): string {
    this.index += 2;
    const name = this.readName();
    this.skipSpace();
    if (this.text[this.index] !== ">") throw new Error("XML end tag is malformed");
    this.index += 1;
    return name;
  }

  private readName(): string {
    const start = this.index;
    while (this.index < this.text.length && /[A-Za-z0-9_.:-]/.test(this.text[this.index])) this.index += 1;
    if (this.index === start) throw new Error("XML name is missing");
    return this.text.slice(start, this.index);
  }

  private readText(): string {
    const start = this.index;
    while (this.index < this.text.length && this.text[this.index] !== "<") this.index += 1;
    return decodeEntities(this.text.slice(start, this.index));
  }

  private skipUntil(marker: string) {
    const at = this.text.indexOf(marker, this.index);
    if (at === -1) throw new Error("XML comment or instruction is not closed");
    this.index = at + marker.length;
  }

  private skipSpace() {
    while (this.index < this.text.length && /\s/.test(this.text[this.index])) this.index += 1;
  }
}

function splitName(qualified: string): { prefix?: string; name: string } {
  const index = qualified.indexOf(":");
  if (index === -1) return { name: qualified };
  return { prefix: qualified.slice(0, index), name: qualified.slice(index + 1) };
}

function namespaceMap(attributes: XmlAttribute[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const attribute of attributes) {
    if (attribute.name === "xmlns" && !attribute.prefix) map.set("", attribute.value);
    if (attribute.prefix === "xmlns") map.set(attribute.name, attribute.value);
  }
  return map;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[A-Za-z]+);/g, (entity, body: string) => {
    if (body === "amp") return "&";
    if (body === "lt") return "<";
    if (body === "gt") return ">";
    if (body === "quot") return '"';
    if (body === "apos") return "'";
    if (body.startsWith("#x")) {
      const code = Number.parseInt(body.slice(2), 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) throw new Error("XML character reference is invalid");
      return String.fromCodePoint(code);
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) throw new Error("XML character reference is invalid");
      return String.fromCodePoint(code);
    }
    throw new Error("XML custom entities are not expanded");
  });
}
