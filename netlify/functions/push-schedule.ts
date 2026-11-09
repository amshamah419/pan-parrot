import type { Config } from "@netlify/functions";
import { pushScheduleHandler } from "../../server/push";

/** Sends due webhook pushes. Production deploys only. One event per mock. */
export default function handler() {
  return pushScheduleHandler();
}

export const config: Config = {
  schedule: "*/15 * * * *",
};
