import { localName, parseXml, type XmlElement } from "./xml";

export interface BodyMatch {
  /** JSONPath starting with `$` or an XPath starting with `/`. */
  path: string;
  /** When omitted, the path only has to exist. */
  equals?: string;
}

const MAX_STEPS = 8;
const MAX_VISITS = 200;

/**
 * JSONPath: `$.a.b`, `$.items[0].id`, `$.items[*].id`, `$..status`,
 * and `$.items[?(@.status=="closed")]`. One `==` comparison. No `&&`, `||`, or scripts.
 */
export function matchJsonPath(body: string, spec: BodyMatch): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return false;
  }
  const values = readJsonPath(parsed, spec.path);
  if (!values.length) return false;
  if (spec.equals == null || spec.equals === "") return true;
  return values.some((value) => stringify(value) === spec.equals);
}

/**
 * XPath: `/a/b`, `/a/@status`, `//name`, `/a/b[2]`, `/a/b[@status="ok"]`,
 * and `/a/b[text()="ok"]`. One predicate. No functions besides `text()`.
 */
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

type Token =
  | { type: "key"; name: string }
  | { type: "index"; index: number }
  | { type: "wild" }
  | { type: "recurse"; name: string }
  | { type: "filter"; field: string; value: string };

function readJsonPath(value: unknown, path: string): unknown[] {
  const tokens = tokenizeJsonPath(path);
  if (!tokens) return [];
  let current: unknown[] = [value];
  for (const token of tokens) {
    current = stepJson(current, token);
    if (!current.length) return [];
  }
  return current.filter((item) => item !== undefined);
}

function tokenizeJsonPath(path: string): Token[] | null {
  if (!path.startsWith("$")) return null;
  const tokens: Token[] = [];
  let index = 1;
  while (index < path.length) {
    if (tokens.length >= MAX_STEPS) return null;
    if (path.startsWith("..", index)) {
      index += 2;
      const name = readIdent(path, index);
      if (!name) return null;
      tokens.push({ type: "recurse", name: name[0] });
      index = name[1];
      continue;
    }
    if (path[index] === ".") {
      index += 1;
      const name = readIdent(path, index);
      if (!name) return null;
      tokens.push({ type: "key", name: name[0] });
      index = name[1];
      continue;
    }
    if (path[index] === "[") {
      const end = path.indexOf("]", index);
      if (end < 0) return null;
      const inner = path.slice(index + 1, end).trim();
      index = end + 1;
      if (inner === "*") {
        tokens.push({ type: "wild" });
        continue;
      }
      if (/^\d+$/.test(inner)) {
        tokens.push({ type: "index", index: Number(inner) });
        continue;
      }
      if (inner.startsWith("?(") && inner.endsWith(")")) {
        const filter = inner.slice(2, -1).trim();
        const match = filter.match(/^@\.([A-Za-z_][A-Za-z0-9_]*)==(?:"([^"]*)"|'([^']*)'|(-?\d+|true|false))$/);
        if (!match) return null;
        tokens.push({ type: "filter", field: match[1], value: match[2] ?? match[3] ?? match[4] });
        continue;
      }
      return null;
    }
    return null;
  }
  return tokens;
}

function readIdent(path: string, index: number): [string, number] | null {
  const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(path.slice(index));
  if (!match) return null;
  return [match[0], index + match[0].length];
}

function stepJson(current: unknown[], token: Token): unknown[] {
  if (token.type === "key") {
    return current.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      return [(item as Record<string, unknown>)[token.name]];
    });
  }
  if (token.type === "index") {
    return current.flatMap((item) => (Array.isArray(item) ? [item[token.index]] : []));
  }
  if (token.type === "wild") {
    return current.flatMap((item) => {
      if (Array.isArray(item)) return item;
      if (item && typeof item === "object") return Object.values(item as Record<string, unknown>);
      return [];
    });
  }
  if (token.type === "filter") {
    return current.flatMap((item) => {
      if (!Array.isArray(item)) return [];
      return item.filter((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
        return stringify((entry as Record<string, unknown>)[token.field]) === token.value;
      });
    });
  }
  const found: unknown[] = [];
  let visits = 0;
  const walk = (item: unknown) => {
    if (visits >= MAX_VISITS || item == null || typeof item !== "object") return;
    visits += 1;
    if (Array.isArray(item)) {
      for (const entry of item) walk(entry);
      return;
    }
    const record = item as Record<string, unknown>;
    if (token.name in record) found.push(record[token.name]);
    for (const entry of Object.values(record)) walk(entry);
  };
  for (const item of current) walk(item);
  return found;
}

