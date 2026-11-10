import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { mockFromSample } from "../shared/infer";
import { validateMockSpec, type FieldSpec, type MockOperation, type MockSpec } from "../shared/mock-spec";
import { fieldsFromOutputs, sampleFromReadme, type OutputField } from "../shared/xsoar-shape";

const contentRoot = process.argv.includes("--content")
  ? process.argv[process.argv.indexOf("--content") + 1]
  : "";
const outDir = path.resolve("public/presets");
const integrationDir = path.join(outDir, "integrations");

if (!contentRoot) {
  console.error("Usage: npm run presets:import -- --content /path/to/demisto/content");
  process.exit(1);
}

const curatedIds = new Set([
  "akamai-waf-siem",
  "okta-okta-v2",
  "crowdstrikefalcon-crowdstrikefalcon",
  "microsoftgraphsecurity-microsoftgraphsecurity",
  "virustotal-virustotalv3",
  "jira-jirav3",
  "servicenow-servicenowv2",
  "slack-slackv3",
  "proofpointtap-proofpointtap-v2",
  "zscaler-zscaler",
  "azuresentinel-azuresentinel",
  "gsuitesecurityalertcenter-gsuitesecurityalertcenter",
  "ciscoumbrellareporting-ciscoumbrellareporting",
  "microsoft365defender-microsoft365defender",
  "splunkpy-splunkpy",
  "pan-os-panorama",
  "palo-alto-networks-wildfire-palo-alto-networks-wildfire-v2",
  "mimecast-mimecastv2",
  "github-github",
  "microsoftdefenderadvancedthreatprotection-microsoftdefenderadvancedthreatprotect",
  "cortexxdr-cortexxdrir",
  "qradar-qradar-v3",
  "elasticsearch-elasticsearch-v2",
  "gmail-gmail",
  "microsoftexchangeonpremise-ewsv2",
  "cortexdatalake-cortexdatalake",
  "aws-guardduty-awsguardduty",
  "tenable-io-tenable-io",
  "rapid7-insightidr-rapid7-insightidr",
  "sentinelone-sentinelone-v2",
  "carbonblackdefense-carbonblackendpointstandardv3",
  "prismacloud-prismacloudv2",
  "microsoftgraphuser-microsoftgraphuser",
  "azureactivedirectory-azureadidentityprotection",
  "aws-securityhub-aws-securityhub",
  "qualys-qualysv2",
  "wiz-wiz",
  "sophoscentral-sophoscentral",
  "darktrace-darktrace",
  "sekoiaxdr-sekoiaxdr",
  "amp-ampv2",
  "googlecloudscc-googlecloudscc",
  "azuresecuritycenter-microsoftdefenderforcloudeventcollector",
  "microsoftgraphmail-microsoftgraphmail",
  "netskope-netskopeeventcollector",
  "orca-orcaeventcollector",
  "extrahop-extrahop-v2",
  "proofpointthreatresponse-proofpointthreatresponse",
  "ciscoemailsecurity-ciscoemailsecurity",
  "zimperium-zimperiumv2",
  "checkpointhec-checkpointhec",
  "googlechroniclebackstory-googlechroniclebackstory",
  "prismacloudcompute-paloaltonetworks-prismacloudcompute",
  "vectraxdr-vectraxdr",
  "tenable-sc-tenable-sc",
  "infobloxbloxone-infobloxbloxonethreatdefense",
  "devo-devo",
  "lacework-lacework",
  "logrhythm-logrhythm",
  "securonix-securonix",
  "abnormalsecurity-abnormalsecurity",
  "cofensetriage-cofensetriagev3",
  "trendmicrovisionone-trendmicrovisiononev3",
  "cybereason-cybereason",
  "fortisiem-fortisiemv2",
  "azureloganalytics-azureloganalytics",
  "sumologic-cloud-siem-sumologiccloudsiem",
  "abusedb-abusedb",
  "shodan-shodan-v2",
  "urlhaus-urlhaus",
  "alienvault-otx-alienvault-otx-v2",
  "greynoise-greynoise",
  "greynoise-greynoise-community",
  "recordedfuture-recordedfuture",
  "anomali-threatstream-anomalithreatstreamv3",
  "misp-mispv3",
  "threatconnect-threatconnectv3",
  "urlscan-urlscan",
  "malwarebazaar-malwarebazaar",
  "phishtank-phishtankv2",
  "ipinfo-ipinfo-v2",
  "domaintools-iris-domaintools-iris",
  "threatq-threatq-v2",
  "eclecticiq-eclecticiqintelligencecenterv3",
  "freshworksfreshservice-freshworksfreshservice",
  "zendesk-zendeskv2",
  "pagerduty-pagerduty",
  "opsgenie-opsgeniev3",
  "microsoftgraphgroups-microsoftgraphgroups",
  "microsoftgraphapplications-microsoftgraphapplications",
  "microsoftgraphidentityandaccess-microsoftgraphidentityandaccess",
  "cyberarkpas-cyberarkpas",
  "cyberark-aim-cyberarkaim-v2",
  "sailpointidentitynow-sailpointidentitynow",
  "sailpointidentityiq-sailpointidentityiq",
  "duoadminapi-duoadminapi",
  "feedurlhaus-feedurlhaus",
  "openphish-openphish-v2",
  "crowdstrikeopenapi-crowdstrikeopenapi",
  "crowdstrikefalconstreamingv2-crowdstrikefalconstreamingv2",
  "crowdstrikeintel-crowdstrikefalconintel-v2",
  "crowdstrikemalquery-crowdstrikemalquery",
  "sentinelone-sentineloneeventcollector",
  "carbonblackdefense-carbonblackliveresponsecloud",
  "carbonblackenterpriseedr-carbonblackenterpriseedr",
  "carbon-black-enterprise-response-carbonblackresponsev2",
  "fireeyehx-fireeyehxv2",
  "fireeyeetp-fireeyeetp",
  "taniumthreatresponse-taniumthreatresponsev2",
  "tanium-tanium-v2",
  "sophosxgfirewall-sophosxgfirewall",
  "carbonblackdefense-carbonblackendpointstandardeventcollector",
  "mimecast-mimecasteventcollectorv2",
  "abnormalsecurity-abnormalsecurityeventcollector",
  "microsoftgraphmail-microsoftgraphlistener",
  "gmailsingleuser-gmailsingleuser",
  "cofenseintelligencev2-cofenseintelligencev2",
  "cofensevision-cofensevision",
  "proofpointthreatprotection-proofpointthreatprotection",
  "proofpointserverprotection-proofpointprotectionserverv2",
  "aws-ec2-aws-ec2",
  "aws-iam-aws-iam",
  "aws-cloudtrail-aws-cloudtrail",
  "aws-guardduty-awsguarddutyeventcollector",
  "aws-securityhub-aws-securityhub-v2",
  "aws-accessanalyzer-aws-accessanalyzer",
  "azuresecuritycenter-azuresecuritycenter-v2",
  "gcp-iam-gcpiam",
  "googlecloudcompute-googlecloudcompute",
  "prismacloud-prismacloudiam",
  "microsoftcloudappsecurity-microsoftcloudappsecurity",
  "fireeyehelix-fireeyehelix",
  "aws-sts-aws-sts",
  "aws-sqs-fetch",
  "prismaaccess-prismaaccess",
  "prismaaccess-prismasase",
  "cortexxpanse-cortexxpanse",
  "autofocus-autofocusv2",
  "palo-alto-networks-wildfire-wildfirereports",
  "cortexxdr-xdr-iocs",
  "cortexxdr-xqlqueryingengine",
  "paloaltonetworks-threat-vault-threatvaultv2",
  "palo-alto-networks-enterprise-dlp-palo-alto-networks-enterprise-dlp",
  "paloaltonetworks-devicesecurity-paloaltonetworks-devicesecurity",
  "dspm-dspm",
  "prismasaassecurity-saassecurity",
  "cortexattacksurfacemanagement-cortexattacksurfacemanagement",
  "paloaltonetworks-iot-paloaltonetworks-iot",
  "paloaltonetworks-prisma-airs-prismaairsruntime",
  "prismaaccess-prismaaccessegressipfeed",
  "paloaltonetworksaiops-paloaltonetworksaiops",
  "cortexxpanse-feedxpanse",
  "paloaltonetworks-securityadvisories-paloaltonetworkssecurityadvisories",
  "fortigate-fortigate",
  "ciscoasa-ciscoasa",
  "ciscofirepower-ciscofirepower",
  "checkpointfirewall-checkpointfirewallv2",
  "splunkpy-splunkpyv2",
  "elasticsearch-elasticsearcheventcollector",
  "sumologic-sumologic",
  "cisco-ise-cisco-ise",
  "cisco-meraki-ciscomerakiv2",
  "zscaler-zscalerzidentity",
  "checkpointndr-checkpointndr",
  "fortisandbox-fortisandboxv2",
  "fortimanager-fortimanager",
  "ciscowsa-ciscowsav2",
  "ciscostealthwatch-ciscostealthwatch",
  "rapid7-nexpose-rapid7-nexpose",
  "rapid7insightvmcloud-rapid7insightvmcloud",
  "qualysfim-qualysfim",
  "nessus-nessus",
  "joesecurity-joesecurityv2",
  "anyrun-anyrunsandbox",
  "anyrun-anyrunlookup",
  "vmray-vmray",
  "crowdstrikefalconsandbox-crowdstrikefalconsandboxv2",
  "crowdstrikefalconx-crowdstrikefalconx",
  "microsoftteams-microsoftteams",
  "microsoftteams-microsoftteamsmanagement",
  "microsoftteams-microsoftteamswebhook",
  "microsoftgraphteams-microsoftgraphteams",
  "atlassianjiraservicemanagement-atlassianjiraservicemanagement",
  "jira-jiraeventcollector",
  "servicenow-servicenow-cmdb",
  "servicenow-servicenoweventcollector",
  "servicenow-servicenow-iam",
  "slack-slackeventcollector",
  "slack-slack-iam",
  "ciscospark-ciscospark",
  "netskope-netskopeapiv2",
  "netskopev2-netskopev2",
  "netskope-netskopeeventcollector-v2",
  "skyhighsecurity-skyhighsecurity",
  "mcafeewebgateway-skyhighsecurewebgatewayonprem",
  "symantecdlp-symantecdlpv2",
  "forcepointdlp-forcepointeventcollector",
  "varonisdatasecurityplatform-varonisdatasecurityplatform",
  "varonissaas-varonissaas",
  "trendmicrocas-trendmicrocas",
  "microsoftcloudappsecurity-microsoftdefendereventcollector",
  "rapid7appsec-rapid7appsec",
  "okta-oktaeventcollector",
  "okta-okta-iam",
  "pingidentity-pingone",
  "onelogin-onelogineventcollector",
  "gsuiteadmin-gsuiteadmin",
  "gsuiteauditor-gsuiteauditor",
  "infoblox-infoblox",
  "infobloxbloxone-infobloxbloxonethreatdefenseeventcollector",
  "feedinfobloxthreatintelligence-feedinfobloxthreatintelligence",
  "cisco-umbrella-cloud-security-ciscoumbrellacloudsecurityv2",
  "cisco-umbrella-enforcement-ciscoumbrellaenforcement",
  "cisco-umbrella-cisco-umbrella-investigate",
  "cloudflarewaf-cloudflarewaf",
  "cloudflarezerotrust-cloudflarezerotrusteventcollector",
  "feedcloudflare-feedcloudflare",
  "armis-armis",
  "armis-armiseventcollector",
  "claroty-claroty",
  "clarotyxdome-xdome",
  "nozominetworks-nozominetworks",
  "microsoftdefenderthreatintelligence-microsoftdefenderthreatintelligence",
  "recordedfuturev3-recordedfuturealerts",
  "recordedfuture-recordedfutureplaybookalerts",
  "recordedfuture-recordedfutureeventcollector",
  "identityrecordedfuture-identityrecordedfuture",
  "recordedfutureasi-recordedfutureasi",
  "recordedfuture-recordedfuturelists",
  "secureworks-taegisxdrv2",
  "checkpointxdr-checkpointxdr",
  "virustotal-feedlivehunt",
  "virustotal-feedretrohunt",
  "hoxhunt-hoxhuntv2",
  "fullhunt-fullhunt",
  "sekoiaintelligencecenter-sekoiaintelligencecenter",
]);
const stats = {
  scanned: 0,
  usable: 0,
  withPath: 0,
  fromSample: 0,
  fromReadme: 0,
  fromYaml: 0,
  skippedNoShape: 0,
  skippedError: 0,
};
const errors: string[] = [];

