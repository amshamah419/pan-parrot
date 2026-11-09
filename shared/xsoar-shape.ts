import type { FieldSpec } from "./mock-spec";

const NAME_RE = /^[A-Za-z0-9_.:@$-]{1,80}$/;

export interface OutputField {
  contextPath?: string;
  type?: string;
}

/** Build a response object from XSOAR command outputs (contextPath + type). */
export function fieldsFromOutputs(outputs: OutputField[] | undefined): FieldSpec | null {
  const root: ObjNode = { kind: "object", children: new Map() };
  let count = 0;
  for (const output of outputs || []) {
    const parts = String(output.contextPath || "")
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) continue;
    insert(root, parts, output.type, 0);
    count += 1;
    if (count >= 80) break;
  }
  if (root.children.size === 0) return null;
  return toField("record", root);
}

function insert(node: ObjNode, parts: string[], type: string | undefined, depth: number) {
  if (depth > 6 || node.children.size >= 40) return;
  const name = safeName(parts[0]);
  if (!name) return;
  if (parts.length === 1) {
    if (!node.children.has(name)) node.children.set(name, { kind: "leaf", type });
    return;
  }
  let child = node.children.get(name);
  if (!child || child.kind !== "object") {
    child = { kind: "object", children: new Map() };
    node.children.set(name, child);
  }
  insert(child, parts.slice(1), type, depth + 1);
}

function toField(name: string, node: Node): FieldSpec {
  if (node.kind === "leaf") return leaf(name, node.type);
  return {
    name,
    kind: "object",
    children: [...node.children.entries()].map(([childName, child]) => toField(childName, child)),
  };
}

function leaf(name: string, type: string | undefined): FieldSpec {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "boolean" || normalized === "bool") return { name, kind: "boolean" };
  if (normalized === "number" || normalized === "integer") {
    return { name, kind: /(?:^id$|Id$)/.test(name) ? "id" : "number" };
  }
  if (normalized.includes("date") || normalized.includes("time")) {
    return { name, kind: "timestamp", format: "iso" };
  }
  if (/(?:^id$|Id$|_id$)/i.test(name)) return { name, kind: "id" };
  return { name, kind: "string", example: name };
}

function safeName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_.:@$-]/g, "").slice(0, 80);
  if (!cleaned || !NAME_RE.test(cleaned)) return "";
  return cleaned;
}

type ObjNode = { kind: "object"; children: Map<string, Node> };
type Node = ObjNode | { kind: "leaf"; type?: string };

/** Pull the first JSON object or array from a README code fence. */
export function sampleFromReadme(markdown: string): string | null {
  for (const match of markdown.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/gi)) {
    const text = match[1].trim();
    if (!text.startsWith("{") && !text.startsWith("[")) continue;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
    } catch {
      continue;
    }
  }
  return null;
}
