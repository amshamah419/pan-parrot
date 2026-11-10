import { verifyGate } from "../../shared/gate-cookie";
import { ipInCidrs } from "../../shared/cidr";
import { isAdminSurface, isBadCrawler, isScannerPath } from "../../shared/surface";

const PUBLIC = new Set(["/login", "/login.html", "/login.js", "/login.css", "/robots.txt", "/favicon.ico", "/404.html"]);

export default async (request: Request, context: { ip: string; next: () => Promise<Response> }) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const secret = Netlify.env.get("SESSION_SECRET") || "";
  if (isScannerPath(path) || (isBadCrawler(request.headers.get("user-agent")) && !path.startsWith("/catch/"))) {
    return notFound();
  }
  if (isAdminSurface(path) && !adminAllowed(context.ip)) return notFound();
  if (path.startsWith("/api/") || path.startsWith("/catch/") || PUBLIC.has(path)) {
    return strip(await context.next());
  }
  const gate = await verifyGate(readCookie(request, "pp_gate"), secret);
  if (!gate) {
    if (path === "/") return Response.redirect(new URL("/login", url), 302);
    return notFound();
  }
  return strip(await context.next());
};

export const config = { path: "/*" };

function adminAllowed(ip: string): boolean {
  const raw = Netlify.env.get("ADMIN_IP_ALLOWLIST")?.trim();
  if (!raw) return true;
  return ipInCidrs(ip, raw);
}

function readCookie(request: Request, name: string): string {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-content-type-options": "nosniff",
    },
  });
}

function strip(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete("x-powered-by");
  headers.delete("server");
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return new Response(response.body, { status: response.status, headers });
}

declare const Netlify: { env: { get(name: string): string | undefined } };
