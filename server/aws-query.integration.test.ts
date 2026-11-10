import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { validateMockSpec, type MockSpec } from "../shared/mock-spec";
import { awsQueryVerifiedPresets } from "../shared/verified-presets-aws";
import { createServer } from "./app";
import { applySqlMigrations } from "./test/migrate";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret-should-be-32b!!";
process.env.AUTH_DEV_EXPOSE_CODE = "true";
process.env.ADMIN_EMAILS = "ashamah@paloaltonetworks.com";
process.env.SITE_URL = "http://127.0.0.1:8080";
process.env.RATE_AUTH_IP_MAX = "10000";
process.env.RATE_AUTH_EMAIL_MAX = "10000";
process.env.RATE_AUTH_VERIFY_IP_MAX = "10000";
process.env.RATE_AUTH_VERIFY_EMAIL_MAX = "10000";
process.env.RATE_API_USER_MAX = "10000";
process.env.RATE_CATCH_IP_MAX = "10000";
process.env.RATE_CATCH_ENDPOINT_MAX = "10000";

const script = `
import json, sys
import boto3
from botocore.config import Config
sts_url, sqs_url = sys.argv[1], sys.argv[2]
cfg = Config(retries={"max_attempts": 1}, connect_timeout=5, read_timeout=10)
base = dict(region_name="us-east-1", verify=False, config=cfg)
long_term = dict(aws_access_key_id="AKIA_DUMMY", aws_secret_access_key="dummy-secret-key", **base)
sts = boto3.client("sts", endpoint_url=sts_url, **long_term)
assumed = sts.assume_role(RoleArn="arn:aws:iam::123456789012:role/pan-parrot", RoleSessionName="pan-parrot")
creds = assumed["Credentials"]
assert creds["AccessKeyId"] == "ASIADUMMYEXAMPLE0001", creds
assert creds["SecretAccessKey"] == "dummy-secret-key"
assert creds["SessionToken"] == "dummy-session-token"
assert assumed["AssumedRoleUser"]["Arn"].endswith(":assumed-role/pan-parrot/pan-parrot")
session = dict(
    aws_access_key_id=creds["AccessKeyId"],
    aws_secret_access_key=creds["SecretAccessKey"],
    aws_session_token=creds["SessionToken"],
    **base,
)
caller = boto3.client("sts", endpoint_url=sts_url, **session).get_caller_identity()
assert caller["Account"] == "123456789012", caller
assert "assumed-role/pan-parrot" in caller["Arn"]
queue = "https://sqs.us-east-1.amazonaws.com/123456789012/pan-parrot"
sqs = boto3.client("sqs", endpoint_url=sqs_url, **session)
page = sqs.receive_message(QueueUrl=queue, MaxNumberOfMessages=2)
assert len(page["Messages"]) == 2, page
assert page["Messages"][0]["Body"].startswith("{")
handle = page["Messages"][0]["ReceiptHandle"]
sqs.delete_message(QueueUrl=queue, ReceiptHandle=handle)
again = sqs.receive_message(QueueUrl=queue, MaxNumberOfMessages=1)
assert again["Messages"][0]["ReceiptHandle"] == handle
print(json.dumps({"account": caller["Account"], "messages": len(page["Messages"])}))
`;

describe("boto3 assumed role against STS and SQS", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });
  let server: ReturnType<typeof serve>;
  let port = 0;
  let cookie = "";

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
    const requested = await app.request("/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:8080" },
      body: JSON.stringify({ email: "ashamah@paloaltonetworks.com" }),
    });
    const pending = await requested.json();
    const verified = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:8080" },
      body: JSON.stringify({ email: "ashamah@paloaltonetworks.com", code: pending.devCode }),
    });
    cookie = (verified.headers.get("set-cookie") || "").split(";")[0];
    server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server.on("listening", () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("assumes a role and then receives and deletes an SQS message", async () => {
    const sts = awsQueryVerifiedPresets.find((preset) => preset.id === "aws-sts-aws-sts");
    const sqs = awsQueryVerifiedPresets.find((preset) => preset.id === "aws-sqs-fetch");
    if (!sts || !sqs) throw new Error("missing presets");
    await create(app, cookie, "awsts", sts.spec);
    await create(app, cookie, "awssqs", sqs.spec);
    const ran = await runBoto(port, "awsts", "awssqs");
    expect(ran.status, `${ran.stdout}\n${ran.stderr}`).toBe(0);
    expect(ran.stdout).toContain('"messages": 2');
  });

  it("accepts a real boto3 signature when the check is on and rejects a bad one", async () => {
    const sts = awsQueryVerifiedPresets.find((preset) => preset.id === "aws-sts-aws-sts");
    const sqs = awsQueryVerifiedPresets.find((preset) => preset.id === "aws-sqs-fetch");
    if (!sts || !sqs || !sts.spec.auth.sigv4 || !sqs.spec.auth.sigv4) throw new Error("missing presets");
    const stsOn = validateMockSpec({
      ...sts.spec,
      auth: { ...sts.spec.auth, sigv4: { ...sts.spec.auth.sigv4, verify: true } },
    });
    const sqsOn = validateMockSpec({
      ...sqs.spec,
      auth: { ...sqs.spec.auth, sigv4: { ...sqs.spec.auth.sigv4, verify: true } },
    });
    await create(app, cookie, "stscheck", stsOn);
    await create(app, cookie, "sqscheck", sqsOn);
    const missing = await fetch(`http://127.0.0.1:${port}/catch/stscheck`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "Action=GetCallerIdentity",
    });
    expect(missing.status).toBe(403);
    expect(await missing.text()).toContain("<Code>MissingAuthenticationToken</Code>");
    const ran = await runBoto(port, "stscheck", "sqscheck");
    expect(ran.status, `${ran.stdout}\n${ran.stderr}`).toBe(0);
  });
});

function runBoto(port: number, stsPath: string, sqsPath: string): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("python3", ["-c", script, `http://127.0.0.1:${port}/catch/${stsPath}`, `http://127.0.0.1:${port}/catch/${sqsPath}`]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => resolve({ status: status ?? 1, stdout, stderr }));
  });
}

async function create(app: ReturnType<typeof createServer>, cookie: string, path: string, mockSpec: MockSpec) {
  validateMockSpec(mockSpec);
  const created = await app.request("/api/endpoints", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: path, customPath: path, mockSpec }),
  });
  expect(created.status).toBe(200);
}
