// Deno does not resolve extensionless imports. Netlify's edge bundler fails
// the deploy if these specifiers omit `.ts`.
import { verifyGate } from "../../shared/gate-cookie.ts";
import { ipInCidrs } from "../../shared/cidr.ts";
import { isAdminSurface, isBadCrawler, isScannerPath } from "../../shared/surface.ts";

const PUBLIC = new Set([
  "/login",
  "/login.html",
  "/login.js",
  "/login.css",
  "/logo.webp",
  "/robots.txt",
  "/favicon.ico",
  "/404.html",
]);

export default async (request: Request, context: { ip: string; next: () => Promise<Response> }) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const secret = Netlify.env.get("SESSION_SECRET") || "";
  if (isScannerPath(path) || (isBadCrawler(request.headers.get("user-agent")) && !path.startsWith("/catch/"))) {
    return notFound();
  }
  if (isAdminSurface(path) && !adminAllowed(context.ip)) return notFound();
  if (path.startsWith("/api/") || path.startsWith("/catch/") || PUBLIC.has(path)) {
    return passThrough(context);
  }
  const gate = await verifyGate(readCookie(request, "pp_gate"), secret);
  if (!gate) {
    if (path === "/") return Response.redirect(new URL("/login", url), 302);
    return notFound();
  }
  // Presets and the SPA bundle are static files. Copying context.next()'s body
  // into a new Response makes the production edge runtime return 503 for the
  // catalog (public/presets/index.json is about 433 KB). The gate check above
  // is enough; the origin file is not buffered here.
  return passThrough(context);
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

async function passThrough(context: { next: () => Promise<Response> }): Promise<Response> {
  const response = await context.next();
  try {
    response.headers.delete("x-powered-by");
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  } catch {
    // Static-file headers can be immutable. Returning the original response
    // still avoids copying the body.
  }
  return response;
}

declare const Netlify: { env: { get(name: string): string | undefined } };
