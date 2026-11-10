export interface ClientCall {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

/** HTTP calls a demisto integration client makes, tied to a command name when the source says so. */
export function callForCommand(command: string, source: string): ClientCall | null {
  if (!source.trim()) return null;
  const functions = indexFunctions(source);
  const bound = commandFunction(command, source, functions);
  if (!bound) return null;
  return httpIn(bound.body, functions, 0);
}

function commandFunction(command: string, source: string, functions: Map<string, Fn>): Fn | null {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mapped = new RegExp(`['"]${escaped}['"]\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*)`, "i").exec(source);
  if (mapped && functions.has(mapped[1])) return functions.get(mapped[1]) || null;
  const guess = command.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return functions.get(`${guess}_command`) || functions.get(guess) || null;
}

function httpIn(body: string, functions: Map<string, Fn>, depth: number): ClientCall | null {
  const direct = firstHttp(body);
  if (direct) return direct;
  if (depth >= 1) return null;
  for (const match of body.matchAll(/\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const next = functions.get(match[1]);
    if (!next) continue;
    const nested = httpIn(next.body, functions, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function firstHttp(body: string): ClientCall | null {
  const request = /_http_request\(\s*['"](GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*f?['"]([^'"]+)['"]/i.exec(body);
  if (request) return call(request[1], request[2]);
  const verb = /['"](GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*f?['"]([^'"]+)['"]/i.exec(body);
  if (verb) return call(verb[1], verb[2]);
  const requests = /requests\.(get|post|put|patch|delete)\(\s*f?['"]([^'"]+)['"]/i.exec(body);
  if (requests) return call(requests[1], requests[2]);
  return null;
}

function call(method: string, rawPath: string): ClientCall | null {
  const path = cleanPath(rawPath);
  if (!path) return null;
  return { method: method.toUpperCase() as ClientCall["method"], path };
}

export function cleanPath(raw: string): string | null {
  let candidate = raw.trim();
  if (/^https?:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).pathname || "/";
    } catch {
      return null;
    }
  }
  candidate = candidate.split("?")[0];
  if (!candidate.startsWith("/")) candidate = `/${candidate}`;
  candidate = candidate.replace(/\$\{[^}]+\}/g, "{id}").replace(/\{[^}]+\}/g, "{id}");
  if (candidate.length > 180 || candidate.includes(" ") || candidate.includes("//")) return null;
  if (!/^\/[A-Za-z0-9_./{}-]+$/.test(candidate)) return null;
  return candidate.length > 1 && candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
}

interface Fn {
  name: string;
  body: string;
}

function indexFunctions(source: string): Map<string, Fn> {
  const lines = source.split("\n");
  const functions = new Map<string, Fn>();
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^([ \t]*)(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(lines[index]);
    if (!match) continue;
    const indent = match[1].replace(/\t/g, "    ").length;
    const body: string[] = [];
    let cursor = index + 1;
    for (; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!line.trim()) {
        body.push(line);
        continue;
      }
      const nextIndent = (line.match(/^[ \t]*/)?.[0] || "").replace(/\t/g, "    ").length;
      if (nextIndent <= indent) break;
      body.push(line);
    }
    if (!functions.has(match[2])) functions.set(match[2], { name: match[2], body: body.join("\n") });
    index = cursor - 1;
  }
  return functions;
}
