import { defaultChaos, defaultPagination, type FieldSpec, type MockAuth, type MockSpec } from "./mock-spec";
import { presetDowngrades } from "./preset-downgrades";
import { reverifiedOverlays } from "./reverified-overlays";
import { WIZ_EXAMPLE_QUERY, WIZ_SDL } from "./wiz-schema";
import { fetchVerifiedPresets } from "./verified-presets-fetch";
import { intelVerifiedPresets } from "./verified-presets-intel";
import { awsQueryVerifiedPresets } from "./verified-presets-aws";
import { panSiemVerifiedPresets } from "./verified-presets-pan";
import { usageVerifiedPresets } from "./verified-presets-usage";
import { identityVerifiedPresets } from "./verified-presets-identity";
import { responseVerifiedPresets } from "./verified-presets-response";
import { moreVerifiedPresets } from "./verified-presets-more";

const checkedAt = "2026-11-09";

function op(
  partial: Omit<MockSpec["operations"][number], "headers" | "pagination" | "contentType"> & {
    pagination?: Partial<MockSpec["operations"][number]["pagination"]>;
    headers?: Record<string, string>;
    contentType?: string;
  },
): MockSpec["operations"][number] {
  return {
    headers: partial.headers ?? {},
    contentType: partial.contentType ?? "application/json; charset=utf-8",
    pagination: { ...defaultPagination(), ...partial.pagination },
    id: partial.id,
    method: partial.method,
    pathTemplate: partial.pathTemplate,
    summary: partial.summary,
    status: partial.status,
    list: partial.list,
    envelope: partial.envelope,
    record: partial.record,
    queryMatch: partial.queryMatch,
    soapAction: partial.soapAction,
    requestElement: partial.requestElement,
    pack: partial.pack,
  };
}

function field(name: string, kind: FieldSpec["kind"], extra: Partial<FieldSpec> = {}): FieldSpec {
  return { name, kind, ...extra };
}

function object(name: string, children: FieldSpec[]): FieldSpec {
  return { name, kind: "object", children };
}

export interface VerifiedPresetFile {
  id: string;
  name: string;
  pack: string;
  vendor: string;
  fidelity: "verified" | "guessed";
  curated: true;
  summary: string;
  notes: string[];
  attribution: string;
  sourceUrl: string;
  spec: MockSpec;
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
  notes?: string[];
  operations: MockSpec["operations"];
  totalRecords?: number;
  auth?: MockAuth;
  checkedAt?: string;
  graphql?: MockSpec["graphql"];
}): VerifiedPresetFile {
  return {
    id: input.id,
    name: input.name,
    pack: input.pack,
    vendor: input.vendor,
    fidelity: "verified",
    curated: true,
    summary: input.summary,
    notes: input.notes ?? input.differences,
    attribution: "Checked against the vendor's public API reference. Sample field names also follow demisto/content (MIT). See /presets/ATTRIBUTION.md.",
    sourceUrl: input.sourceUrl,
    spec: {
      version: 1,
      source: {
        kind: "preset",
        id: input.id,
        name: input.name,
        fidelity: "verified",
        attribution: "Vendor public API reference plus demisto/content (MIT).",
        sourceUrl: input.docUrl,
        notes: input.notes ?? [],
        verification: {
          status: "verified",
          docUrl: input.docUrl,
          checkedAt: input.checkedAt || checkedAt,
          differences: input.differences,
        },
      },
      operations: input.operations,
      chaos: defaultChaos(input.id),
      totalRecords: input.totalRecords ?? 500,
      auth: input.auth ?? { mode: "none" },
      graphql: input.graphql,
    },
  };
}

const oktaEvent = object("event", [
  field("uuid", "uuid"),
  field("published", "timestamp", { format: "iso" }),
  field("eventType", "enum", {
    enumValues: ["user.session.start", "user.authentication.sso", "user.account.update"],
  }),
  field("version", "const", { constValue: "0" }),
  field("severity", "enum", { enumValues: ["INFO", "WARN", "ERROR"] }),
  field("displayMessage", "string", { example: "User login to Okta" }),
  object("actor", [
    field("id", "id"),
    field("type", "const", { constValue: "User" }),
    field("alternateId", "email"),
    field("displayName", "string", { example: "Ada Lovelace" }),
  ]),
  object("client", [
    field("ipAddress", "ip"),
    field("userAgent", "string", { example: "Mozilla/5.0" }),
  ]),
  object("outcome", [
    field("result", "enum", { enumValues: ["SUCCESS", "FAILURE"] }),
    field("reason", "string", { example: "INVALID_CREDENTIALS", optional: true }),
  ]),
]);

const falconId = field("resource", "id");

