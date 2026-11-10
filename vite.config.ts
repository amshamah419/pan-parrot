import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { verifyGate } from "./shared/gate-cookie";
import { isBadCrawler, isScannerPath } from "./shared/surface";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./client", "./shared", "./server", "./db"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), apiDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});

function cookieValue(header: string | string[] | undefined, name: string): string {
  const raw = Array.isArray(header) ? header.join(";") : header || "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function apiDevPlugin(): Plugin {
  return {
    name: "pan-parrot-api",
    apply: "serve",
    async configureServer(server) {
      const loginHtml = readFileSync(path.resolve("public/login.html"));
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "/").split("?")[0] || "/";
        if (url.startsWith("/api") || url.startsWith("/catch")) return next();
        const ua = Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"];
        if (isScannerPath(url) || isBadCrawler(ua)) {
          res.statusCode = 404;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.setHeader("x-robots-tag", "noindex, nofollow, noarchive");
          res.end("Not found");
          return;
        }
        if (url === "/login") {
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.setHeader("x-robots-tag", "noindex, nofollow, noarchive");
          res.end(loginHtml);
          return;
        }
        const secret = process.env.SESSION_SECRET || "";
        const authed = await verifyGate(cookieValue(req.headers.cookie, "pp_gate"), secret);
        if (authed || url === "/login.js" || url === "/login.css" || url === "/login.html" || url === "/robots.txt" || url === "/favicon.ico" || url === "/404.html") {
          return next();
        }
        if (url === "/") {
          res.statusCode = 302;
          res.setHeader("location", "/login");
          res.end();
          return;
        }
        res.statusCode = 404;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.setHeader("x-robots-tag", "noindex, nofollow, noarchive");
        res.end("Not found");
      });
      const loaded = (await server.ssrLoadModule("/server/index.ts")) as {
        createServer: () => { fetch: (request: Request) => Promise<Response> | Response };
      };
      const { getRequestListener } = await import("@hono/node-server");
      const app = loaded.createServer();
      const listener = getRequestListener(app.fetch);
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (url.startsWith("/api") || url.startsWith("/catch")) {
          void listener(req, res);
          return;
        }
        next();
      });
    },
  };
}
