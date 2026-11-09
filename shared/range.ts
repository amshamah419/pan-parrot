/** A single `bytes=` range. Multiple ranges are left for the caller to ignore. */
export function singleByteRange(
  total: number,
  header: string | undefined,
): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const value = header.trim().toLowerCase();
  if (!value.startsWith("bytes=") || value.includes(",")) return value.startsWith("bytes=") ? "invalid" : null;
  const spec = value.slice("bytes=".length).trim();
  const match = /^(\d*)-(\d*)$/.exec(spec);
  if (!match || total <= 0) return "invalid";
  if (match[1] === "" && match[2] === "") return "invalid";
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!suffix) return "invalid";
    const start = Math.max(0, total - suffix);
    return { start, end: total - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === "" ? total - 1 : Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= total) return "invalid";
  return { start, end: Math.min(end, total - 1) };
}
