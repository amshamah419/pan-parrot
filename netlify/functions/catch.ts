import type { Config, Context } from "@netlify/functions";
import { createServer } from "../../server/app";
import { withClientIp } from "./_shared/request";

const app = createServer({ surface: "catch" });

export default function handler(request: Request, context: Context) {
  return app.fetch(withClientIp(request, context.ip));
}

export const config: Config = {
  path: "/catch/*",
};
