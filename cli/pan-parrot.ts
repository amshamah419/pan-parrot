import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export interface CliIo {
  env: Record<string, string | undefined>;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readConfig: () => Promise<string | null>;
  writeConfig: (text: string) => Promise<void>;
  writeFile: (file: string, text: string) => Promise<void>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const HELP = `pan-parrot <command>

  login --url https://your-site --token pp_...
  mocks
  create --name "My mock" --yaml integration.yml
  create --name "My mock" --preset github-github
  export <endpoint-id> --out ./tests

The token is a personal API token from the dashboard. It is stored in
~/.config/pan-parrot/credentials.json and is not printed again.
PAN_PARROT_URL and PAN_PARROT_TOKEN override that file.
`;

export async function run(argv: string[], io: CliIo = defaultIo()): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (!command || command === "help" || command === "--help") {
      io.stdout(HELP);
      return 0;
    }
    if (command === "login") return await login(rest, io);
    if (command === "mocks") return await mocks(io);
    if (command === "create") return await create(rest, io);
    if (command === "export") return await exportMock(rest, io);
    io.stderr(`Unknown command ${command}\n${HELP}`);
    return 1;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : "Command failed");
    return 1;
  }
}

async function login(args: string[], io: CliIo): Promise<number> {
  const url = flag(args, "--url");
  const token = flag(args, "--token");
  if (!url || !token?.startsWith("pp_")) throw new Error("login needs --url and --token pp_...");
  const parsed = new URL(url);
  await io.writeConfig(JSON.stringify({ url: parsed.origin, token }));
  io.stdout(`Saved a token for ${parsed.origin}`);
  return 0;
}

async function mocks(io: CliIo): Promise<number> {
  const rows = (await api(io, "/api/endpoints")) as Array<{ id: string; name: string; url: string }>;
  if (!rows.length) {
    io.stdout("No mocks yet.");
    return 0;
  }
  for (const row of rows) io.stdout(`${row.id}\t${row.name}\t${row.url}`);
  return 0;
}

async function create(args: string[], io: CliIo): Promise<number> {
  const name = flag(args, "--name");
  if (!name) throw new Error("create needs --name");
  const yamlPath = flag(args, "--yaml");
  const preset = flag(args, "--preset");
  let mockSpec: unknown;
  if (yamlPath) {
    const text = await readFile(yamlPath, "utf8");
    const imported = (await api(io, "/api/specs/import", {
      method: "POST",
      body: JSON.stringify({ kind: "spec", text }),
    })) as { mockSpec: unknown };
    mockSpec = imported.mockSpec;
  } else if (preset) {
    if (!/^[a-z0-9-]{1,80}$/.test(preset)) throw new Error("Preset id is not valid");
    const { url } = await credentials(io);
    const response = await io.fetch(`${url}/presets/integrations/${preset}.json`);
    if (!response.ok) throw new Error("Preset was not found");
    const presetBody = (await response.json()) as { spec?: unknown };
    mockSpec = presetBody.spec;
  } else {
    throw new Error("create needs --yaml or --preset");
  }
  const endpoint = (await api(io, "/api/endpoints", {
    method: "POST",
    body: JSON.stringify({ name, mockSpec }),
  })) as { id: string; url: string };
  io.stdout(`${endpoint.id}\t${endpoint.url}`);
  return 0;
}

async function exportMock(args: string[], io: CliIo): Promise<number> {
  const id = args.find((arg) => !arg.startsWith("--"));
  const out = flag(args, "--out") || ".";
  if (!id) throw new Error("export needs an endpoint id");
  const body = (await api(io, `/api/endpoints/${encodeURIComponent(id)}/export`)) as {
    files: Record<string, string>;
  };
  for (const [name, text] of Object.entries(body.files || {})) {
    const file = path.join(out, name);
    await io.writeFile(file, text);
    io.stdout(file);
  }
  return 0;
}

async function api(io: CliIo, pathname: string, init: RequestInit = {}): Promise<unknown> {
  const { url, token } = await credentials(io);
  const response = await io.fetch(`${url}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      // The body was not JSON.
    }
    throw new Error(message);
  }
  return text ? JSON.parse(text) : {};
}

async function credentials(io: CliIo): Promise<{ url: string; token: string }> {
  let stored: { url?: string; token?: string } = {};
  const raw = await io.readConfig();
  if (raw) {
    try {
      stored = JSON.parse(raw) as { url?: string; token?: string };
    } catch {
      throw new Error("Credentials file is not valid JSON");
    }
  }
  const url = io.env.PAN_PARROT_URL || stored.url;
  const token = io.env.PAN_PARROT_TOKEN || stored.token;
  if (!url || !token) throw new Error("Run pan-parrot login, or set PAN_PARROT_URL and PAN_PARROT_TOKEN");
  return { url: url.replace(/\/$/, ""), token };
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function defaultIo(): CliIo {
  const config = process.env.PAN_PARROT_CONFIG || path.join(homedir(), ".config", "pan-parrot", "credentials.json");
  return {
    env: process.env,
    fetch,
    readConfig: async () => {
      try {
        return await readFile(config, "utf8");
      } catch {
        return null;
      }
    },
    writeConfig: async (text) => {
      await mkdir(path.dirname(config), { recursive: true });
      await writeFile(config, text, { mode: 0o600 });
      await chmod(config, 0o600);
    },
    writeFile: (file, text) => writeFile(file, text, "utf8"),
    stdout: (text) => console.log(text),
    stderr: (text) => console.error(text),
  };
}

if (process.argv[1] && process.argv[1].endsWith("pan-parrot.ts")) {
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
