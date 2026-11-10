/** IPv4 address or CIDR. A bare address is treated as /32. */
export function ipInCidrs(ip: string, list: string): boolean {
  const rules = list.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  if (!rules.length) return false;
  return rules.some((rule) => ipInCidr(ip, rule));
}

export function validCidrList(list: string): boolean {
  const rules = list.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  return rules.length > 0 && rules.length <= 20 && rules.every((rule) => parseCidr(rule) !== null);
}

function ipInCidr(ip: string, rule: string): boolean {
  const parsed = parseCidr(rule);
  const address = parseIpv4(ip);
  if (!parsed || address === null) return false;
  const mask = parsed.bits === 0 ? 0 : (0xffffffff << (32 - parsed.bits)) >>> 0;
  return (address & mask) === (parsed.address & mask);
}

function parseCidr(rule: string): { address: number; bits: number } | null {
  const [host, bitsText] = rule.split("/");
  const address = parseIpv4(host || "");
  if (address === null) return null;
  const bits = bitsText === undefined ? 32 : Number(bitsText);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  return { address, bits };
}

function parseIpv4(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
}