type Predicate =
  | { type: "index"; index: number }
  | { type: "attr"; name: string; value: string }
  | { type: "text"; value: string };

interface Step {
  name: string;
  descendant: boolean;
  predicate?: Predicate;
  attribute?: string;
}

function readXPath(root: XmlElement, path: string): string | null {
  const steps = parseXPath(path);
  if (!steps) return null;
  let nodes: XmlElement[] = [root];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (step.attribute) {
      if (index !== steps.length - 1) return null;
      const element = nodes[0];
      const attr = element?.attributes.find((item) => item.name === step.attribute || localName(item.name) === step.attribute);
      return attr ? attr.value : null;
    }
    if (index === 0 && !step.descendant && localName(root.name) === step.name) {
      nodes = [root];
    } else {
      nodes = step.descendant ? descendantsNamed(nodes, step.name) : childrenNamed(nodes, step.name);
    }
    if (step.predicate) nodes = applyPredicate(nodes, step.predicate);
    if (!nodes.length) return null;
  }
  return nodes[0]?.text ?? null;
}

function parseXPath(path: string): Step[] | null {
  if (!path.startsWith("/") || path.length > 200) return null;
  const descendantRoot = path.startsWith("//");
  const raw = path.split("/").filter((part) => part.length > 0);
  if (!raw.length || raw.length > MAX_STEPS) return null;
  const steps: Step[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const parsed = parseStep(raw[index]);
    if (!parsed) return null;
    parsed.descendant = descendantRoot && index === 0;
    steps.push(parsed);
  }
  return steps;
}

function parseStep(part: string): Step | null {
  if (part.startsWith("@")) {
    if (!/^@[A-Za-z_][\w.-]*$/.test(part)) return null;
    return { name: "", descendant: false, attribute: part.slice(1) };
  }
  const match = part.match(/^([A-Za-z_][\w.-]*)(?:\[([^[\]]+)\])?$/);
  if (!match) return null;
  const step: Step = { name: match[1], descendant: false };
  if (match[2]) {
    const predicate = parsePredicate(match[2]);
    if (!predicate) return null;
    step.predicate = predicate;
  }
  return step;
}

function parsePredicate(inner: string): Predicate | null {
  if (/^\d+$/.test(inner)) {
    const index = Number(inner);
    if (index < 1) return null;
    return { type: "index", index };
  }
  const attr = inner.match(/^@([A-Za-z_][\w.-]*)=(?:"([^"]*)"|'([^']*)')$/);
  if (attr) return { type: "attr", name: attr[1], value: attr[2] ?? attr[3] };
  const text = inner.match(/^text\(\)=(?:"([^"]*)"|'([^']*)')$/);
  if (text) return { type: "text", value: text[1] ?? text[2] };
  return null;
}

function childrenNamed(nodes: XmlElement[], name: string): XmlElement[] {
  return nodes.flatMap((node) => node.children.filter((child) => localName(child.name) === name));
}

function descendantsNamed(nodes: XmlElement[], name: string): XmlElement[] {
  const found: XmlElement[] = [];
  let visits = 0;
  const walk = (element: XmlElement) => {
    if (visits >= MAX_VISITS) return;
    visits += 1;
    if (localName(element.name) === name) found.push(element);
    for (const child of element.children) walk(child);
  };
  for (const node of nodes) walk(node);
  return found;
}

function applyPredicate(nodes: XmlElement[], predicate: Predicate): XmlElement[] {
  if (predicate.type === "index") return nodes[predicate.index - 1] ? [nodes[predicate.index - 1]] : [];
  if (predicate.type === "text") return nodes.filter((node) => node.text === predicate.value);
  return nodes.filter((node) =>
    node.attributes.some((attr) => (attr.name === predicate.name || localName(attr.name) === predicate.name) && attr.value === predicate.value),
  );
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
