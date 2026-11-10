/** What revert would change. Values of secret-looking fields are not included. */

const SECRET = /token|secret|password|credential|authorization|api[-_ ]?key/i;

type Op = {
  method?: string;
  pathTemplate?: string;
  status?: number;
  record?: unknown;
};

export function revertDiff(current: unknown, previous: unknown): string[] {
  const now = indexOps(current);
  const then = indexOps(previous);
  const lines: string[] = [];
  for (const [label, op] of then) {
    const live = now.get(label);
    if (!live) {
      lines.push(`Revert would add ${label}.`);
      continue;
    }
    if (live.status !== op.status) {
      lines.push(`Revert would change ${label} status from ${live.status ?? "unset"} to ${op.status ?? "unset"}.`);
    }
    lines.push(...fieldLines(label, live.record, op.record));
  }
  for (const label of now.keys()) {
    if (!then.has(label)) lines.push(`Revert would remove ${label}.`);
  }
  if (!lines.length) return ["The spec would not change."];
  return lines.slice(0, 12);
}

function indexOps(spec: unknown): Map<string, Op> {
  const operations = spec && typeof spec === "object" && Array.isArray((spec as { operations?: unknown }).operations)
    ? ((spec as { operations: unknown[] }).operations)
    : [];
  const map = new Map<string, Op>();
  for (const item of operations) {
    if (!item || typeof item !== "object") continue;
    const op = item as Op;
    const method = String(op.method || "GET").toUpperCase();
    const path = String(op.pathTemplate || "/");
    map.set(`${method} ${path}`, op);
  }
  return map;
}

function fieldLines(label: string, current: unknown, previous: unknown): string[] {
  const now = fieldMap(current);
  const then = fieldMap(previous);
  const lines: string[] = [];
  for (const [name, value] of then) {
    if (!now.has(name)) {
      lines.push(`Revert would add field ${label} ${name}.`);
      continue;
    }
    const live = now.get(name);
    if (live !== value) {
      lines.push(
        SECRET.test(name)
          ? `Revert would change ${label} ${name}.`
          : `Revert would change ${label} ${name} from ${live} to ${value}.`,
      );
    }
  }
  for (const name of now.keys()) {
    if (!then.has(name)) lines.push(`Revert would remove field ${label} ${name}.`);
  }
  return lines;
}

function fieldMap(record: unknown, prefix = ""): Map<string, string> {
  const map = new Map<string, string>();
  if (!record || typeof record !== "object") return map;
  const field = record as { name?: string; kind?: string; constValue?: unknown; children?: unknown[] };
  const name = prefix || String(field.name || "body");
  if (field.kind === "const") {
    const shown = SECRET.test(name) ? "set" : JSON.stringify(field.constValue).slice(0, 40);
    map.set(name, shown);
  }
  if (Array.isArray(field.children)) {
    for (const child of field.children) {
      if (!child || typeof child !== "object") continue;
      const childName = String((child as { name?: string }).name || "field");
      const path = prefix ? `${prefix}.${childName}` : childName;
      for (const [key, value] of fieldMap({ ...(child as object), name: path }, path)) {
        map.set(key, value);
      }
    }
  }
  return map;
}
