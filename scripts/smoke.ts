import { runSmoke } from "../server/smoke";

const base = process.argv[2];
if (!base || base === "--help") {
  console.error("Usage: npm run smoke -- https://your-site.example");
  console.error("Optional: PAN_PARROT_TOKEN=pp_... to create, call, and delete one mock.");
  process.exit(2);
}

const report = await runSmoke(base, { token: process.env.PAN_PARROT_TOKEN });
for (const check of report.checks) {
  console.log(`${check.ok ? "ok  " : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
}
if (!report.ok) process.exit(1);
