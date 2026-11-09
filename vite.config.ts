import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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

function apiDevPlugin(): Plugin {
  return {
    name: "pan-parrot-api",
    apply: "serve",
    async configureServer(server) {
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
