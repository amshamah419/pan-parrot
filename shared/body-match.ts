import { localName, parseXml, type XmlElement } from "./xml";

export interface BodyMatch {
  /** JSONPath starting with `$` or an XPath starting with `/`. */
  path: string;
  /** When omitted, the path only has to exist. */
  equals?: string;
}

/** A small JSONPath: `$.a.b`, `$.items[0].id`. No filters, scripts, or wildcards. */
export function matchJsonPath(body: string, spec: BodyMatch): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return false;
  }
  const value = readJsonPath(parsed, spec.path);
  if (value === undefined) return false;
  if (spec.equals == null || spec.equals === "") return true;
  return stringify(value) === spec.equals;
}

/** A small XPath: `/a/b`, `/a/@status`, `//name`. No predicates. */
export function matchXPath(body: string, spec: BodyMatch): boolean {
  let root: XmlElement;
  try {
    root = parseXml(body);
  } catch {
    return false;
  }
  const value = readXPath(root, spec.path);
  if (value == null) return false;
  if (spec.equals == null || spec.equals === "") return true;
  return value === spec.equals;
}

export function bodyMatches(body: string, spec: BodyMatch | undefined): boolean {
  if (!spec?.path) return true;
  const path = spec.path.trim();
  if (path.startsWith("$")) return matchJsonPath(body, { ...spec, path });
  if (path.startsWith("/")) return matchXPath(body, { ...spec, path });
  return false;
}

function readJsonPath(value: unknown, path: string): unknown {
  if (!path.startsWith("$")) return undefined;
  const parts = path
    .slice(1)
    .split(/\.|\[|\]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length > 8) return undefined;
  let current: unknown = value;
  for (const part of parts) {
    if (current == null) return undefined;
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(current)) return undefined;
      current = current[Number(part)];
      continue;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) return undefined;
    if (typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function readXPath(root: XmlElement, path: string): string | null {
  if (path.startsWith("//")) {
    const name = path.slice(2).split("/")[0];
    if (!name || name.includes("@")) return null;
    const found = findByLocal(root, name);
    return found ? found.text : null;
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.length > 8) return null;
  let current: XmlElement | undefined = root;
  if (parts[0] && localName(root.name) !== parts[0].replace(/^@/, "")) {
    if (!parts[0].startsWith("@")) return null;
  }
  let index = localName(root.name) === parts[0] ? 1 : 0;
  if (parts[0]?.startsWith("@")) index = 0;
  for (; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.startsWith("@")) {
      const attr = current?.attributes.find((item) => item.name === part.slice(1));
      return attr ? attr.value : null;
    }
    current = current?.children.find((child) => localName(child.name) === part);
    if (!current) return null;
  }
  return current ? current.text : null;
}

function findByLocal(element: XmlElement, name: string): XmlElement | undefined {
  if (localName(element.name) === name) return element;
  for (const child of element.children) {
    const found = findByLocal(child, name);
    if (found) return found;
  }
  return undefined;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