const generated: Array<Record<string, unknown>> = [];

for (const dir of await integrationDirs(path.join(contentRoot, "Packs"))) {
  stats.scanned += 1;
  try {
    const preset = await presetFromDir(dir);
    if (!preset) {
      stats.skippedNoShape += 1;
      continue;
    }
    if (preset.origin === "sample") stats.fromSample += 1;
    if (preset.origin === "readme") stats.fromReadme += 1;
    if (preset.origin === "yaml") stats.fromYaml += 1;
    if (presetHasPath(preset.spec)) stats.withPath += 1;
    stats.usable += 1;
    const file = `${preset.id}.json`;
    if (!curatedIds.has(preset.id)) {
      await writeFile(path.join(integrationDir, file), JSON.stringify(preset));
    }
    generated.push(indexEntry(preset));
  } catch (error) {
    stats.skippedError += 1;
    const message = error instanceof Error ? error.message : "unknown";
    if (errors.length < 30) errors.push(`${dir}: ${message}`);
  }
}
if (errors.length) console.log(errors.join("\n"));

const curated = await readCurated();
const byId = new Map<string, Record<string, unknown>>();
for (const entry of curated) byId.set(String(entry.id), entry);
for (const entry of generated) {
  if (!byId.has(String(entry.id))) byId.set(String(entry.id), entry);
}
const presets = [...byId.values()].sort((a, b) =>
  String(a.name).localeCompare(String(b.name)),
);
await writeFile(
  path.join(outDir, "index.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    contentRepo: "https://github.com/demisto/content",
    license: "MIT",
    attribution: "/presets/ATTRIBUTION.md",
    presets,
  }),
);
await writeFile(path.join(outDir, "COVERAGE.md"), coverageMarkdown());
console.log(stats);
console.log(`index presets: ${presets.length}`);

