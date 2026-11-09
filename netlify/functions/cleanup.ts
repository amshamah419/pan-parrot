import type { Config } from "@netlify/functions";
import { maintenanceHandler } from "../../server/app";

/** Deletes expired captures, sessions, and rate-limit rows. Production deploys only. */
export default function handler() {
  return maintenanceHandler();
}

export const config: Config = {
  schedule: "@daily",
};
