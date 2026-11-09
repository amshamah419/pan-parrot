export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function readLimitedText(
  request: Request,
  limit: number,
): Promise<string> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > limit) {
    throw new HttpError(413, "Payload too large");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new HttpError(413, "Payload too large");
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

export async function readJson(
  request: Request,
  limit: number,
): Promise<unknown> {
  const text = await readLimitedText(request, limit);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

export function clientIp(headers: Headers): string {
  const netlifyIp = headers.get("x-nf-client-connection-ip")?.trim();
  if (netlifyIp && isIp(netlifyIp)) return netlifyIp;
  if (process.env.NODE_ENV !== "production") {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded && isIp(forwarded)) return forwarded;
  }
  return "unknown";
}

function isIp(value: string): boolean {
  return value.length <= 64 && /^[0-9a-fA-F:.]+$/.test(value);
}