const baseVerifiedPresets: VerifiedPresetFile[] = [
  preset({
    auth: { mode: "api-key", apiKey: { in: "header", name: "authorization", value: "SSWS dummy-okta-token" } },
    id: "okta-okta-v2",
    name: "Okta v2",
    pack: "Okta",
    vendor: "Okta",
    summary: "Okta System Log. GET /api/v1/logs returns a JSON array and pages with a Link header.",
    docUrl: "https://developer.okta.com/docs/api/openapi/okta-management/management/tags/systemlog/other/listlogevents",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Okta/Integrations/Okta_v2",
    differences: [
      "Official limit is 0–1000 and defaults to 100. This mock still caps a page at 500 records and 2 MB.",
      "Polling requests (no until, sortOrder ASCENDING) always include rel=next even when the page is empty. Set pagination glitch to endless to simulate that.",
      "since and after are mutually exclusive in the real API. This mock accepts both and uses after as the page token.",
    ],
    operations: [
      op({
        id: "list-logs",
        method: "GET",
        pathTemplate: "/api/v1/logs",
        summary: "List System Log events",
        status: 200,
        list: true,
        envelope: { type: "array" },
        pagination: {
          style: "link",
          limitParam: "limit",
          cursorParam: "after",
          defaultLimit: 100,
          maxLimit: 500,
        },
        record: oktaEvent,
        headers: {
          "x-rate-limit-limit": "100",
          "x-rate-limit-remaining": "99",
        },
      }),
    ],
  }),
  preset({
    auth: {
      mode: "oauth2",
      oauth2: {
        tokenPath: "/oauth2/token",
        clientId: "dummy-falcon-client",
        clientSecret: "dummy-falcon-secret",
        ttlSeconds: 1800,
        shape: "crowdstrike",
      },
    },
    id: "crowdstrikefalcon-crowdstrikefalcon",
    name: "CrowdStrike Falcon",
    pack: "CrowdStrikeFalcon",
    vendor: "CrowdStrike",
    summary: "Falcon Alerts query plus entity fetch. Legacy Detects routes are included because XSOAR still calls them.",
    docUrl: "https://developer.crowdstrike.com/api-reference/collections/alerts/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CrowdStrikeFalcon/Integrations/CrowdStrikeFalcon",
    differences: [
      "CrowdStrike's public docs mark the Detects collection deprecated and decommissioned on 2025-09-30. XSOAR's client still calls /detects/queries/detects/v1 in older tests, so those paths are mocked too.",
      "Query endpoints return resource ids inside meta.pagination. Entity endpoints are POST and return alert objects. This mock does not check the OAuth token.",
      "Falcon's documented query limit can be far above this mock's 500-record page cap.",
    ],
    operations: [
      op({
        id: "query-alerts",
        method: "GET",
        pathTemplate: "/alerts/queries/alerts/v2",
        summary: "Query alert ids",
        status: 200,
        list: true,
        envelope: { type: "falcon" },
        pagination: { style: "offset", defaultLimit: 100, maxLimit: 500 },
        record: falconId,
        headers: { "x-ratelimit-limit": "6000", "x-ratelimit-remaining": "5999" },
      }),
      op({
        id: "get-alerts",
        method: "POST",
        pathTemplate: "/alerts/entities/alerts/v2",
        summary: "Fetch alert entities",
        status: 200,
        list: true,
        envelope: { type: "falcon" },
        pagination: { style: "none", defaultLimit: 20, maxLimit: 100 },
        record: object("alert", [
          field("id", "id"),
          field("composite_id", "id"),
          field("created_timestamp", "timestamp", { format: "iso" }),
          field("updated_timestamp", "timestamp", { format: "iso" }),
          field("status", "enum", { enumValues: ["new", "in_progress", "closed"] }),
          field("severity", "integer"),
          field("severity_name", "enum", { enumValues: ["Low", "Medium", "High", "Critical"] }),
          field("product", "const", { constValue: "epp" }),
          field("tactic", "string", { example: "Defense Evasion" }),
          field("technique", "string", { example: "Masquerading" }),
        ]),
      }),
      op({
        id: "query-detects",
        method: "GET",
        pathTemplate: "/detects/queries/detects/v1",
        summary: "Deprecated detection id query",
        status: 200,
        list: true,
        envelope: { type: "falcon" },
        pagination: { style: "offset", defaultLimit: 100, maxLimit: 500 },
        record: falconId,
      }),
    ],
  }),
  preset({
    auth: {
      mode: "oauth2",
      oauth2: {
        tokenPath: "/oauth2/v2.0/token",
        clientId: "dummy-graph-client",
        clientSecret: "dummy-graph-secret",
        ttlSeconds: 3600,
        shape: "microsoft",
      },
    },
    id: "microsoftgraphsecurity-microsoftgraphsecurity",
    name: "Microsoft Graph Security",
    pack: "MicrosoftGraphSecurity",
    vendor: "Microsoft",
    summary: "GET /security/alerts_v2 with a value array and @odata.nextLink.",
    docUrl: "https://learn.microsoft.com/en-us/graph/api/security-list-alerts_v2?view=graph-rest-1.0",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphSecurity",
    differences: [
      "Microsoft Graph pages with @odata.nextLink. This mock also honors $top and $skip.",
      "The real API may omit @odata.nextLink when a page happens to contain everything. That is not simulated unless you stop before the virtual catalog ends.",
      "Bearer tokens are not checked.",
    ],
    operations: [
      op({
        id: "list-alerts-v2",
        method: "GET",
        pathTemplate: "/v1.0/security/alerts_v2",
        summary: "List security alerts",
        status: 200,
        list: true,
        envelope: {
          type: "odata",
          context: "https://graph.microsoft.com/v1.0/$metadata#security/alerts_v2",
        },
        pagination: {
          style: "offset",
          limitParam: "$top",
          offsetParam: "$skip",
          defaultLimit: 50,
          maxLimit: 500,
        },
        record: object("alert", [
          field("id", "uuid"),
          field("title", "string", { example: "Suspicious sign-in" }),
          field("severity", "enum", { enumValues: ["low", "medium", "high", "unknown"] }),
          field("status", "enum", { enumValues: ["new", "inProgress", "resolved"] }),
          field("serviceSource", "enum", { enumValues: ["microsoftDefenderForEndpoint", "microsoftSentinel"] }),
          field("createdDateTime", "timestamp", { format: "iso" }),
          field("lastUpdateDateTime", "timestamp", { format: "iso" }),
          field("description", "string", { example: "Multiple failed sign-ins from a new location." }),
        ]),
      }),
      op({
        id: "list-alerts-root",
        method: "GET",
        pathTemplate: "/security/alerts_v2",
        summary: "List security alerts without the version prefix",
        status: 200,
        list: true,
        envelope: {
          type: "odata",
          context: "https://graph.microsoft.com/v1.0/$metadata#security/alerts_v2",
        },
        pagination: {
          style: "offset",
          limitParam: "$top",
          offsetParam: "$skip",
          defaultLimit: 50,
          maxLimit: 500,
        },
        record: object("alert", [
          field("id", "uuid"),
          field("title", "string", { example: "Malware detected" }),
          field("severity", "enum", { enumValues: ["informational", "low", "medium", "high"] }),
          field("createdDateTime", "timestamp", { format: "iso" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "virustotal-virustotalv3",
    name: "VirusTotal v3",
    pack: "VirusTotal",
    vendor: "VirusTotal",
    summary: "GET /files/{id} and /ip_addresses/{ip} in the v3 data/attributes envelope.",
    docUrl: "https://docs.virustotal.com/reference/file-info",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/VirusTotal/Integrations/VirusTotalV3",
    differences: [
      "Set the integration base URL to the catch URL. XSOAR appends files/{id}, which replaces https://www.virustotal.com/api/v3.",
      "Relationship links and the analysis stats object are shortened. last_analysis_stats counts are examples, not a live engine vote.",
      "x-api-key is not required.",
    ],
    operations: [
      op({
        id: "file-info",
        method: "GET",
        pathTemplate: "/files/{id}",
        summary: "Get a file report",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("report", [
          object("data", [
            field("id", "id"),
            field("type", "const", { constValue: "file" }),
            object("attributes", [
              field("md5", "id"),
              field("sha1", "id"),
              field("sha256", "id"),
              field("last_analysis_date", "timestamp", { format: "unix" }),
              object("last_analysis_stats", [
                field("malicious", "integer"),
                field("suspicious", "integer"),
                field("undetected", "integer"),
                field("harmless", "integer"),
              ]),
            ]),
          ]),
        ]),
      }),
      op({
        id: "ip-info",
        method: "GET",
        pathTemplate: "/ip_addresses/{ip}",
        summary: "Get an IP address report",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("report", [
          object("data", [
            field("id", "ip"),
            field("type", "const", { constValue: "ip_address" }),
            object("attributes", [
              field("country", "enum", { enumValues: ["US", "DE", "JP"] }),
              field("as_owner", "string", { example: "Example ISP" }),
              field("last_analysis_date", "timestamp", { format: "unix" }),
            ]),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "jira-jirav3",
    name: "Atlassian Jira v3",
    pack: "Jira",
    vendor: "Atlassian",
    summary: "GET /rest/api/3/search/jql returns issues and nextPageToken. The older /search path is included for on-prem clients.",
    docUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Jira/Integrations/JiraV3",
    differences: [
      "XSOAR calls GET /rest/api/3/search/jql and reads issues plus nextPageToken. The older GET /rest/api/3/search is also mocked.",
      "Issue fields are a subset of the official issue schema. names and renderedFields are omitted.",
    ],
    operations: [
      op({
        id: "search-jql",
        method: "GET",
        pathTemplate: "/rest/api/3/search/jql",
        summary: "Search issues",
        status: 200,
        list: true,
        envelope: { type: "token-page", arrayKey: "issues", tokenKey: "nextPageToken" },
        pagination: {
          style: "cursor",
          limitParam: "maxResults",
          cursorParam: "nextPageToken",
          defaultLimit: 50,
          maxLimit: 100,
        },
        record: object("issue", [
          field("id", "id"),
          field("key", "id"),
          field("self", "string", { example: "https://example.atlassian.net/rest/api/3/issue/10001" }),
          object("fields", [
            field("summary", "string", { example: "Investigate failed logins" }),
            object("status", [field("name", "enum", { enumValues: ["To Do", "In Progress", "Done"] })]),
            field("created", "timestamp", { format: "iso" }),
            field("updated", "timestamp", { format: "iso" }),
          ]),
        ]),
      }),
      op({
        id: "search-legacy",
        method: "GET",
        pathTemplate: "/rest/api/3/search",
        summary: "Legacy issue search",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "issues" },
        pagination: {
          style: "offset",
          limitParam: "maxResults",
          offsetParam: "startAt",
          defaultLimit: 50,
          maxLimit: 100,
        },
        record: object("issue", [
          field("id", "id"),
          field("key", "id"),
          object("fields", [
            field("summary", "string", { example: "Legacy search result" }),
            field("created", "timestamp", { format: "iso" }),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "servicenow-servicenowv2",
    name: "ServiceNow v2",
    pack: "ServiceNow",
    vendor: "ServiceNow",
    summary: "Table API GET /api/now/table/{table} with a result array.",
    docUrl: "https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/ServiceNow/Integrations/ServiceNowv2",
    differences: [
      "ServiceNow pages with sysparm_limit and sysparm_offset and returns X-Total-Count. Those headers are set. Link headers are not.",
      "Only the incident table shape is modeled. Other table names still match {table} and return the same incident-shaped rows.",
    ],
    operations: [
      op({
        id: "table-get",
        method: "GET",
        pathTemplate: "/api/now/table/{table}",
        summary: "Retrieve records from a table",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "result" },
        pagination: {
          style: "offset",
          limitParam: "sysparm_limit",
          offsetParam: "sysparm_offset",
          defaultLimit: 20,
          maxLimit: 500,
        },
        headers: { "x-total-count": "500" },
        record: object("incident", [
          field("sys_id", "uuid"),
          field("number", "id"),
          field("short_description", "string", { example: "Suspicious outbound connection" }),
          field("state", "enum", { enumValues: ["1", "2", "3", "6", "7"] }),
          field("priority", "enum", { enumValues: ["1", "2", "3", "4"] }),
          field("sys_created_on", "timestamp", { format: "iso" }),
          field("sys_updated_on", "timestamp", { format: "iso" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "slack-slackv3",
    name: "Slack v3",
    pack: "Slack",
    vendor: "Slack",
    summary: "conversations.history returns ok, messages, and next_cursor.",
    docUrl: "https://docs.slack.dev/reference/methods/conversations.history",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Slack/Integrations/SlackV3",
    differences: [
      "Slack's method is GET conversations.history with channel and cursor. This mock also accepts the path with a leading slash.",
      "ok is always true unless chaos errors are enabled. Slack returns ok:false with an error string for bad tokens. That error shape is not the default.",
    ],
    operations: [
      op({
        id: "conversations-history",
        method: "GET",
        pathTemplate: "/api/conversations.history",
        summary: "Fetch a conversation's history",
        status: 200,
        list: true,
        envelope: { type: "slack" },
        pagination: {
          style: "cursor",
          limitParam: "limit",
          cursorParam: "cursor",
          defaultLimit: 100,
          maxLimit: 200,
        },
        record: object("message", [
          field("type", "const", { constValue: "message" }),
          field("user", "id"),
          field("text", "string", { example: "Investigating the alert" }),
          field("ts", "timestamp", { format: "unix-string" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "proofpointtap-proofpointtap-v2",
    name: "Proofpoint TAP v2",
    pack: "ProofpointTAP",
    vendor: "Proofpoint",
    summary: "SIEM clicks and messages are blocked and permitted arrays for an interval.",
    docUrl: "https://help.proofpoint.com/Threat_Insight_Dashboard/API_Documentation/SIEM_API",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/ProofpointTAP/Integrations/ProofpointTAP_v2",
    differences: [
      "CommonServerPython.urljoin keeps api_version, so the call is GET /{api_version}/siem/clicks/blocked or /{api_version}/siem/clicks/permitted.",
      "The blocked call reads clicksBlocked. The permitted call reads clicksPermitted. The earlier mock used /v2/siem/clicks and only clicksPermitted.",
      "interval is required by the client and is not applied here. Messages are not modeled.",
    ],
    operations: [
      op({
        id: "clicks-blocked",
        method: "GET",
        pathTemplate: "/{api_version}/siem/clicks/blocked",
        summary: "Blocked clicks",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("clicks", [
          field("queryEndTime", "timestamp", { format: "iso" }),
          field("clicksBlocked", "array", {
            item: object("click", [
              field("id", "uuid"),
              field("clickTime", "timestamp", { format: "iso" }),
              field("threatTime", "timestamp", { format: "iso" }),
              field("recipient", "email"),
              field("senderIP", "ip"),
              field("threatStatus", "enum", { enumValues: ["active", "cleared", "falsePositive"] }),
            ]),
            minItems: 1,
            maxItems: 1,
          }),
        ]),
      }),
      op({
        id: "clicks-permitted",
        method: "GET",
        pathTemplate: "/{api_version}/siem/clicks/permitted",
        summary: "Permitted clicks",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("clicks", [
          field("queryEndTime", "timestamp", { format: "iso" }),
          field("clicksPermitted", "array", {
            item: object("click", [
              field("id", "uuid"),
              field("clickTime", "timestamp", { format: "iso" }),
              field("threatTime", "timestamp", { format: "iso" }),
              field("recipient", "email"),
              field("senderIP", "ip"),
              field("threatStatus", "enum", { enumValues: ["active", "cleared", "falsePositive"] }),
            ]),
            minItems: 1,
            maxItems: 1,
          }),
        ]),
      }),
    ],
  }),
  preset({
    id: "zscaler-zscaler",
    name: "Zscaler Internet Access",
    pack: "Zscaler",
    vendor: "Zscaler",
    summary: "POST /api/v1/urlLookup returns one classification object per URL.",
    docUrl: "https://help.zscaler.com/zia/url-lookup",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Zscaler/Integrations/Zscaler",
    differences: [
      "The public lookup response is a JSON array of url, urlClassifications, and urlClassificationsWithSecurityAlert. The request body of URLs is not echoed back; each row uses a sample URL.",
      "Session cookies and the obfuscated API key are not checked.",
    ],
    operations: [
      op({
        id: "url-lookup",
        method: "POST",
        pathTemplate: "/api/v1/urlLookup",
        summary: "Look up URL categories",
        status: 200,
        list: true,
        envelope: { type: "array" },
        pagination: { style: "none", defaultLimit: 2, maxLimit: 20 },
        record: object("classification", [
          field("url", "string", { example: "example.com" }),
          field("urlClassifications", "array", {
            item: field("category", "enum", { enumValues: ["NEWS_AND_MEDIA", "FINANCE", "MALWARE"] }),
            minItems: 1,
            maxItems: 1,
          }),
          field("urlClassificationsWithSecurityAlert", "array", {
            item: field("category", "enum", { enumValues: ["MALWARE"] }),
            minItems: 0,
            maxItems: 1,
          }),
        ]),
      }),
    ],
  }),
  preset({
    id: "azuresentinel-azuresentinel",
    name: "Microsoft Sentinel",
    pack: "AzureSentinel",
    vendor: "Microsoft",
    summary: "GET incidents returns value and nextLink. XSOAR calls this under the SecurityInsights workspace URL.",
    docUrl: "https://learn.microsoft.com/en-us/rest/api/securityinsights/incidents/list?view=rest-securityinsights-2024-03-01",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/AzureSentinel/Integrations/AzureSentinel",
    differences: [
      "Point the integration server URL at the catch URL plus the workspace path ending in Microsoft.SecurityInsights. The client appends incidents and api-version=2024-03-01.",
      "Pages use nextLink. $top is honored up to 500. Azure's documented maximum for $top is 1000.",
      "Arm authorization is not checked.",
    ],
    operations: [
      op({
        id: "list-incidents",
        method: "GET",
        pathTemplate: "/incidents",
        summary: "List Sentinel incidents",
        status: 200,
        list: true,
        envelope: { type: "azure" },
        pagination: {
          style: "cursor",
          limitParam: "$top",
          cursorParam: "$skipToken",
          defaultLimit: 50,
          maxLimit: 500,
        },
        record: object("incident", [
          field("id", "string", { example: "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/ws/providers/Microsoft.SecurityInsights/incidents/1" }),
          field("name", "id"),
          field("type", "const", { constValue: "Microsoft.SecurityInsights/incidents" }),
          object("properties", [
            field("title", "string", { example: "Suspicious sign-in" }),
            field("severity", "enum", { enumValues: ["Informational", "Low", "Medium", "High"] }),
            field("status", "enum", { enumValues: ["New", "Active", "Closed"] }),
            field("createdTimeUtc", "timestamp", { format: "iso" }),
            field("lastModifiedTimeUtc", "timestamp", { format: "iso" }),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "gsuitesecurityalertcenter-gsuitesecurityalertcenter",
    name: "G Suite Security Alert Center",
    pack: "GSuiteSecurityAlertCenter",
    vendor: "Google",
    summary: "GET /v1beta1/alerts returns alerts and nextPageToken.",
    docUrl: "https://developers.google.com/workspace/admin/alertcenter/reference/rest/v1beta1/alerts/list",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/GSuiteSecurityAlertCenter",
    differences: [
      "pageSize and pageToken match the Alert Center list method. An empty nextPageToken means the last page.",
      "Alert data payloads differ by source. This mock includes the common alert fields and a short data object.",
    ],
    operations: [
      op({
        id: "list-alerts",
        method: "GET",
        pathTemplate: "/v1beta1/alerts",
        summary: "List Workspace alerts",
        status: 200,
        list: true,
        envelope: { type: "token-page", arrayKey: "alerts", tokenKey: "nextPageToken" },
        pagination: {
          style: "cursor",
          limitParam: "pageSize",
          cursorParam: "pageToken",
          defaultLimit: 20,
          maxLimit: 100,
        },
        record: object("alert", [
          field("alertId", "id"),
          field("customerId", "const", { constValue: "C01234567" }),
          field("type", "enum", { enumValues: ["Suspicious login", "Phishing"] }),
          field("source", "const", { constValue: "Google Operations" }),
          field("createTime", "timestamp", { format: "iso" }),
          field("startTime", "timestamp", { format: "iso" }),
          field("updateTime", "timestamp", { format: "iso" }),
          object("data", [field("email", "email")]),
        ]),
      }),
    ],
  }),
  preset({
    id: "ciscoumbrellareporting-ciscoumbrellareporting",
    name: "Cisco Umbrella Reporting",
    pack: "CiscoUmbrellaReporting",
    vendor: "Cisco",
    summary: "GET /reports/v2/activity/dns returns a data array. The XSOAR client reads data.",
    docUrl: "https://developer.cisco.com/docs/cloud-security/umbrella-api-api-reference-reports-reporting-api-activity-get-activity-dns/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CiscoUmbrellaReporting",
    differences: [
      "from, to, and limit are required by Cisco. This mock still answers if they are omitted.",
      "A real deployment may 302 to a regional reports host. This mock returns 200 directly.",
      "OAuth is not checked.",
    ],
    operations: [
      op({
        id: "activity-dns",
        method: "GET",
        pathTemplate: "/reports/v2/activity/dns",
        summary: "List DNS activity",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "data" },
        pagination: { style: "offset", defaultLimit: 100, maxLimit: 500 },
        record: object("activity", [
          field("timestamp", "timestamp", { format: "unix-ms" }),
          field("domain", "string", { example: "example.com" }),
          field("verdict", "enum", { enumValues: ["allowed", "blocked"] }),
          field("categories", "array", {
            item: object("category", [field("label", "enum", { enumValues: ["Malware", "Phishing"] })]),
            minItems: 1,
            maxItems: 1,
          }),
          field("identities", "array", {
            item: object("identity", [field("label", "string", { example: "laptop" })]),
            minItems: 1,
            maxItems: 1,
          }),
        ]),
      }),
    ],
  }),
  preset({
    id: "microsoft365defender-microsoft365defender",
    name: "Microsoft 365 Defender",
    pack: "Microsoft365Defender",
    vendor: "Microsoft",
    summary: "Defender XDR incidents plus advanced hunting. The XSOAR client calls api/incidents and api/advancedhunting/run.",
    docUrl: "https://learn.microsoft.com/en-us/microsoft-365/security/defender/api-list-incidents",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Microsoft365Defender/Integrations/Microsoft365Defender",
    differences: [
      "Microsoft now documents this API as Microsoft Defender XDR. The incidents list is { value: [...] }. nextLink is included while pages remain.",
      "POST /api/advancedhunting/run returns { Results: [...] }. Schema and Stats from the public response are omitted.",
      "Alerts nested on an incident are shortened. Bearer tokens are not checked.",
    ],
    operations: [
      op({
        id: "list-incidents",
        method: "GET",
        pathTemplate: "/api/incidents",
        summary: "List Defender incidents",
        status: 200,
        list: true,
        envelope: { type: "azure" },
        pagination: { style: "offset", limitParam: "$top", offsetParam: "$skip", defaultLimit: 50, maxLimit: 100 },
        record: object("incident", [
          field("incidentId", "integer"),
          field("incidentName", "string", { example: "Multi-stage incident" }),
          field("severity", "enum", { enumValues: ["Low", "Medium", "High"] }),
          field("status", "enum", { enumValues: ["Active", "Resolved", "Redirected"] }),
          field("createdTime", "timestamp", { format: "iso" }),
          field("lastUpdateTime", "timestamp", { format: "iso" }),
        ]),
      }),
      op({
        id: "advanced-hunting",
        method: "POST",
        pathTemplate: "/api/advancedhunting/run",
        summary: "Run an advanced hunting query",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 20, maxLimit: 100 },
        record: object("hunting", [
          {
            name: "Results",
            kind: "array",
            pageItems: true,
            item: object("row", [
              field("Timestamp", "timestamp", { format: "iso" }),
              field("AlertId", "id"),
              field("DeviceName", "string", { example: "lab-workstation" }),
              field("ActionType", "string", { example: "ProcessCreated" }),
            ]),
          },
        ]),
      }),
    ],
  }),
  preset({
    id: "splunkpy-splunkpy",
    name: "SplunkPy",
    pack: "SplunkPy",
    vendor: "Splunk",
    summary: "Search job export as JSON lines, which is what JSONResultsReader consumes when output_mode=json.",
    docUrl: "https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-tutorials/10.2/rest-api-tutorials/creating-searches-using-the-rest-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/SplunkPy",
    differences: [
      "Creating a job at POST /services/search/jobs returns XML by default. This mock returns JSON { sid } as if output_mode=json was set.",
      "POST /services/search/jobs/export returns one JSON object per line with a result field. That matches the export reader the XSOAR pack uses for oneshot search.",
      "Splunk authentication and the management port are not checked.",
    ],
    notes: [
      "The pack was not in the inferred catalog because its client uses splunklib rather than a JSON sample. This preset was added from the public REST reference.",
    ],
    operations: [
      op({
        id: "create-job",
        method: "POST",
        pathTemplate: "/services/search/jobs",
        summary: "Create a search job",
        status: 201,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("job", [field("sid", "id")]),
      }),
      op({
        id: "export",
        method: "POST",
        pathTemplate: "/services/search/jobs/export",
        summary: "Stream search results",
        status: 200,
        list: true,
        envelope: { type: "splunk-export" },
        contentType: "application/json; charset=utf-8",
        pagination: { style: "offset", limitParam: "count", defaultLimit: 100, maxLimit: 500 },
        record: object("event", [
          field("_time", "timestamp", { format: "iso" }),
          field("host", "string", { example: "search-head" }),
          field("source", "string", { example: "pan-parrot" }),
          field("sourcetype", "const", { constValue: "parrot:mock" }),
          field("_raw", "string", { example: "user=ada action=login" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "pan-os-panorama",
    name: "Palo Alto Networks PAN-OS",
    pack: "PAN-OS",
    vendor: "Palo Alto Networks",
    summary: "XML API for keygen, op, config, commit, and job polling.",
    docUrl: "https://docs.paloaltonetworks.com/ngfw/api/pan-os",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PAN-OS/Integrations/Panorama",
    differences: [
      "XSOAR calls GET /api/ with type=keygen, type=op, type=config, type=commit, and type=log. The body is the PAN-OS XML response.",
      "type=commit returns a job id. Poll that job with type=op and job=10. A log query uses type=log, then type=log and action=get. nlogs is capped at 500.",
      "The real show-jobs command is an XML cmd on type=op. This mock uses job= as a short poll. Export and user-id are not modeled. The dummy key is not a firewall credential.",
    ],
    auth: {
      mode: "panos-key",
      panos: { username: "lab-admin", password: "dummy-not-a-real-password", apiKey: "dummy-panos-api-key" },
    },
    operations: [
      op({
        id: "keygen",
        method: "GET",
        pathTemplate: "/api",
        summary: "Generate an API key",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        queryMatch: { type: "keygen" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [field("key", "const", { constValue: "dummy-panos-api-key" })]),
        ]),
      }),
      op({
        id: "op",
        method: "GET",
        pathTemplate: "/api",
        summary: "Operational command",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        queryMatch: { type: "op" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [
            object("system", [
              field("hostname", "string", { example: "lab-fw" }),
              field("sw-version", "const", { constValue: "11.1.0" }),
              field("model", "const", { constValue: "PA-VM" }),
            ]),
          ]),
        ]),
      }),
      op({
        id: "config",
        method: "GET",
        pathTemplate: "/api",
        summary: "Read config",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        queryMatch: { type: "config" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [
            object("entry", [
              field("name", "string", { example: "localhost.localdomain", xml: { attribute: true } }),
            ]),
          ]),
        ]),
      }),
      op({
        id: "commit",
        method: "GET",
        pathTemplate: "/api",
        summary: "Commit the candidate config",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        queryMatch: { type: "commit" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [field("job", "const", { constValue: "10" })]),
        ]),
      }),
      op({
        id: "job-poll",
        method: "GET",
        pathTemplate: "/api",
        summary: "Poll a commit or log job",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        queryMatch: { type: "op", job: "10" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [
            object("job", [
              field("id", "const", { constValue: "10" }),
              field("status", "const", { constValue: "FIN" }),
              field("progress", "const", { constValue: "100" }),
              field("result", "const", { constValue: "OK" }),
            ]),
          ]),
        ]),
      }),
      op({
        id: "log-job",
        method: "GET",
        pathTemplate: "/api",
        summary: "Start a log query job",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        queryMatch: { type: "log" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [field("job", "const", { constValue: "1" })]),
        ]),
      }),
      op({
        id: "log-get",
        method: "GET",
        pathTemplate: "/api",
        summary: "Fetch logs for a job",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        queryMatch: { type: "log", action: "get" },
        pagination: { style: "offset", limitParam: "nlogs", defaultLimit: 20, maxLimit: 500 },
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [
            object("job", [
              field("id", "const", { constValue: "1" }),
              field("status", "const", { constValue: "FIN" }),
            ]),
            object("log", [
              object("logs", [
                field("count", "const", { constValue: "20", xml: { attribute: true } }),
                {
                  name: "entry",
                  kind: "array",
                  pageItems: true,
                  item: object("entry", [
                    field("logid", "id", { xml: { attribute: true } }),
                    field("receive_time", "timestamp", { format: "iso" }),
                    field("src", "ip"),
                    field("dst", "ip"),
                    field("action", "enum", { enumValues: ["allow", "deny"] }),
                    field("rule", "string", { example: "allow-lab" }),
                  ]),
                },
              ]),
            ]),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "palo-alto-networks-wildfire-palo-alto-networks-wildfire-v2",
    name: "Palo Alto Networks WildFire v2",
    pack: "Palo_Alto_Networks_WildFire",
    vendor: "Palo Alto Networks",
    summary: "WildFire verdict, report, and URL submit as XML.",
    docUrl: "https://docs.paloaltonetworks.com/wildfire/u-v/wildfire-api/get-wildfire-information-through-the-wildfire-api/get-a-wildfire-verdict-wildfire-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Palo_Alto_Networks_WildFire/Integrations/Palo_Alto_Networks_WildFire_v2",
    differences: [
      "The public verdict response is XML. Verdict codes are 0 benign, 1 malware, 2 grayware, 4 phishing, 5 C2, and the negative pending codes.",
      "XSOAR posts to /publicapi/get/verdict, /publicapi/get/report, and /publicapi/submit/link with an apikey form field. This mock checks the dummy key.",
      "The report is XML file_info. URL submit returns submit-link-info. File upload and PDF reports are not modeled. An invalid hash is not HTTP 421.",
    ],
    auth: { mode: "api-key", apiKey: { in: "form", name: "apikey", value: "dummy-wildfire-key" } },
    operations: [
      op({
        id: "verdict",
        method: "POST",
        pathTemplate: "/publicapi/get/verdict",
        summary: "Get a WildFire verdict",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("wildfire", [
          object("get-verdict-info", [
            field("md5", "id"),
            field("sha256", "id"),
            field("verdict", "enum", { enumValues: ["0", "1", "2", "4", "5", "-100"] }),
          ]),
        ]),
      }),
      op({
        id: "report",
        method: "POST",
        pathTemplate: "/publicapi/get/report",
        summary: "Get a WildFire XML report",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("wildfire", [
          object("file_info", [
            field("md5", "id"),
            field("sha256", "id"),
            field("malware", "enum", { enumValues: ["yes", "no"] }),
            field("filetype", "const", { constValue: "PE" }),
            field("size", "integer"),
          ]),
        ]),
      }),
      op({
        id: "submit-link",
        method: "POST",
        pathTemplate: "/publicapi/submit/link",
        summary: "Submit a URL for analysis",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("wildfire", [
          object("submit-link-info", [
            field("url", "string", { example: "http://example.test/sample" }),
            field("sha256", "id"),
            field("md5", "id"),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "mimecast-mimecastv2",
    name: "Mimecast v2",
    pack: "Mimecast",
    vendor: "Mimecast",
    summary: "SIEM logs as a zip plus an mc-siem-token header.",
    docUrl: "https://integrations.mimecast.com/documentation/endpoint-reference/logs-and-statistics/get-siem-logs/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Mimecast/Integrations/MimecastEventCollector",
    differences: [
      "POST /api/audit/get-siem-logs returns application/octet-stream with Content-Disposition filename ending in .zip, which is what the XSOAR event collector accepts.",
      "The zip contains one JSON file with type MTA and a data array. The next page token is the mc-siem-token response header. Send it back as data[0].token.",
      "Production signs the request. This mock only checks that Authorization, x-mc-date, x-mc-req-id, and x-mc-app-id are present. The signature is not verified.",
      "A JSON body meaning there are no further logs is not the default. Stop paging when the catalog ends and the header is absent.",
    ],
    auth: {
      mode: "signed-headers",
      signedHeaders: {
        names: ["authorization", "x-mc-date", "x-mc-req-id", "x-mc-app-id"],
        verify: "format-only",
      },
    },
    operations: [
      op({
        id: "siem-logs",
        method: "POST",
        pathTemplate: "/api/audit/get-siem-logs",
        summary: "Download the next SIEM log batch",
        status: 200,
        list: true,
        envelope: { type: "array" },
        contentType: "application/json; charset=utf-8",
        pagination: { style: "header", cursorParam: "token", headerName: "mc-siem-token", defaultLimit: 20, maxLimit: 500 },
        pack: {
          format: "zip",
          filename: "siem.zip",
          entryName: "mta.json",
          entryFormat: "wrapped-json",
          wrapperType: "MTA",
        },
        record: object("event", [
          field("datetime", "timestamp", { format: "iso" }),
          field("aCode", "id"),
          field("Act", "enum", { enumValues: ["Acc", "Hld", "Rej"] }),
          field("MsgId", "id"),
          field("Sender", "email"),
          field("Rcpt", "email"),
        ]),
      }),
    ],
  }),
  preset({
    id: "github-github",
    name: "GitHub",
    pack: "GitHub",
    vendor: "GitHub",
    summary: "GET /repos/{owner}/{repo}/issues returns the issue array the XSOAR client requests.",
    docUrl: "https://docs.github.com/en/rest/issues/issues#list-repository-issues",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/GitHub/Integrations/GitHub",
    differences: [
      "The XSOAR client calls /repos/{owner}/{repo}/issues. This mock returns a JSON array of issues with number, title, state, and created_at.",
      "GitHub pages with a Link header. This mock uses limit and page query parameters instead of that header.",
      "Authorization is not required. Fine-grained permission errors are not simulated.",
    ],
    operations: [
      op({
        id: "list-issues",
        method: "GET",
        pathTemplate: "/repos/{owner}/{repo}/issues",
        summary: "List repository issues",
        status: 200,
        list: true,
        envelope: { type: "array" },
        pagination: { style: "page", pageParam: "page", limitParam: "per_page", defaultLimit: 30, maxLimit: 100 },
        record: object("issue", [
          field("id", "integer"),
          field("number", "integer"),
          field("title", "string", { example: "Investigate failed logins" }),
          field("state", "enum", { enumValues: ["open", "closed"] }),
          field("html_url", "string", { example: "https://github.com/example/repo/issues/1" }),
          field("created_at", "timestamp", { format: "iso" }),
          field("updated_at", "timestamp", { format: "iso" }),
          object("user", [field("login", "string", { example: "octocat" })]),
        ]),
      }),
    ],
  }),
  preset({
    id: "microsoftdefenderadvancedthreatprotection-microsoftdefenderadvancedthreatprotect",
    name: "Microsoft Defender for Endpoint",
    pack: "MicrosoftDefenderAdvancedThreatProtection",
    vendor: "Microsoft",
    summary: "GET /api/alerts returns a value array of endpoint alerts.",
    docUrl: "https://learn.microsoft.com/en-us/defender-endpoint/api/get-alerts",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/MicrosoftDefenderAdvancedThreatProtection",
    differences: [
      "The alerts list is { value: [...] }. $top and $skip page it. The real API also accepts $filter as OData.",
      "Machine actions and indicator import are not modeled.",
      "Bearer tokens are not checked.",
    ],
    operations: [
      op({
        id: "list-alerts",
        method: "GET",
        pathTemplate: "/api/alerts",
        summary: "List Defender for Endpoint alerts",
        status: 200,
        list: true,
        envelope: { type: "odata", context: "https://api.securitycenter.microsoft.com/api/$metadata#Alerts" },
        pagination: { style: "offset", limitParam: "$top", offsetParam: "$skip", defaultLimit: 50, maxLimit: 500 },
        record: object("alert", [
          field("id", "id"),
          field("title", "string", { example: "Suspicious process" }),
          field("severity", "enum", { enumValues: ["Informational", "Low", "Medium", "High"] }),
          field("status", "enum", { enumValues: ["New", "InProgress", "Resolved"] }),
          field("category", "string", { example: "Execution" }),
          field("alertCreationTime", "timestamp", { format: "iso" }),
          field("lastUpdateTime", "timestamp", { format: "iso" }),
          field("machineId", "id"),
        ]),
      }),
    ],
  }),
  preset({
    id: "cortexxdr-cortexxdrir",
    name: "Palo Alto Networks Cortex XDR - Investigation and Response",
    pack: "CortexXDR",
    vendor: "Palo Alto Networks",
    summary: "Incidents, alerts, endpoints, and isolate as reply JSON.",
    docUrl: "https://docs-cortex.paloaltonetworks.com/r/Cortex-XDR-REST-API/Get-Incidents",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CortexXDR/Integrations/CortexXDRIR",
    differences: [
      "The XSOAR client POSTs to /public_api/v1/incidents/get_incidents, /alerts/get_alerts/, and /endpoints/get_endpoint/. Each body is { reply: { total_count, result_count, ... } }.",
      "The real API takes search_from and search_to inside request_data. This mock reads those names from the query string.",
      "POST /public_api/v1/endpoints/isolate and /unisolate return reply.action_id. API key headers are not checked. Extra-data and script runs are not modeled.",
    ],
    operations: [
      op({
        id: "get-incidents",
        method: "POST",
        pathTemplate: "/public_api/v1/incidents/get_incidents",
        summary: "Get incidents",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "offset", limitParam: "search_to", offsetParam: "search_from", defaultLimit: 20, maxLimit: 100 },
        record: object("body", [
          object("reply", [
            field("total_count", "integer"),
            field("result_count", "integer"),
            {
              name: "incidents",
              kind: "array",
              pageItems: true,
              item: object("incident", [
                field("incident_id", "id"),
                field("creation_time", "timestamp", { format: "unix-ms" }),
                field("modification_time", "timestamp", { format: "unix-ms" }),
                field("status", "enum", { enumValues: ["new", "under_investigation", "resolved"] }),
                field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
                field("description", "string", { example: "Malware detected on a host" }),
              ]),
            },
          ]),
        ]),
      }),
      op({
        id: "get-alerts",
        method: "POST",
        pathTemplate: "/public_api/v1/alerts/get_alerts/",
        summary: "Get alerts",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "offset", limitParam: "search_to", offsetParam: "search_from", defaultLimit: 20, maxLimit: 100 },
        record: object("body", [
          object("reply", [
            field("total_count", "integer"),
            field("result_count", "integer"),
            {
              name: "alerts",
              kind: "array",
              pageItems: true,
              item: object("alert", [
                field("alert_id", "id"),
                field("detection_timestamp", "timestamp", { format: "unix-ms" }),
                field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
                field("name", "string", { example: "Suspicious process execution" }),
                field("category", "string", { example: "Malware" }),
              ]),
            },
          ]),
        ]),
      }),
      op({
        id: "get-endpoints",
        method: "POST",
        pathTemplate: "/public_api/v1/endpoints/get_endpoint/",
        summary: "Get endpoints",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "offset", limitParam: "search_to", offsetParam: "search_from", defaultLimit: 20, maxLimit: 100 },
        record: object("body", [
          object("reply", [
            field("total_count", "integer"),
            field("result_count", "integer"),
            {
              name: "endpoints",
              kind: "array",
              pageItems: true,
              item: object("endpoint", [
                field("endpoint_id", "id"),
                field("endpoint_name", "string", { example: "lab-workstation" }),
                field("endpoint_status", "enum", { enumValues: ["connected", "disconnected", "lost"] }),
                field("os_type", "enum", { enumValues: ["windows", "linux", "macos"] }),
                field("ip", "ip"),
                field("last_seen", "timestamp", { format: "unix-ms" }),
              ]),
            },
          ]),
        ]),
      }),
      op({
        id: "isolate",
        method: "POST",
        pathTemplate: "/public_api/v1/endpoints/isolate",
        summary: "Isolate endpoints",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("body", [
          object("reply", [field("action_id", "id"), field("endpoints_count", "integer")]),
        ]),
      }),
      op({
        id: "unisolate",
        method: "POST",
        pathTemplate: "/public_api/v1/endpoints/unisolate",
        summary: "Remove endpoint isolation",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("body", [
          object("reply", [field("action_id", "id"), field("endpoints_count", "integer")]),
        ]),
      }),
    ],
  }),
];

const wizPreset = preset({
  id: "wiz-wiz",
  name: "Wiz",
  pack: "Wiz",
  vendor: "Wiz",
  summary: "GraphQL issuesV2 connection. The selection set decides the fields, and first/after walk the catalog.",
  docUrl: "https://win.wiz.io/reference/issues-query",
  sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Wiz/Integrations/Wiz",
  checkedAt: "2026-11-10",
  totalRecords: 1000,
  auth: {
    mode: "oauth2",
    oauth2: {
      tokenPath: "/oauth/token",
      clientId: "dummy-client",
      clientSecret: "dummy-secret",
      ttlSeconds: 3600,
      shape: "generic",
      refresh: true,
    },
  },
  graphql: { schema: WIZ_SDL, exampleQuery: WIZ_EXAMPLE_QUERY },
  differences: [
    "The public Issues reference (win.wiz.io) did not return a page from this network. The field list was checked against Panther's published Wiz.Issues schema, which cites that URL, the IssuesTable query in demisto/content, and the Elastic Agent Wiz query that cites Wiz's March 5, 2025 sourceRules note.",
    "This is the issuesV2 subset, not the whole Wiz graph. Cloud resource search and threat-detection evidence fragments are not in the schema.",
    "sourceRule is still here because the current XSOAR client selects it. sourceRules is also here, from the public deprecation note.",
    "Issue type is a string. The public excerpts do not list the type enum.",
    "filterBy and orderBy are accepted and not applied, so a load test still walks the catalog.",
    "first is capped at 500. The catalog size is totalRecords.",
    "POST /oauth/token on this catch URL issues the dummy bearer. Point the integration auth URL at that path.",
  ],
  operations: [
    op({
      id: "graphql",
      method: "POST",
      pathTemplate: "/graphql",
      summary: "issuesV2 and any other query the schema allows",
      status: 200,
      list: false,
      envelope: { type: "graphql" },
      record: { name: "data", kind: "object", children: [] },
    }),
  ],
});

function applyCrosscheck(preset: VerifiedPresetFile): VerifiedPresetFile {
  const reason = presetDowngrades[preset.id];
  if (!reason) return preset;
  return {
    ...preset,
    fidelity: "guessed",
    notes: [reason],
    spec: {
      ...preset.spec,
      source: {
        ...preset.spec.source,
        fidelity: "guessed",
        notes: [reason],
        verification: undefined,
      },
    },
  };
}

function applyReverify(preset: VerifiedPresetFile): VerifiedPresetFile {
  const overlay = reverifiedOverlays[preset.id];
  if (!overlay) return applyCrosscheck(preset);
  return {
    ...preset,
    fidelity: "verified",
    summary: overlay.summary,
    notes: overlay.differences,
    sourceUrl: overlay.sourceUrl,
    spec: {
      ...preset.spec,
      operations: overlay.operations,
      source: {
        ...preset.spec.source,
        fidelity: "verified",
        notes: overlay.differences,
        verification: {
          status: "verified",
          docUrl: overlay.docUrl,
          checkedAt: "2026-11-10",
          differences: overlay.differences,
        },
      },
    },
  };
}

const authoredPresets: VerifiedPresetFile[] = [
  ...baseVerifiedPresets,
  ...moreVerifiedPresets,
  wizPreset,
  ...fetchVerifiedPresets,
  ...intelVerifiedPresets,
  ...responseVerifiedPresets,
  ...awsQueryVerifiedPresets,
  ...panSiemVerifiedPresets,
  ...usageVerifiedPresets,
  ...identityVerifiedPresets,
].map(applyReverify);

export const verifiedPresets: VerifiedPresetFile[] = authoredPresets.filter((preset) => preset.fidelity === "verified");

export const checkedNotUpgraded: Array<{
  id: string;
  docUrl: string;
  differences: string[];
}> = [];

export function akamaiVerificationPatch(): {
  differences: string[];
  docUrl: string;
} {
  return {
    docUrl: "https://techdocs.akamai.com/siem-integration/reference/get-config",
    differences: [
      "Akamai's default limit is 10000 and the documented maximum is 600000. This mock returns at most 500 events and 2 MB per call, then an offset for the next page.",
      "If from and offset are both present, Akamai uses time mode. This mock does the same.",
      "The offset token in production is a long opaque string. This mock uses a shorter pp_ token that still round-trips.",
      "Optional botData, clientData, and userRiskData objects are omitted. httpMessage.query was added because the public event schema requires it.",
      "429 responses from Akamai use application/problem+json. Chaos errors from this mock are a small JSON object plus Retry-After on 429 and 503.",
    ],
  };
}