function coverageMarkdown(): string {
  return `# Preset coverage

Generated ${new Date().toISOString()} from a local checkout of [demisto/content](https://github.com/demisto/content) (MIT).

| | |
| --- | --- |
| Integration directories scanned | ${stats.scanned} |
| Usable presets | ${stats.usable} |
| From sample JSON | ${stats.fromSample} |
| From a README JSON example | ${stats.fromReadme} |
| From YAML command outputs | ${stats.fromYaml} |
| With at least one HTTP path taken from the Python client | ${stats.withPath} |
| Skipped, no outputs, sample, or README example | ${stats.skippedNoShape} |
| Skipped, importer error | ${stats.skippedError} |
| Hand-curated and not overwritten | ${curatedIds.size} |

A sample preset comes from JSON in \`test_data/\` or an integration \`*_test/\` fixture. When that is missing, a README \`json\` fence is used. Otherwise command \`outputs\` context paths in the integration YAML become the field tree. Paths and methods come from HTTP calls in the Python client. When none are found, the operation is \`GET /\` and the fidelity is \`shape\`.

This is structural fidelity for XSOAR content development, not a claim that every response matches the vendor's current API. Hand-checked presets are listed in \`VERIFICATION.md\`. Regenerate with \`npm run presets:import -- --content ./content\`.
`;
}

