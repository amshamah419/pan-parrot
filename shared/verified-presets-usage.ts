import { defaultChaos, defaultPagination, type FieldSpec, type MockAuth, type MockOperation, type MockSpec } from "./mock-spec";

const checkedAt = "2026-11-10";

function field(name: string, kind: FieldSpec["kind"], extra: Partial<FieldSpec> = {}): FieldSpec {
  return { name, kind, ...extra };
}

function object(name: string, children: FieldSpec[]): FieldSpec {
  return { name, kind: "object", children };
}

function listField(name: string, itemName: string, children: FieldSpec[]): FieldSpec {
  return { name, kind: "array", minItems: 1, maxItems: 1, item: object(itemName, children) };
}

function op(
  partial: Omit<MockOperation, "headers" | "pagination" | "contentType"> & {
    pagination?: Partial<MockOperation["pagination"]>;
  },
): MockOperation {
  const { pagination, ...rest } = partial;
  return {
    ...rest,
    headers: {},
    contentType: "application/json; charset=utf-8",
    pagination: { ...defaultPagination(), style: "none", ...pagination },
  };
}

function jsonOp(id: string, method: MockOperation["method"], path: string, summary: string, record: FieldSpec): MockOperation {
  return op({ id, method, pathTemplate: path, summary, status: 200, list: false, envelope: { type: "object" }, record });
}

const bearer: MockAuth = { mode: "bearer", bearer: { token: "dummy-bearer" } };
const basic: MockAuth = { mode: "basic", basic: { username: "lab-admin", password: "dummy-not-a-real-password" } };

function headerKey(name: string, value = "dummy-key"): MockAuth {
  return { mode: "api-key", apiKey: { in: "header", name, value } };
}

function preset(input: {
  id: string;
  name: string;
  pack: string;
  vendor: string;
  summary: string;
  docUrl: string;
  sourceUrl: string;
  differences: string[];
  operations: MockOperation[];
  auth?: MockAuth;
}) {
  return {
    id: input.id,
    name: input.name,
    pack: input.pack,
    vendor: input.vendor,
    fidelity: "verified" as const,
    curated: true as const,
    summary: input.summary,
    notes: input.differences,
    attribution:
      "Checked against a public vendor reference or, when that page was not reloaded, the demisto/content client. See /presets/ATTRIBUTION.md.",
    sourceUrl: input.sourceUrl,
    spec: {
      version: 1 as const,
      source: {
        kind: "preset" as const,
        id: input.id,
        name: input.name,
        fidelity: "verified" as const,
        attribution: "Public API reference or demisto/content client (MIT).",
        sourceUrl: input.docUrl,
        notes: input.differences,
        verification: { status: "verified" as const, docUrl: input.docUrl, checkedAt, differences: input.differences },
      },
      operations: input.operations,
      chaos: defaultChaos(input.id),
      totalRecords: 40,
      auth: input.auth ?? { mode: "none" as const },
    } satisfies MockSpec,
  };
}

const gh = (pack: string, folder: string) =>
  `https://github.com/demisto/content/tree/master/Packs/${pack}/Integrations/${folder}`;

