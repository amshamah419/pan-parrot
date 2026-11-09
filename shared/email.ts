import { POLICY } from "./policy";

const LOCAL_PART =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?$/;

/**
 * Normalize an address and accept it only when the domain is exactly
 * paloaltonetworks.com. Returns null for anything else, including
 * subdomains, trailing dots, unicode lookalikes, and plus-tricks that
 * would land on a different domain.
 *
 * Plus-addressing on the real domain (name+tag@paloaltonetworks.com)
 * is allowed: the domain is unchanged, and mail still has to be
 * delivered there before a session exists.
 */
export function normalizePanEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;

  const normalized = input.normalize("NFKC").trim().toLowerCase();
  if (!normalized || normalized.length > 254) return null;
  if (/[^\x00-\x7F]/.test(normalized)) return null;
  if (/[\s\u0000-\u001f\u007f<>()[\]\\,;:"]/.test(normalized)) return null;
  if (normalized.endsWith(".")) return null;

  const at = normalized.indexOf("@");
  if (at <= 0 || at !== normalized.lastIndexOf("@")) return null;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || !domain) return null;
  if (domain !== POLICY.allowedDomain) return null;
  if (local.length > 64) return null;
  if (!LOCAL_PART.test(local)) return null;
  if (local.includes("..")) return null;

  return `${local}@${domain}`;
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/\+.*/, "") || "user";
  const words = local.replace(/[._-]+/g, " ").trim();
  const titled = words.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  return titled.slice(0, 80) || "User";
}