async function integrationDirs(packs: string): Promise<string[]> {
  const dirs: string[] = [];
  const packNames = await readdir(packs, { withFileTypes: true });
  for (const pack of packNames) {
    if (!pack.isDirectory()) continue;
    const integrations = path.join(packs, pack.name, "Integrations");
    let children: import("node:fs").Dirent[] = [];
    try {
      children = await readdir(integrations, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (child.isDirectory()) dirs.push(path.join(integrations, child.name));
    }
  }
  return dirs;
}

async function presetFromDir(dir: string): Promise<{
  id: string;
  name: string;
  pack: string;
  fidelity: string;
  curated: boolean;
  summary: string;
  operations: number;
  origin: "sample" | "readme" | "yaml";
  spec: MockSpec;
} | null> {
  const pack = path.basename(path.dirname(path.dirname(dir)));
  const folder = path.basename(dir);
  if (pack === "Akamai_SIEM" && folder === "Akamai_SIEM") return null;
  const ymlName = (await readdir(dir)).find((name) => name.endsWith(".yml") && !name.includes("_description"));
  if (!ymlName) return null;
  const ymlText = await readFile(path.join(dir, ymlName), "utf8");
  const meta = readMeta(ymlText, folder);
  const calls = await collectCalls(dir);
  const samples = await collectSamples(dir);
  const readme = samples.length ? null : await readmeSample(dir);
  let origin: "sample" | "readme" | "yaml" = "yaml";
  let operations = samples.length ? operationsFromSamples(samples, calls, meta.name) : [];
  if (operations.length) origin = "sample";
  else if (readme) {
    operations = operationsFromSamples([{ name: "README", text: readme }], calls, meta.name);
    if (operations.length) origin = "readme";
  }
  if (!operations.length) operations = operationsFromYaml(ymlText, calls) || [];
  if (!operations?.length) return null;
  const fidelity = origin === "yaml" || !operations.some((operation) => operation.pathTemplate !== "/")
    ? "shape"
    : "sample";
  const id = slug(`${pack}--${folder}`).slice(0, 80);
  const spec = forDisk(validateMockSpec({
    version: 1,
    source: {
      kind: "preset",
      id,
      name: meta.name,
      fidelity,
      attribution: "Derived from demisto/content (MIT). See /presets/ATTRIBUTION.md.",
      sourceUrl: `https://github.com/demisto/content/tree/master/Packs/${pack}/Integrations/${folder}`,
      notes: notesFor(origin, fidelity),
    },
    operations,
    chaos: specChaos(),
    totalRecords: 200,
  }));
  return {
    id,
    name: meta.name,
    pack,
    fidelity,
    curated: false,
    summary: meta.description.slice(0, 180),
    operations: operations.length,
    origin,
    spec,
  };
}

function notesFor(origin: "sample" | "readme" | "yaml", fidelity: string): string[] {
  if (origin === "yaml") {
    return [
      "Field names come from the integration YAML command outputs, not a captured vendor response.",
      fidelity === "shape"
        ? "No HTTP path was recovered from the client. The shape is served at the catch URL root."
        : "HTTP paths were guessed from the Python client and may not match every command.",
    ];
  }
  return [
    origin === "readme"
      ? "The response shape comes from a JSON example in the integration README."
      : "Identifier and timestamp fields are generated so pages stay unique. Other fields keep an example from the XSOAR fixture.",
    fidelity === "shape"
      ? "No HTTP path was recovered from the client. The sample shape is served at the catch URL root."
      : "HTTP paths were guessed from the integration client and may not match every command.",
  ];
}

function operationsFromSamples(
  samples: { name: string; text: string }[],
  calls: Array<{ method: string; path: string }>,
  name: string,
): MockOperation[] {
  const operations: MockOperation[] = [];
  const used = new Set<string>();
  for (const [index, sample] of samples.slice(0, 6).entries()) {
    let spec: MockSpec;
    try {
      const drafted = mockFromSample(sample.text, name);
      drafted.operations[0].record = pruneRecord(drafted.operations[0].record, { left: 60 });
      spec = validateMockSpec(drafted);
    } catch {
      continue;
    }
    const operation = spec.operations[0];
    operation.id = uniqueId(slug(sample.name).slice(0, 50) || `op-${index}`, used);
    operation.summary = sample.name.slice(0, 160);
    const call = calls[index] || (samples.length === 1 ? calls[0] : undefined);
    if (call) {
      operation.pathTemplate = call.path;
      operation.method = call.method;
    } else {
      operation.pathTemplate = "/";
      operation.method = "GET";
    }
    operation.record = pruneRecord(operation.record, { left: 60 });
    operations.push(operation);
  }
  return operations;
}

function fieldsFromArguments(args: Array<{ name?: string }> | undefined): FieldSpec | null {
  const children = (args || [])
    .map((arg) => String(arg.name || "").replace(/[^A-Za-z0-9_.:@$-]/g, "").slice(0, 80))
    .filter((name) => /^[A-Za-z_][A-Za-z0-9_.:@$-]{0,79}$/.test(name))
    .slice(0, 20)
    .map((name) => ({ name, kind: "string" as const, example: name }));
  if (!children.length) return null;
  return { name: "record", kind: "object", children };
}

function pruneRecord(field: FieldSpec, state: { left: number }): FieldSpec {
  state.left -= 1;
  if (field.kind === "object") {
    const children: FieldSpec[] = [];
    for (const child of field.children || []) {
      if (state.left <= 0) break;
      children.push(pruneRecord(child, state));
    }
    return { ...field, children };
  }
  if (field.kind === "array" && field.item && state.left > 0) {
    return { ...field, item: pruneRecord(field.item, state) };
  }
  return field;
}

function operationsFromYaml(yml: string, calls: Array<{ method: string; path: string }>): MockOperation[] | null {
  let doc: { script?: { commands?: Array<{ name?: string; description?: string; outputs?: OutputField[]; arguments?: Array<{ name?: string }> }> } };
  try {
    doc = parseYaml(yml) as typeof doc;
  } catch {
    return null;
  }
  const commands = doc.script?.commands || [];
  const operations: MockOperation[] = [];
  const used = new Set<string>();
  for (const command of commands) {
    if (operations.length >= 6) break;
    const record = fieldsFromOutputs(command.outputs) || fieldsFromArguments(command.arguments);
    if (!record) continue;
    const call = calls[operations.length];
    const built = operationFromRecord(
      uniqueId(slug(String(command.name || "command")).slice(0, 50), used),
      String(command.description || command.name || "Command").replace(/\s+/g, " ").slice(0, 160),
      call,
      pruneRecord(record, { left: 60 }),
    );
    operations.push(built);
  }
  return operations.length ? operations : null;
}

function operationFromRecord(
  id: string,
  summary: string,
  call: { method: string; path: string } | undefined,
  record: FieldSpec,
): MockOperation {
  return {
    id,
    method: call?.method || "GET",
    pathTemplate: call?.path || "/",
    summary,
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: {},
    list: false,
    envelope: { type: "object" },
    pagination: {
      style: "none",
      limitParam: "limit",
      offsetParam: "offset",
      pageParam: "page",
      cursorParam: "cursor",
      defaultLimit: 1,
      maxLimit: 1,
    },
    record,
  };
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base || "op";
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`.slice(0, 60);
    n += 1;
  }
  used.add(id);
  return id;
}

function forDisk(spec: MockSpec): MockSpec {
  const copy = structuredClone(spec);
  if (
    copy.behavior &&
    !copy.behavior.state.enabled &&
    !copy.behavior.scenario.enabled &&
    !copy.behavior.fetch.enabled
  ) {
    delete copy.behavior;
  }
  const chaos = copy.chaos as unknown as Record<string, unknown>;
  for (const key of [
    "malformedXml",
    "wrongNamespace",
    "soapFault",
    "authExpired",
    "authDenied",
    "authTokenFailure",
    "authClockSkew",
  ]) {
    if (chaos[key] === false) delete chaos[key];
  }
  return copy;
}

function specChaos() {
  return {
    enabled: false,
    seed: "xsoar",
    mode: "probability" as const,
    probability: 0.25,
    everyNth: 5,
    duplicateRecords: false,
    missingFields: false,
    mixedTimestamps: false,
    outOfOrder: false,
    wrongTypes: false,
    truncatedJson: false,
    malformedJson: false,
    wrongContentType: false,
    randomErrors: false,
    latency: false,
    paginationGlitch: "none" as const,
  };
}

async function collectSamples(dir: string): Promise<{ name: string; text: string }[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "test_data" || entry.name.endsWith("_test")) {
      await walk(path.join(dir, entry.name), files);
    }
  }
  if (files.length === 0) await walk(dir, files);
  const samples: { name: string; text: string }[] = [];
  for (const file of files) {
    if (!/\.(json|txt)$/i.test(file)) continue;
    const statName = path.basename(file);
    if (/expected|context|hr_|human/i.test(statName)) continue;
    const raw = await readFile(file, "utf8");
    if (raw.length < 2 || raw.length > 100_000) continue;
    const text = toSampleText(raw);
    if (!text) continue;
    samples.push({ name: path.relative(dir, file), text });
    if (samples.length >= 8) break;
  }
  return samples;
}

function toSampleText(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const unwrapped = unwrap(parsed);
    if (useful(unwrapped)) return JSON.stringify(unwrapped);
  } catch {
    const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 5);
    try {
      const parsed = lines.map((line) => JSON.parse(line) as unknown).filter((row) => useful(row));
      if (parsed.length) return JSON.stringify(parsed.length === 1 ? parsed[0] : parsed);
    } catch {
      return null;
    }
  }
  return null;
}

function unwrap(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if ("Contents" in record && ("Type" in record || "EntryContext" in record)) return record.Contents;
  return value;
}

function useful(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => item && typeof item === "object");
  return Boolean(value) && typeof value === "object";
}

async function readmeSample(dir: string): Promise<string | null> {
  const names = ["README.md", "README.markdown"];
  for (const name of names) {
    try {
      const text = await readFile(path.join(dir, name), "utf8");
      const sample = sampleFromReadme(text);
      if (sample) return sample;
    } catch {
      continue;
    }
  }
  return null;
}

async function collectCalls(dir: string): Promise<Array<{ method: string; path: string }>> {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".py"));
  const found: Array<{ method: string; path: string }> = [];
  const seen = new Set<string>();
  for (const file of files) {
    const text = await readFile(path.join(dir, file), "utf8");
    for (const match of text.matchAll(/["'](GET|POST|PUT|PATCH|DELETE)["']\s*,\s*["']([^"']+)["']/g)) {
      const pathTemplate = cleanCallPath(match[2]);
      if (!pathTemplate) continue;
      const key = `${match[1]} ${pathTemplate}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ method: match[1], path: pathTemplate });
      if (found.length >= 6) return found;
    }
  }
  if (found.length) return found;
  return (await collectPaths(dir)).map((pathTemplate) => ({ method: "GET", path: pathTemplate }));
}

