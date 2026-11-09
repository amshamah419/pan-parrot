import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createServer } from "./app";

const api = createServer();
const app = new Hono();

app.all("/api/*", (c) => api.fetch(c.req.raw));
app.all("/catch/*", (c) => api.fetch(c.req.raw));
app.use("*", serveStatic({ root: "./dist/spa" }));
app.get("*", async (c, next) => {
  if (c.req.path.startsWith("/api") || c.req.path.startsWith("/catch")) {
    return c.json({ error: "Not found" }, 404);
  }
  const staticFile = serveStatic({ root: "./dist/spa", path: "index.html" });
  return staticFile(c, next);
});

const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`PAN Parrot listening on http://localhost:${port}`);
});
