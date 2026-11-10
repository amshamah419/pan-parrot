/** Paths scanners request. Matched before any app code or database work. */
const SCANNER_EXACT = new Set([
  "/.env",
  "/.git",
  "/.git/config",
  "/.aws/credentials",
  "/.svn",
  "/.hg",
  "/wp-admin",
  "/wp-login.php",
  "/xmlrpc.php",
  "/administrator",
  "/phpmyadmin",
  "/server-status",
  "/actuator",
  "/actuator/health",
  "/cgi-bin",
  "/vendor/phpunit",
]);

const SCANNER_PREFIXES = [
  "/wp-admin/",
  "/wp-content/",
  "/wp-includes/",
  "/.git/",
  "/.svn/",
  "/.env",
  "/cgi-bin/",
  "/phpmyadmin/",
  "/administrator/",
  "/vendor/phpunit/",
];

const BAD_UA = [
  "sqlmap",
  "nikto",
  "nmap",
  "masscan",
  "zgrab",
  "nuclei",
  "dirbuster",
  "gobuster",
  "wpscan",
  "acunetix",
  "nessus",
  "semrush",
  "ahrefs",
  "mj12bot",
  "dotbot",
  "petalbot",
  "bytespider",
  "gptbot",
  "claudebot",
  "ccbot",
  "scrapy",
];

export function isScannerPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.toLowerCase() || "/";
  if (SCANNER_EXACT.has(path)) return true;
  if (SCANNER_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (path.endsWith(".php") || path.endsWith(".asp") || path.endsWith(".aspx") || path.endsWith(".jsp")) {
    return true;
  }
  return false;
}

export function isBadCrawler(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return false;
  return BAD_UA.some((name) => ua.includes(name));
}

/** A personal token is `pp_` plus 32 bytes of base64url. The edge only checks the shape. */
export function agentBearerLooksValid(header: string | null | undefined): boolean {
  return /^Bearer pp_[A-Za-z0-9_-]{43,80}$/.test((header || "").trim());
}

export function isAdminSurface(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin");
}

/** Generated catch ids are 16 bytes (128 bits), base64url without padding (22 chars). */
export const CATCH_ID_BYTES = 16;

export function catchIdBits(): number {
  return CATCH_ID_BYTES * 8;
}