export const usageVerifiedPresets = [
  preset({
    id: "rapid7-nexpose-rapid7-nexpose",
    name: "Rapid7 InsightVM",
    pack: "Rapid7_Nexpose",
    vendor: "Rapid7",
    summary: "GET /api/3/assets returns the InsightVM asset page.",
    docUrl: "https://help.rapid7.com/insightvm/en-us/api/index.html",
    sourceUrl: gh("Rapid7_Nexpose", "Rapid7_Nexpose"),
    differences: [
      "The client calls the InsightVM API, including /sites/{site_id}/assets. This mock is GET /api/3/assets and returns { resources }.",
      "Site scans, report generation, and the SQL-style asset query are not modeled. Basic auth is the lab user.",
      "The InsightVM API index was not reloaded. Paging links are omitted.",
    ],
    auth: basic,
    operations: [
      jsonOp("assets", "GET", "/api/3/assets", "List assets", object("body", [
        listField("resources", "asset", [
          field("id", "id"),
          field("hostName", "string", { example: "lab-host" }),
          field("ip", "ip"),
        ]),
      ])),
    ],
  }),
  preset({
    id: "rapid7insightvmcloud-rapid7insightvmcloud",
    name: "Rapid7 InsightVM Cloud",
    pack: "Rapid7InsightVMCloud",
    vendor: "Rapid7",
    summary: "Cloud asset search and the vulnerability catalog.",
    docUrl: "https://help.rapid7.com/insightvm/en-us/api/index.html",
    sourceUrl: gh("Rapid7InsightVMCloud", "Rapid7InsightVMCloud"),
    differences: [
      "The client GETs /v4/integration/assets and /v4/integration/vulnerabilities. This mock returns a data array for each.",
      "The search query is not applied. Asset detail by id is not a separate route.",
      "The cloud API page was not reloaded. X-Api-Key is the dummy key.",
    ],
    auth: headerKey("X-Api-Key"),
    operations: [
      jsonOp("assets", "GET", "/v4/integration/assets", "Search assets", object("body", [
        listField("data", "asset", [field("id", "id"), field("host_name", "string", { example: "lab-host" }), field("ip", "ip")]),
      ])),
      jsonOp("vulns", "GET", "/v4/integration/vulnerabilities", "Search vulnerabilities", object("body", [
        listField("data", "vuln", [field("id", "id"), field("title", "string", { example: "Lab CVE" }), field("severity", "enum", { enumValues: ["low", "medium", "high", "critical"] })]),
      ])),
    ],
  }),
  preset({
    id: "qualysfim-qualysfim",
    name: "Qualys FIM",
    pack: "QualysFIM",
    vendor: "Qualys",
    summary: "POST fim/v3/incidents/search returns file-integrity incidents.",
    docUrl: "https://docs.qualys.com/en/fim/api/index.htm",
    sourceUrl: gh("QualysFIM", "QualysFIM"),
    differences: [
      "The client POSTs fim/v3/incidents/search and fim/v2/events/search. This mock answers the incident search with one incident.",
      "Event detail and asset search are not modeled. The search body is ignored.",
      "The Qualys FIM API page was not reloaded. Basic auth is the lab user. /auth is not modeled.",
    ],
    auth: basic,
    operations: [
      jsonOp("incidents", "POST", "/fim/v3/incidents/search", "Search FIM incidents", object("body", [
        listField("incidents", "incident", [
          field("id", "id"),
          field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
          field("status", "const", { constValue: "open" }),
        ]),
      ])),
    ],
  }),
  preset({
    id: "nessus-nessus",
    name: "Nessus",
    pack: "nessus",
    vendor: "Tenable",
    summary: "Session token and the scan list.",
    docUrl: "https://developer.tenable.com/reference/navigate",
    sourceUrl: gh("nessus", "Nessus"),
    differences: [
      "Nessus.js POSTs session and GETs scans. This mock returns a token and one scan.",
      "Launch, export, and host detail are not modeled. The token is not checked on the scan list.",
      "The Tenable developer reference was not reloaded for the Nessus manager routes. Basic auth creates the session.",
    ],
    auth: basic,
    operations: [
      jsonOp("session", "POST", "/session", "Create a session", object("body", [field("token", "const", { constValue: "dummy-nessus-token" })])),
      jsonOp("scans", "GET", "/scans", "List scans", object("body", [
        listField("scans", "scan", [field("id", "id"), field("name", "string", { example: "lab-scan" }), field("status", "const", { constValue: "completed" })]),
      ])),
    ],
  }),
  preset({
    id: "joesecurity-joesecurityv2",
    name: "Joe Security v2",
    pack: "JoeSecurity",
    vendor: "Joe Security",
    summary: "Joe Sandbox online check and a URL submission.",
    docUrl: "https://github.com/joesecurity/jbxapi",
    sourceUrl: gh("JoeSecurity", "JoeSecurityV2"),
    differences: [
      "The pack subclasses jbxapi.JoeSandbox. The test module calls /v2/server/online. Submissions go through jbxapi, which posts /v2/submission/new.",
      "This mock returns online true and a submission_id. Analysis download and cookbook upload are not modeled.",
      "The jbxapi README was not reloaded. The api-key header is the dummy key.",
    ],
    auth: headerKey("api-key", "dummy-joe-key"),
    operations: [
      jsonOp("online", "GET", "/v2/server/online", "Check the server", object("body", [field("online", "const", { constValue: true })])),
      jsonOp("submit", "POST", "/v2/submission/new", "Submit a sample", object("body", [
        field("submission_id", "id"),
        listField("analyses", "analysis", [field("webid", "id"), field("status", "const", { constValue: "finished" })]),
      ])),
    ],
  }),
  preset({
    id: "anyrun-anyrunsandbox",
    name: "ANY.RUN Cloud Sandbox",
    pack: "ANYRUN",
    vendor: "ANY.RUN",
    summary: "POST /v1/analysis starts a sandbox task.",
    docUrl: "https://any.run/api-documentation/",
    sourceUrl: gh("ANYRUN", "AnyRunSandbox"),
    differences: [
      "The pack uses the anyrun SandboxConnector. The older ANY.RUN client posts analysis/ under /v1/. This mock answers POST /v1/analysis.",
      "The response is one task id. File upload and the interactive report are not modeled.",
      "The API documentation page was not reloaded. The API-KEY header is the dummy key.",
    ],
    auth: headerKey("API-KEY", "dummy-anyrun-key"),
    operations: [
      jsonOp("analysis", "POST", "/v1/analysis", "Start an analysis", object("body", [
        object("data", [field("taskid", "id"), field("verdict", "enum", { enumValues: ["No threats", "Suspicious", "Malicious"] })]),
      ])),
    ],
  }),
  preset({
    id: "anyrun-anyrunlookup",
    name: "ANY.RUN TI Lookup",
    pack: "ANYRUN",
    vendor: "ANY.RUN",
    summary: "Threat-intelligence lookup for one indicator.",
    docUrl: "https://any.run/api-documentation/",
    sourceUrl: gh("ANYRUN", "AnyRunLookup"),
    differences: [
      "The pack calls LookupConnector.get_intelligence. The SDK path is not in the content checkout. This mock answers GET /v1/intelligence.",
      "The query is not applied. The response is one shortened verdict.",
      "The API documentation page was not reloaded. The API-KEY header is the dummy key.",
    ],
    auth: headerKey("API-KEY", "dummy-anyrun-key"),
    operations: [
      jsonOp("lookup", "GET", "/v1/intelligence", "Look up an indicator", object("body", [
        field("indicator", "string", { example: "8.8.8.8" }),
        field("verdict", "enum", { enumValues: ["No info", "Suspicious", "Malicious"] }),
      ])),
    ],
  }),
  preset({
    id: "vmray-vmray",
    name: "VMRay",
    pack: "VMRay",
    vendor: "VMRay",
    summary: "Submit a sample and read it back.",
    docUrl: "https://www.vmray.com/cyber-security-blog/vmray-analyzer-api/",
    sourceUrl: gh("VMRay", "VMRay"),
    differences: [
      "The client base ends in /rest/. sample/submit creates a sample. GET sample/{id} reads it. This mock uses those suffixes.",
      "Jobs, IOCs, and the PDF report are not modeled. The sample id in the path is lab-sample.",
      "The Analyzer API page was not reloaded. Authorization is the dummy key.",
    ],
    auth: headerKey("Authorization", "api_key dummy-vmray-key"),
    operations: [
      jsonOp("submit", "POST", "/rest/sample/submit", "Submit a sample", object("body", [
        object("data", [field("sample_id", "id"), field("sample_webif_url", "string", { example: "https://lab.vmray.example/sample" })]),
      ])),
      jsonOp("sample", "GET", "/rest/sample/lab-sample", "Get a sample", object("body", [
        object("data", [field("sample_id", "const", { constValue: "lab-sample" }), field("sample_severity", "enum", { enumValues: ["not_suspicious", "suspicious", "malicious"] })]),
      ])),
    ],
  }),
  preset({
    id: "crowdstrikefalconsandbox-crowdstrikefalconsandboxv2",
    name: "CrowdStrike Falcon Sandbox v2 (Hybrid-Analysis)",
    pack: "CrowdStrikeFalconSandbox",
    vendor: "CrowdStrike",
    summary: "Hybrid Analysis environments and a report summary.",
    docUrl: "https://www.hybrid-analysis.com/docs/api/v2",
    sourceUrl: gh("CrowdStrikeFalconSandbox", "CrowdStrikeFalconSandboxV2"),
    differences: [
      "The client GETs /system/environments and /report/{id}/summary. This mock returns one environment and one summary.",
      "File submit, screenshots, and search terms are not modeled. The report id in the path is lab-report.",
      "The Hybrid Analysis v2 page was not reloaded. The api-key header is the dummy key.",
    ],
    auth: headerKey("api-key", "dummy-hybrid-key"),
    operations: [
      jsonOp("environments", "GET", "/system/environments", "List environments", object("body", [
        listField("environments", "environment", [field("id", "id"), field("name", "string", { example: "Windows 10" })]),
      ])),
      jsonOp("summary", "GET", "/report/lab-report/summary", "Get a report summary", object("body", [
        field("sha256", "id"),
        field("verdict", "enum", { enumValues: ["no specific threat", "suspicious", "malicious"] }),
        field("threat_score", "integer"),
      ])),
    ],
  }),
  preset({
    id: "crowdstrikefalconx-crowdstrikefalconx",
    name: "CrowdStrike Falcon Intelligence Sandbox",
    pack: "CrowdStrikeFalconX",
    vendor: "CrowdStrike",
    summary: "Submit a Falcon X sample and read the report.",
    docUrl: "https://developer.crowdstrike.com/api-reference/collections/falconx-sandbox/",
    sourceUrl: gh("CrowdStrikeFalconX", "CrowdStrikeFalconX"),
    differences: [
      "The client POSTs /falconx/entities/submissions/v1 and reads /falconx/entities/reports/v1. Both return { resources }.",
      "Sample upload and report summaries are not modeled. OAuth at /oauth2/token is not modeled.",
      "The Falcon X collection page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("submit", "POST", "/falconx/entities/submissions/v1", "Submit a sample", object("body", [
        listField("resources", "submission", [field("id", "id"), field("state", "const", { constValue: "success" })]),
      ])),
      jsonOp("reports", "GET", "/falconx/entities/reports/v1", "Get reports", object("body", [
        listField("resources", "report", [field("id", "id"), field("verdict", "enum", { enumValues: ["no specific threat", "suspicious", "malicious"] })]),
      ])),
    ],
  }),
  preset({
    id: "microsoftteams-microsoftteams",
    name: "Microsoft Teams",
    pack: "MicrosoftTeams",
    vendor: "Microsoft",
    summary: "List channels and chat messages on Microsoft Graph.",
    docUrl: "https://learn.microsoft.com/en-us/graph/api/channel-list",
    sourceUrl: gh("MicrosoftTeams", "MicrosoftTeams"),
    differences: [
      "The client calls Graph /v1.0/teams/{id}/channels and /v1.0/chats/{id}/messages. This mock uses team lab-team and chat lab-chat.",
      "Creating chats, membership, and the bot callback are not modeled. The value array is one item.",
      "The channel-list page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("channels", "GET", "/v1.0/teams/lab-team/channels", "List channels", object("body", [
        listField("value", "channel", [field("id", "id"), field("displayName", "string", { example: "General" })]),
      ])),
      jsonOp("messages", "GET", "/v1.0/chats/lab-chat/messages", "List chat messages", object("body", [
        listField("value", "message", [field("id", "id"), field("body", "string", { example: "hello from the lab" })]),
      ])),
    ],
  }),
  preset({
    id: "microsoftteams-microsoftteamsmanagement",
    name: "Microsoft Teams Management",
    pack: "MicrosoftTeams",
    vendor: "Microsoft",
    summary: "GET /v1.0/teams lists teams.",
    docUrl: "https://learn.microsoft.com/en-us/graph/api/group-list",
    sourceUrl: gh("MicrosoftTeams", "MicrosoftTeamsManagement"),
    differences: [
      "The client GETs https://graph.microsoft.com/v1.0/teams. This mock returns { value } with one team.",
      "Team templates and the token call at login.microsoftonline.com are not modeled.",
      "The Graph group-list page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("teams", "GET", "/v1.0/teams", "List teams", object("body", [
        listField("value", "team", [field("id", "id"), field("displayName", "string", { example: "Lab team" })]),
      ])),
    ],
  }),
  preset({
    id: "microsoftteams-microsoftteamswebhook",
    name: "Microsoft Teams via Webhook",
    pack: "MicrosoftTeams",
    vendor: "Microsoft",
    summary: "POST an Adaptive Card to the incoming webhook.",
    docUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
    sourceUrl: gh("MicrosoftTeams", "MicrosoftTeamsWebhook"),
    differences: [
      "The pack posts a card to the webhook URL the instance stores. This mock answers POST /webhook with 1, which is the Teams success body.",
      "The card schema is not validated. The webhook secret in the URL is not checked.",
      "The incoming-webhook page was not reloaded.",
    ],
    operations: [
      jsonOp("webhook", "POST", "/webhook", "Post a card", object("body", [field("result", "const", { constValue: "1" })])),
    ],
  }),
  preset({
    id: "microsoftgraphteams-microsoftgraphteams",
    name: "O365 Teams (Using Graph API)",
    pack: "MicrosoftGraphTeams",
    vendor: "Microsoft",
    summary: "List messages in a lab channel.",
    docUrl: "https://learn.microsoft.com/en-us/graph/api/channel-list-messages",
    sourceUrl: gh("MicrosoftGraphTeams", "MicrosoftGraphTeams"),
    differences: [
      "This pack talks to Microsoft Graph for Teams. This mock is GET /v1.0/teams/lab-team/channels/lab-channel/messages.",
      "Replies, mentions, and hosted contents are not modeled.",
      "The channel messages page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("messages", "GET", "/v1.0/teams/lab-team/channels/lab-channel/messages", "List channel messages", object("body", [
        listField("value", "message", [field("id", "id"), field("body", "string", { example: "lab update" })]),
      ])),
    ],
  }),
  preset({
    id: "atlassianjiraservicemanagement-atlassianjiraservicemanagement",
    name: "Atlassian Jira Service Management",
    pack: "AtlassianJiraServiceManagement",
    vendor: "Atlassian",
    summary: "Assets object schemas.",
    docUrl: "https://developer.atlassian.com/cloud/assets/rest/api-group-objectschema/",
    sourceUrl: gh("AtlassianJiraServiceManagement", "AtlassianJiraServiceManagement"),
    differences: [
      "The client base is /rest/assets/1.0/ and GETs /objectschema/list. This mock returns one schema.",
      "Object types, attributes, and single objects are not modeled.",
      "The Assets objectschema page was not reloaded. A bearer token is required. Jira issue search stays on the Jira v3 preset.",
    ],
    auth: bearer,
    operations: [
      jsonOp("schemas", "GET", "/rest/assets/1.0/objectschema/list", "List object schemas", object("body", [
        listField("objectschemas", "schema", [field("id", "id"), field("name", "string", { example: "Lab assets" })]),
      ])),
    ],
  }),
  preset({
    id: "jira-jiraeventcollector",
    name: "Jira Event Collector",
    pack: "Jira",
    vendor: "Atlassian",
    summary: "Audit records for the Jira collector.",
    docUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-audit-records/",
    sourceUrl: gh("Jira", "JiraEventCollector"),
    differences: [
      "The collector GETs /rest/api/3/auditing/record. This mock returns { records } with one audit event.",
      "The older /rest/auditing/1.0/events route and the OAuth cloud id prefix are not modeled.",
      "The audit-records page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("audit", "GET", "/rest/api/3/auditing/record", "List audit records", object("body", [
        field("total", "integer"),
        listField("records", "record", [field("id", "id"), field("summary", "string", { example: "User logged in" }), field("created", "timestamp", { format: "iso" })]),
      ])),
    ],
  }),
  preset({
    id: "servicenow-servicenow-cmdb",
    name: "ServiceNow CMDB",
    pack: "ServiceNow",
    vendor: "ServiceNow",
    summary: "List Linux server CIs.",
    docUrl: "https://www.servicenow.com/docs/r/api-reference/rest-apis/c_CMDBInstanceAPI.html",
    sourceUrl: gh("ServiceNow", "ServiceNow_CMDB"),
    differences: [
      "The client GETs /api/now/cmdb/instance/{class}. This mock answers cmdb_ci_linux_server with { result }.",
      "Create, patch, and relations are not modeled. Other classes do not match.",
      "The CMDB Instance API page was not reloaded. Basic auth is the lab user. Incident tables stay on ServiceNow v2.",
    ],
    auth: basic,
    operations: [
      jsonOp("cis", "GET", "/api/now/cmdb/instance/cmdb_ci_linux_server", "List Linux servers", object("body", [
        listField("result", "ci", [field("sys_id", "id"), field("name", "string", { example: "lab-linux" }), field("ip_address", "ip")]),
      ])),
    ],
  }),
  preset({
    id: "servicenow-servicenoweventcollector",
    name: "ServiceNow Event Collector",
    pack: "ServiceNow",
    vendor: "ServiceNow",
    summary: "Table API audit rows.",
    docUrl: "https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html",
    sourceUrl: gh("ServiceNow", "ServiceNowEventCollector"),
    differences: [
      "The collector reads /api/now/table/sys_audit. This mock returns { result } with one audit row.",
      "Customer-service tables and the sysparm query are not applied.",
      "The Table API page was not reloaded. Basic auth is the lab user.",
    ],
    auth: basic,
    operations: [
      jsonOp("audit", "GET", "/api/now/table/sys_audit", "List audit rows", object("body", [
        listField("result", "row", [field("sys_id", "id"), field("tablename", "const", { constValue: "incident" }), field("sys_created_on", "timestamp", { format: "iso" })]),
      ])),
    ],
  }),
  preset({
    id: "servicenow-servicenow-iam",
    name: "ServiceNow IAM",
    pack: "ServiceNow",
    vendor: "ServiceNow",
    summary: "List sys_user records.",
    docUrl: "https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html",
    sourceUrl: gh("ServiceNow", "ServiceNow_IAM"),
    differences: [
      "The client GETs table/sys_user on an /api/now base. This mock is GET /api/now/table/sys_user.",
      "Create, update, and the dictionary call are not modeled. The query is ignored.",
      "The Table API page was not reloaded. Basic auth is the lab user.",
    ],
    auth: basic,
    operations: [
      jsonOp("users", "GET", "/api/now/table/sys_user", "List users", object("body", [
        listField("result", "user", [field("sys_id", "id"), field("user_name", "string", { example: "ada" }), field("email", "email")]),
      ])),
    ],
  }),
  preset({
    id: "slack-slackeventcollector",
    name: "Slack Event Collector",
    pack: "Slack",
    vendor: "Slack",
    summary: "Audit log entries.",
    docUrl: "https://api.slack.com/admins/audit-logs",
    sourceUrl: gh("Slack", "SlackEventCollector"),
    differences: [
      "The collector GETs logs on the Audit Logs API. This mock is GET /audit/v1/logs and returns { entries }.",
      "The cursor is ignored. Message events from the Events API are not modeled. Chat methods stay on Slack v3.",
      "The audit-logs page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("logs", "GET", "/audit/v1/logs", "List audit logs", object("body", [
        listField("entries", "entry", [field("id", "id"), field("action", "string", { example: "user_login" }), field("date_create", "timestamp", { format: "unix" })]),
      ])),
    ],
  }),
  preset({
    id: "slack-slack-iam",
    name: "Slack IAM",
    pack: "Slack",
    vendor: "Slack",
    summary: "SCIM users.",
    docUrl: "https://api.slack.com/admins/scim",
    sourceUrl: gh("Slack", "Slack_IAM"),
    differences: [
      "The client base is https://api.slack.com/scim/v1/ and GETs /Users. This mock returns Resources and totalResults.",
      "Create, replace, and the Schemas call are not modeled.",
      "The SCIM page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("users", "GET", "/scim/v1/Users", "List SCIM users", object("body", [
        field("totalResults", "integer"),
        listField("Resources", "user", [field("id", "id"), field("userName", "string", { example: "ada" }), field("active", "const", { constValue: true })]),
      ])),
    ],
  }),
  preset({
    id: "ciscospark-ciscospark",
    name: "Cisco Webex Teams",
    pack: "CiscoSpark",
    vendor: "Cisco",
    summary: "List Webex rooms.",
    docUrl: "https://developer.webex.com/docs/api/v1/rooms/list-rooms",
    sourceUrl: gh("CiscoSpark", "CiscoSpark"),
    differences: [
      "CiscoSpark.js maps cisco-spark-list-rooms to GET rooms. This mock is GET /v1/rooms and returns { items }.",
      "Memberships, messages, and webhooks are not modeled.",
      "The list-rooms page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("rooms", "GET", "/v1/rooms", "List rooms", object("body", [
        listField("items", "room", [field("id", "id"), field("title", "string", { example: "Lab room" }), field("type", "const", { constValue: "group" })]),
      ])),
    ],
  }),
  preset({
    id: "netskope-netskopeapiv2",
    name: "Netskope (API v2)",
    pack: "Netskope",
    vendor: "Netskope",
    summary: "Alert events from the v2 events API.",
    docUrl: "https://docs.netskope.com/en/netskope-help/admin-console/rest-api/rest-api-v2-overview/",
    sourceUrl: gh("Netskope", "NetskopeAPIv2"),
    differences: [
      "Tests call api/v2/events/data/alert. This mock is GET /api/v2/events/data/alert and returns { result }.",
      "Page, application, network, and audit event types are not separate routes.",
      "The REST API v2 overview was not reloaded. Netskope-Api-Token is the dummy key.",
    ],
    auth: headerKey("Netskope-Api-Token"),
    operations: [
      jsonOp("alerts", "GET", "/api/v2/events/data/alert", "List alert events", object("body", [
        listField("result", "alert", [field("id", "id"), field("alert_type", "string", { example: "malware" }), field("timestamp", "timestamp", { format: "unix" })]),
      ])),
    ],
  }),
  preset({
    id: "netskopev2-netskopev2",
    name: "Netskope - Direct to Zero Trust",
    pack: "NetskopeV2",
    vendor: "Netskope",
    summary: "URL lists on the v2 policy API.",
    docUrl: "https://docs.netskope.com/en/netskope-help/admin-console/rest-api/rest-api-v2-overview/",
    sourceUrl: gh("NetskopeV2", "NetskopeV2"),
    differences: [
      "The client GETs /api/v2/policy/urllist. This mock returns one list.",
      "File scans, deploy revert, and list edits are not modeled.",
      "The REST API v2 overview was not reloaded. Netskope-Api-Token is the dummy key.",
    ],
    auth: headerKey("Netskope-Api-Token"),
    operations: [
      jsonOp("lists", "GET", "/api/v2/policy/urllist", "List URL lists", object("body", [
        listField("data", "list", [field("id", "id"), field("name", "string", { example: "lab-block" })]),
      ])),
    ],
  }),
  preset({
    id: "netskope-netskopeeventcollector-v2",
    name: "Netskope Event Collector v2",
    pack: "Netskope",
    vendor: "Netskope",
    summary: "Network events for the v2 collector.",
    docUrl: "https://docs.netskope.com/en/netskope-help/admin-console/rest-api/rest-api-v2-overview/",
    sourceUrl: gh("Netskope", "NetskopeEventCollector_v2"),
    differences: [
      "The collector reads /api/v2/events/data/network and other event types. This mock is the network route.",
      "Incident datasearch and the page iterator are not modeled.",
      "The REST API v2 overview was not reloaded. Netskope-Api-Token is the dummy key. The deprecated collector stays on its earlier preset.",
    ],
    auth: headerKey("Netskope-Api-Token"),
    operations: [
      jsonOp("network", "GET", "/api/v2/events/data/network", "List network events", object("body", [
        listField("result", "event", [field("id", "id"), field("srcip", "ip"), field("dstip", "ip"), field("timestamp", "timestamp", { format: "unix" })]),
      ])),
    ],
  }),
  preset({
    id: "skyhighsecurity-skyhighsecurity",
    name: "Skyhigh Security",
    pack: "SkyhighSecurity",
    vendor: "Skyhigh Security",
    summary: "Query CASB incidents.",
    docUrl: "https://success.myshn.net/Skyhigh_CASB/Skyhigh_CASB_APIs",
    sourceUrl: gh("SkyhighSecurity", "SkyhighSecurity"),
    differences: [
      "The client POSTs /external/api/v1/queryIncidents on a /shnapi/rest base. This mock returns one incident.",
      "Modify incidents, activities, and the DLP dictionary are not modeled.",
      "The Skyhigh success center was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("incidents", "POST", "/shnapi/rest/external/api/v1/queryIncidents", "Query incidents", object("body", [
        listField("incidents", "incident", [field("id", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high"] }), field("status", "const", { constValue: "open" })]),
      ])),
    ],
  }),
  preset({
    id: "mcafeewebgateway-skyhighsecurewebgatewayonprem",
    name: "Skyhigh Secure Web Gateway (On Prem)",
    pack: "McAfeeWebGateway",
    vendor: "Skyhigh Security",
    summary: "List gateway lists.",
    docUrl: "https://success.myshn.net/Skyhigh_Secure_Web_Gateway",
    sourceUrl: gh("McAfeeWebGateway", "SkyhighSecureWebGatewayOnPrem"),
    differences: [
      "The client logs in, then GETs /list. This mock returns one list. Login and logout are not modeled.",
      "List entries and updates are not modeled.",
      "The Secure Web Gateway page was not reloaded. Basic auth is the lab user.",
    ],
    auth: basic,
    operations: [
      jsonOp("lists", "GET", "/list", "List gateway lists", object("body", [
        listField("lists", "list", [field("id", "id"), field("name", "string", { example: "lab-block" })]),
      ])),
    ],
  }),
  preset({
    id: "symantecdlp-symantecdlpv2",
    name: "Symantec Data Loss Prevention v2",
    pack: "SymantecDLP",
    vendor: "Broadcom",
    summary: "List DLP incidents.",
    docUrl: "https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/15-8.html",
    sourceUrl: gh("SymantecDLP", "SymantecDLPV2"),
    differences: [
      "The client POSTs /ProtectManager/webservices/v2/incidents. This mock returns one incident.",
      "Updates, static attributes, and status values are not modeled.",
      "The DLP techdocs page was not reloaded. Basic auth is the lab user.",
    ],
    auth: basic,
    operations: [
      jsonOp("incidents", "POST", "/ProtectManager/webservices/v2/incidents", "List incidents", object("body", [
        listField("incidents", "incident", [field("id", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high"] }), field("status", "const", { constValue: "open" })]),
      ])),
    ],
  }),
  preset({
    id: "forcepointdlp-forcepointeventcollector",
    name: "Forcepoint DLP Event Collector (Beta)",
    pack: "ForcepointDLP",
    vendor: "Forcepoint",
    summary: "POST /dlp/rest/v1/incidents returns incidents.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/ForcepointDLP/Integrations/ForcepointEventCollector",
    sourceUrl: gh("ForcepointDLP", "ForcepointEventCollector"),
    differences: [
      "get_incidents POSTs /incidents on a base of /dlp/rest/v1 and reads incidents. The earlier mock used GET.",
      "Each incident keeps id and event_time, which the collector stores. POST /auth/refresh-token is not modeled.",
      "Later calls send Authorization Bearer. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("incidents", "POST", "/dlp/rest/v1/incidents", "List incidents", object("body", [
        listField("incidents", "incident", [
          field("id", "id"),
          field("event_time", "timestamp", { format: "iso" }),
          field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
        ]),
      ])),
    ],
  }),
  preset({
    id: "varonisdatasecurityplatform-varonisdatasecurityplatform",
    name: "Varonis Data Security Platform",
    pack: "VaronisDataSecurityPlatform",
    vendor: "Varonis",
    summary: "GET alerts from the on-prem API.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/VaronisDataSecurityPlatform",
    sourceUrl: gh("VaronisDataSecurityPlatform", "VaronisDataSecurityPlatform"),
    differences: [
      "Varonis API pages were not loaded. The client GETs /api/alert/alert/GetAlerts.",
      "This mock returns one alert. Auth windows login, users, and alerted events are not modeled.",
      "A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("alerts", "GET", "/api/alert/alert/GetAlerts", "Get alerts", object("body", [
        listField("alerts", "alert", [field("id", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high"] }), field("name", "string", { example: "Unusual access" })]),
      ])),
    ],
  }),
  preset({
    id: "varonissaas-varonissaas",
    name: "Varonis SaaS",
    pack: "VaronisSaaS",
    vendor: "Varonis",
    summary: "Search alerts in the SaaS data query API.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/VaronisSaaS",
    sourceUrl: gh("VaronisSaaS", "VaronisSaaS"),
    differences: [
      "Varonis SaaS docs were not loaded. The client searches /app/dataquery/api/search/v2/search and mints a token at /api/authentication/api_keys/token.",
      "This mock returns one alert row from the search. The token route is not modeled. The query is ignored.",
      "A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("search", "POST", "/app/dataquery/api/search/v2/search", "Search alerts", object("body", [
        listField("data", "alert", [field("id", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high"] })]),
      ])),
    ],
  }),
  preset({
    id: "trendmicrocas-trendmicrocas",
    name: "TrendAI™ Cloud App Security",
    pack: "TrendMicroCAS",
    vendor: "Trend Micro",
    summary: "Security events for Cloud App Security.",
    docUrl: "https://docs.trendmicro.com/en-us/documentation/article/trend-micro-cloud-app-security-online-help-api-reference",
    sourceUrl: gh("TrendMicroCAS", "TrendMicroCAS"),
    differences: [
      "The client GETs siem/security_events. This mock is GET /v1/siem/security_events and returns one event.",
      "Mail sweep, mitigation, and remediation are not modeled.",
      "The API reference page was not reloaded. Authorization is the dummy key.",
    ],
    auth: headerKey("Authorization", "Bearer dummy-trend-key"),
    operations: [
      jsonOp("events", "GET", "/v1/siem/security_events", "List security events", object("body", [
        listField("security_events", "event", [field("id", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high"] }), field("message", "string", { example: "Malware detected" })]),
      ])),
    ],
  }),
  preset({
    id: "microsoftcloudappsecurity-microsoftdefendereventcollector",
    name: "Microsoft Defender for Cloud Apps Event Collector",
    pack: "MicrosoftCloudAppSecurity",
    vendor: "Microsoft",
    summary: "Alerts for the Cloud Apps collector.",
    docUrl: "https://learn.microsoft.com/en-us/defender-cloud-apps/api-alerts",
    sourceUrl: gh("MicrosoftCloudAppSecurity", "MicrosoftDefenderEventCollector"),
    differences: [
      "The collector base is /api/v1/ and requests alerts. This mock is POST /api/v1/alerts and returns { data }.",
      "Activity types are not modeled. The filter body is ignored. The main Cloud Apps preset stays separate.",
      "The alerts API page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("alerts", "POST", "/api/v1/alerts", "List alerts", object("body", [
        listField("data", "alert", [field("id", "id"), field("title", "string", { example: "Impossible travel" }), field("severity", "enum", { enumValues: ["low", "medium", "high"] })]),
      ])),
    ],
  }),
  preset({
    id: "rapid7appsec-rapid7appsec",
    name: "Rapid7AppSec",
    pack: "Rapid7AppSec",
    vendor: "Rapid7",
    summary: "InsightAppSec vulnerabilities.",
    docUrl: "https://help.rapid7.com/insightappsec/en-us/api/v1/docs.html",
    sourceUrl: gh("Rapid7AppSec", "Rapid7AppSec"),
    differences: [
      "The client base is /ias/v1/ and the vulnerability prefix is vulnerabilities. This mock is GET /ias/v1/vulnerabilities.",
      "Comments, history, and a single vulnerability are not modeled.",
      "The InsightAppSec API docs page was not reloaded. X-Api-Key is the dummy key.",
    ],
    auth: headerKey("X-Api-Key"),
    operations: [
      jsonOp("vulns", "GET", "/ias/v1/vulnerabilities", "List vulnerabilities", object("body", [
        listField("data", "vulnerability", [field("id", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high", "critical"] }), field("status", "const", { constValue: "open" })]),
      ])),
    ],
  }),
];