function cleanCallPath(raw: string): string | null {
  let candidate = raw.trim();
  if (!candidate.startsWith("/")) {
    if (!/^[A-Za-z0-9_.${}/-]+$/.test(candidate)) return null;
    candidate = `/${candidate}`;
  }
  candidate = sanitizePath(candidate.replace(/\$\{[^}]+\}/g, "{id}").replace(/\{[^}]+\}/g, "{id}"));
  if (candidate.length > 180 || candidate.includes(" ") || candidate.includes("//")) return null;
  if (!/^\/[A-Za-z0-9_./{}-]+$/.test(candidate)) return null;
  return candidate.endsWith("/") && candidate.length > 1 ? candidate.slice(0, -1) : candidate;
}

async function collectPaths(dir: string): Promise<string[]> {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".py"));
  const found = new Set<string>();
  for (const file of files) {
    const text = await readFile(path.join(dir, file), "utf8");
    for (const match of text.matchAll(/["'](\/[A-Za-z0-9_.${}\/-]{2,120})["']/g)) {
      const candidate = sanitizePath(match[1].replace(/\$\{[^}]+\}/g, "{id}"));
      if (candidate.includes(" ") || candidate.includes("//")) continue;
      if (!/^\/[A-Za-z0-9_./{}-]+$/.test(candidate)) continue;
      if (candidate.split("/").length < 2) continue;
      found.add(candidate.endsWith("/") ? candidate.slice(0, -1) : candidate);
    }
  }
  return [...found].sort((a, b) => b.length - a.length).slice(0, 6);
}

function readMeta(yml: string, fallback: string): { name: string; description: string } {
  try {
    const doc = parseYaml(yml) as { display?: string; name?: string; description?: string };
    return {
      name: String(doc.display || doc.name || fallback).slice(0, 120),
      description: String(doc.description || doc.display || fallback).replace(/\s+/g, " ").slice(0, 240),
    };
  } catch {
    return { name: fallback, description: fallback };
  }
}

async function readCurated(): Promise<Record<string, unknown>[]> {
  const entries: Record<string, unknown>[] = [];
  for (const id of curatedIds) {
    try {
      const json = JSON.parse(await readFile(path.join(integrationDir, `${id}.json`), "utf8"));
      entries.push(indexEntry(json));
    } catch {
      continue;
    }
  }
  return entries;
}

function indexEntry(preset: {
  id: string;
  name: string;
  pack: string;
  fidelity?: string;
  curated?: boolean;
  summary?: string;
  operations?: number | unknown[];
  spec?: { operations?: unknown[]; source?: { verification?: unknown } };
}): Record<string, unknown> {
  const operations = Array.isArray(preset.operations)
    ? preset.operations.length
    : Array.isArray(preset.spec?.operations)
      ? preset.spec.operations.length
      : Number(preset.operations || 0);
  return {
    id: preset.id,
    name: preset.name,
    pack: preset.pack,
    fidelity: preset.fidelity,
    curated: Boolean(preset.curated),
    summary: preset.summary,
    operations,
    verification: preset.spec?.source?.verification,
  };
}

function presetHasPath(spec: MockSpec): boolean {
  return spec.operations.some((operation) => operation.pathTemplate !== "/");
}

function sanitizePath(candidate: string): string {
  return candidate
    .split("/")
    .map((segment) => {
      if (!segment || (segment.startsWith("{") && segment.endsWith("}"))) return segment;
      const random =
        segment.length >= 24 && /[A-Za-z]/.test(segment) && /[0-9]/.test(segment);
      return random || segment.length >= 40 ? "{id}" : segment;
    })
    .join("/");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function walk(dir: string, files: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      if (files.length > 40) return;
      await walk(full, files);
    } else if (/\.(json|txt)$/i.test(entry.name)) {
      files.push(full);
    }
  }
}
