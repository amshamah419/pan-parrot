import { defaultChaos, defaultPagination, type FieldSpec, type MockAuth, type MockSpec } from "./mock-spec";

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
    headerMatch: partial.headerMatch,
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

function preset(input: {
  id: string;
  name: string;
  pack: string;
  vendor: string;
  summary: string;
  docUrl: string;
  sourceUrl: string;
  differences: string[];
  operations: MockSpec["operations"];
  auth?: MockAuth;
}): {
  id: string;
  name: string;
  pack: string;
  vendor: string;
  fidelity: "verified";
  curated: true;
  summary: string;
  notes: string[];
  attribution: string;
  sourceUrl: string;
  spec: MockSpec;
} {
  return {
    id: input.id,
    name: input.name,
    pack: input.pack,
    vendor: input.vendor,
    fidelity: "verified",
    curated: true,
    summary: input.summary,
    notes: input.differences,
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
        notes: [],
        verification: {
          status: "verified",
          docUrl: input.docUrl,
          checkedAt,
          differences: input.differences,
        },
      },
      operations: input.operations,
      chaos: defaultChaos(input.id),
      totalRecords: 500,
      auth: input.auth ?? { mode: "none" },
    },
  };
}

const qradarOffense = object("offense", [
  field("id", "integer"),
  field("description", "string", { example: "Multiple login failures" }),
  field("status", "enum", { enumValues: ["OPEN", "HIDDEN", "CLOSED"] }),
  field("magnitude", "integer"),
  field("offense_type", "integer"),
  field("start_time", "timestamp", { format: "unix-ms" }),
  field("last_updated_time", "timestamp", { format: "unix-ms" }),
  field("source_address_ids", "array", { item: field("id", "integer"), minItems: 1, maxItems: 1 }),
]);

export const moreVerifiedPresets = [
  preset({
    id: "qradar-qradar-v3",
    name: "IBM QRadar v3",
    pack: "QRadar",
    vendor: "IBM",
    summary: "GET /siem/offenses returns the offense array. Ariel search create and results are included.",
    docUrl: "https://ibmsecuritydocs.github.io/qradar_api_21.0/21.0--siem_offenses--get.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/QRadar/Integrations/QRadar_v3",
    auth: { mode: "api-key", apiKey: { in: "header", name: "SEC", value: "dummy-qradar-token" } },
    differences: [
      "QRadar returns a JSON array and pages with the Range header items=0-49. This mock uses limit and offset query parameters and does not read Range.",
      "POST /ariel/searches returns { search_id, status }. GET /ariel/searches/{search_id}/results returns { events }. The cursor and the completed-search wait are not modeled.",
      "The SEC header must be the dummy token. Version header is not checked.",
    ],
    operations: [
      op({
        id: "list-offenses",
        method: "GET",
        pathTemplate: "/siem/offenses",
        summary: "List offenses",
        status: 200,
        list: true,
        envelope: { type: "array" },
        pagination: { style: "offset", limitParam: "limit", offsetParam: "offset", defaultLimit: 50, maxLimit: 500 },
        record: qradarOffense,
      }),
      op({
        id: "create-search",
        method: "POST",
        pathTemplate: "/ariel/searches",
        summary: "Create an Ariel search",
        status: 201,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("search", [
          field("search_id", "id"),
          field("status", "const", { constValue: "COMPLETED" }),
        ]),
      }),
      op({
        id: "search-results",
        method: "GET",
        pathTemplate: "/ariel/searches/{search_id}/results",
        summary: "Get Ariel search results",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "offset", limitParam: "limit", offsetParam: "offset", defaultLimit: 50, maxLimit: 500 },
        record: object("results", [
          {
            name: "events",
            kind: "array",
            pageItems: true,
            item: object("event", [
              field("qid", "integer"),
              field("sourceip", "ip"),
              field("destinationip", "ip"),
              field("username", "string", { example: "lab-user" }),
              field("starttime", "timestamp", { format: "unix-ms" }),
            ]),
          },
        ]),
      }),
    ],
  }),
  preset({
    id: "elasticsearch-elasticsearch-v2",
    name: "Elasticsearch v2",
    pack: "Elasticsearch",
    vendor: "Elastic",
    summary: "POST /{index}/_search returns the hits envelope the Elasticsearch client reads.",
    docUrl: "https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-search",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Elasticsearch/Integrations/Elasticsearch_v2",
    auth: { mode: "basic", basic: { username: "elastic", password: "dummy-not-a-real-password" } },
    differences: [
      "The public search response is { took, hits: { total, hits: [ { _index, _id, _source } ] } }. This mock returns that shape.",
      "total is a number on clusters before 7.0 and an object after. This mock uses the 7+ object. Shards, timed_out, and aggregations are omitted.",
      "Basic auth is checked with the dummy elastic user. API keys and the Elastic Cloud host are not modeled.",
    ],
    operations: [
      op({
        id: "search",
        method: "POST",
        pathTemplate: "/{index}/_search",
        summary: "Search an index",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "offset", limitParam: "size", offsetParam: "from", defaultLimit: 10, maxLimit: 100 },
        record: object("search", [
          field("took", "integer"),
          object("hits", [
            object("total", [
              field("value", "integer"),
              field("relation", "const", { constValue: "eq" }),
            ]),
            {
              name: "hits",
              kind: "array",
              pageItems: true,
              item: object("hit", [
                field("_index", "string", { example: "logs" }),
                field("_id", "id"),
                object("_source", [
                  field("message", "string", { example: "Failed password for lab-user" }),
                  field("@timestamp", "timestamp", { format: "iso" }),
                  field("host", "string", { example: "lab-workstation" }),
                ]),
              ]),
            },
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "gmail-gmail",
    name: "Gmail",
    pack: "Gmail",
    vendor: "Google",
    summary: "GET /gmail/v1/users/{userId}/messages lists ids, then GET of one message returns the message resource.",
    docUrl: "https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Gmail/Integrations/Gmail",
    auth: { mode: "bearer", bearer: { token: "dummy-gmail-token" } },
    differences: [
      "users.messages.list returns { messages: [{ id, threadId }], nextPageToken, resultSizeEstimate }. This mock does that.",
      "users.messages.get returns id, threadId, snippet, and a short payload.headers list. The raw RFC822 body and labelIds beyond INBOX are omitted.",
      "The XSOAR pack calls the Google client library, which uses these paths under https://gmail.googleapis.com. Set the catch URL as that host. A bearer token is required.",
    ],
    operations: [
      op({
        id: "list-messages",
        method: "GET",
        pathTemplate: "/gmail/v1/users/{userId}/messages",
        summary: "List message ids",
        status: 200,
        list: true,
        envelope: { type: "token-page", arrayKey: "messages", tokenKey: "nextPageToken" },
        pagination: { style: "cursor", limitParam: "maxResults", cursorParam: "pageToken", defaultLimit: 100, maxLimit: 500 },
        record: object("message", [
          field("id", "id"),
          field("threadId", "id"),
        ]),
      }),
      op({
        id: "get-message",
        method: "GET",
        pathTemplate: "/gmail/v1/users/{userId}/messages/{id}",
        summary: "Get a message",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("message", [
          field("id", "id"),
          field("threadId", "id"),
          field("snippet", "string", { example: "Password reset requested" }),
          object("payload", [
            {
              name: "headers",
              kind: "array",
              minItems: 2,
              maxItems: 2,
              item: object("header", [
                field("name", "enum", { enumValues: ["From", "Subject"] }),
                field("value", "string", { example: "Reset your password" }),
              ]),
            },
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "microsoftexchangeonpremise-ewsv2",
    name: "EWS v2",
    pack: "MicrosoftExchangeOnPremise",
    vendor: "Microsoft",
    summary: "POST /EWS/Exchange.asmx returns a shortened FindItem SOAP response.",
    docUrl: "https://learn.microsoft.com/en-us/exchange/client-developer/web-service-reference/finditem-operation",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/MicrosoftExchangeOnPremise/Integrations/EWSv2",
    auth: { mode: "basic", basic: { username: "lab-admin", password: "dummy-not-a-real-password" } },
    differences: [
      "The XSOAR pack uses exchangelib, which posts SOAP to /EWS/Exchange.asmx. This mock answers that path.",
      "The SOAP body is a shortened FindItem result with subject, from, and item id. The messages namespace, ExtendedFieldURI, and attachments are omitted.",
      "Basic auth is checked. NTLM, which the pack can also use, is not the default for this preset.",
    ],
    operations: [
      op({
        id: "find-item",
        method: "POST",
        pathTemplate: "/EWS/Exchange.asmx",
        summary: "Find mailbox items",
        status: 200,
        list: false,
        contentType: "text/xml; charset=utf-8",
        envelope: { type: "soap", version: "1.1" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("FindItemResponse", [
          object("Message", [
            field("ItemId", "id"),
            field("Subject", "string", { example: "Invoice attached" }),
            field("From", "email"),
            field("DateTimeReceived", "timestamp", { format: "iso" }),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "cortexdatalake-cortexdatalake",
    name: "Strata Logging Service XSOAR Connector",
    pack: "CortexDataLake",
    vendor: "Palo Alto Networks",
    summary: "POST /query/v2/jobs returns a job id. The results route returns page.result.data.",
    docUrl: "https://docs.paloaltonetworks.com/strata-logging-service/activation-and-onboarding/strata-logging-service-query-reference",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CortexDataLake/Integrations/CortexDataLake",
    differences: [
      "The pack calls pan-cortex-data-lake create_query, which posts to /query/v2/jobs and then reads page.result.data from the job results. Those two routes are mocked.",
      "Job state polling is skipped: the results route returns rows immediately. valuesDictionary rows are shortened traffic fields.",
      "The regional hostname and the bearer token are not checked.",
    ],
    operations: [
      op({
        id: "create-query",
        method: "POST",
        pathTemplate: "/query/v2/jobs",
        summary: "Create a logging query job",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("job", [
          field("jobId", "id"),
          field("state", "const", { constValue: "DONE" }),
        ]),
      }),
      op({
        id: "query-results",
        method: "GET",
        pathTemplate: "/query/v2/jobs/{job_id}/results",
        summary: "Read query job results",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "page", limitParam: "page_size", pageParam: "page_number", defaultLimit: 50, maxLimit: 100 },
        record: object("body", [
          object("page", [
            object("result", [
              {
                name: "data",
                kind: "array",
                pageItems: true,
                item: object("row", [
                  field("source_ip", "ip"),
                  field("dest_ip", "ip"),
                  field("action", "enum", { enumValues: ["allow", "deny", "drop"] }),
                  field("time_generated", "timestamp", { format: "unix-ms" }),
                ]),
              },
            ]),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "aws-guardduty-awsguardduty",
    name: "AWS - GuardDuty",
    pack: "AWS-GuardDuty",
    vendor: "Amazon Web Services",
    summary: "ListFindings and GetFindings on POST /, selected by the X-Amz-Target header.",
    docUrl: "https://docs.aws.amazon.com/guardduty/latest/APIReference/API_ListFindings.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/AWS-GuardDuty/Integrations/AWSGuardDuty",
    differences: [
      "The XSOAR pack uses boto3. GuardDuty's JSON protocol is POST / with X-Amz-Target GuardDuty_20171201.ListFindings or GetFindings.",
      "ListFindings returns FindingIds. GetFindings returns Findings with Id, Type, Severity, and Title. Service.Action and resource details are omitted.",
      "SigV4 is not checked. A call without X-Amz-Target does not match either operation.",
    ],
    operations: [
      op({
        id: "list-findings",
        method: "POST",
        pathTemplate: "/",
        summary: "List finding ids",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "FindingIds" },
        headerMatch: { "x-amz-target": "GuardDuty_20171201.ListFindings" },
        pagination: { style: "cursor", limitParam: "MaxResults", cursorParam: "NextToken", defaultLimit: 50, maxLimit: 50 },
        record: field("findingId", "id"),
      }),
      op({
        id: "get-findings",
        method: "POST",
        pathTemplate: "/",
        summary: "Get findings",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "Findings" },
        headerMatch: { "x-amz-target": "GuardDuty_20171201.GetFindings" },
        pagination: { style: "none", defaultLimit: 50, maxLimit: 50 },
        record: object("finding", [
          field("Id", "id"),
          field("Type", "string", { example: "Recon:EC2/PortProbeUnprotectedPort" }),
          field("Severity", "number"),
          field("Title", "string", { example: "Port probe on an unprotected port" }),
          field("UpdatedAt", "timestamp", { format: "iso" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "tenable-io-tenable-io",
    name: "Tenable Vulnerability Management (formerly Tenable.io)",
    pack: "Tenable_io",
    vendor: "Tenable",
    summary: "GET /workbenches/assets and POST /vulns/export, which the XSOAR client calls.",
    docUrl: "https://developer.tenable.com/reference/workbenches-assets",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Tenable_io/Integrations/Tenable_io",
    auth: { mode: "api-key", apiKey: { in: "header", name: "X-ApiKeys", value: "accessKey=dummy-access; secretKey=dummy-secret" } },
    differences: [
      "workbenches/assets returns { assets: [...] }. The documented pagination uses limit and offset.",
      "POST /vulns/export returns { export_uuid }. Chunk download of the finished export is not modeled.",
      "X-ApiKeys must be the dummy accessKey and secretKey pair.",
    ],
    operations: [
      op({
        id: "list-assets",
        method: "GET",
        pathTemplate: "/workbenches/assets",
        summary: "List workbench assets",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "assets" },
        pagination: { style: "offset", limitParam: "limit", offsetParam: "offset", defaultLimit: 50, maxLimit: 500 },
        record: object("asset", [
          field("id", "uuid"),
          field("ipv4", "ip"),
          field("hostname", "string", { example: "lab-workstation" }),
          field("last_seen", "timestamp", { format: "iso" }),
        ]),
      }),
      op({
        id: "export-vulns",
        method: "POST",
        pathTemplate: "/vulns/export",
        summary: "Start a vulnerability export",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("export", [field("export_uuid", "uuid")]),
      }),
    ],
  }),
  preset({
    id: "rapid7-insightidr-rapid7-insightidr",
    name: "Rapid7 InsightIDR",
    pack: "Rapid7_InsightIDR",
    vendor: "Rapid7",
    summary: "GET /idr/v2/investigations returns the data array the v2 client reads.",
    docUrl: "https://help.rapid7.com/insightidr/en-us/api/v2/index.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Rapid7_InsightIDR/Integrations/Rapid7_InsightIDR",
    auth: { mode: "api-key", apiKey: { in: "header", name: "X-Api-Key", value: "dummy-insightidr-key" } },
    differences: [
      "The v2 list is { data: [...], metadata }. This mock returns data and does not include the metadata object.",
      "The v1 investigations route is not mocked. The pack still has a v1 code path.",
      "X-Api-Key must be the dummy key. The regional host is whatever you put in the server URL.",
    ],
    operations: [
      op({
        id: "list-investigations",
        method: "GET",
        pathTemplate: "/idr/v2/investigations",
        summary: "List investigations",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "data" },
        pagination: { style: "offset", limitParam: "size", offsetParam: "index", defaultLimit: 20, maxLimit: 100 },
        record: object("investigation", [
          field("rrn", "id"),
          field("title", "string", { example: "Suspicious login" }),
          field("status", "enum", { enumValues: ["OPEN", "INVESTIGATING", "CLOSED"] }),
          field("priority", "enum", { enumValues: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }),
          field("created_time", "timestamp", { format: "iso" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "sentinelone-sentinelone-v2",
    name: "SentinelOne v2",
    pack: "SentinelOne",
    vendor: "SentinelOne",
    summary: "GET /web/api/v2.1/threats returns the data array.",
    docUrl: "https://usea1-partners.sentinelone.net/api-doc/overview",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/SentinelOne/Integrations/SentinelOne",
    auth: { mode: "api-key", apiKey: { in: "header", name: "Authorization", value: "ApiToken dummy-s1-token" } },
    differences: [
      "get_threats_request GETs threats and reads response.data. It sends limit, not cursor. The live body also has pagination.nextCursor, which this mock does not emit.",
      "Activities and cloud detection alerts are separate routes in the event collector and are not modeled here.",
      "Authorization must be ApiToken plus the dummy token. The management console host is the catch URL.",
    ],
    operations: [
      op({
        id: "list-threats",
        method: "GET",
        pathTemplate: "/web/api/v2.1/threats",
        summary: "List threats",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "data" },
        pagination: { style: "offset", limitParam: "limit", defaultLimit: 10, maxLimit: 100 },
        record: object("threat", [
          field("id", "id"),
          object("threatInfo", [
            field("threatName", "string", { example: "EICAR test file" }),
            field("createdAt", "timestamp", { format: "iso" }),
            field("classification", "enum", { enumValues: ["Malware", "PUA", "Suspicious"] }),
          ]),
          object("agentRealtimeInfo", [
            field("agentComputerName", "string", { example: "lab-workstation" }),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "carbonblackdefense-carbonblackendpointstandardv3",
    name: "Carbon Black Endpoint Standard v3",
    pack: "CarbonBlackDefense",
    vendor: "Broadcom",
    summary: "POST /api/alerts/v7/orgs/{org_key}/alerts/_search returns results.",
    docUrl: "https://developer.carbonblack.com/reference/carbon-black-cloud/platform/latest/alerts-api/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CarbonBlackDefense/Integrations/CarbonBlackEndpointStandardV3",
    auth: { mode: "api-key", apiKey: { in: "header", name: "X-Auth-Token", value: "dummy-cb-token/dummy-cb-id" } },
    differences: [
      "The v7 search response is { results, num_found, num_available }. This mock returns results and num_found. num_available is omitted.",
      "The XSOAR client posts to api/alerts/v7/orgs/{org_key}/alerts/_search. Devices search is not modeled.",
      "X-Auth-Token must be the dummy token. The org key is a path parameter.",
    ],
    operations: [
      op({
        id: "search-alerts",
        method: "POST",
        pathTemplate: "/api/alerts/v7/orgs/{org_key}/alerts/_search",
        summary: "Search alerts",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "offset", limitParam: "rows", offsetParam: "start", defaultLimit: 20, maxLimit: 100 },
        record: object("search", [
          field("num_found", "integer"),
          {
            name: "results",
            kind: "array",
            pageItems: true,
            item: object("alert", [
              field("id", "id"),
              field("type", "string", { example: "CB_ANALYTICS" }),
              field("severity", "integer"),
              field("device_name", "string", { example: "lab-workstation" }),
              field("backend_timestamp", "timestamp", { format: "iso" }),
            ]),
          },
        ]),
      }),
    ],
  }),
  preset({
    id: "prismacloud-prismacloudv2",
    name: "Prisma Cloud v2",
    pack: "PrismaCloud",
    vendor: "Palo Alto Networks",
    summary: "POST /login returns a token. POST /v2/alert returns the alert page.",
    docUrl: "https://pan.dev/prisma-cloud/api/cspm/alerts/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PrismaCloud/Integrations/PrismaCloudV2",
    differences: [
      "POST /login returns { token }. The real token lasts about 10 minutes. This one is a fixed dummy and is not checked on later calls.",
      "POST /v2/alert returns { items, nextPageToken }. Alert resource objects are shortened to id, status, policy name, and time.",
      "Access keys and code-issue routes are not modeled.",
    ],
    operations: [
      op({
        id: "login",
        method: "POST",
        pathTemplate: "/login",
        summary: "Log in",
        status: 200,
        list: false,
        envelope: { type: "object" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("session", [
          field("token", "const", { constValue: "dummy-prisma-token" }),
          field("message", "const", { constValue: "login successful" }),
        ]),
      }),
      op({
        id: "search-alerts",
        method: "POST",
        pathTemplate: "/v2/alert",
        summary: "Search alerts",
        status: 200,
        list: true,
        envelope: { type: "token-page", arrayKey: "items", tokenKey: "nextPageToken" },
        pagination: { style: "cursor", limitParam: "limit", cursorParam: "pageToken", defaultLimit: 50, maxLimit: 100 },
        record: object("alert", [
          field("id", "id"),
          field("status", "enum", { enumValues: ["open", "dismissed", "resolved"] }),
          field("reason", "string", { example: "RESOURCE_ANOMALY" }),
          object("policy", [field("name", "string", { example: "Public storage bucket" })]),
          field("alertTime", "timestamp", { format: "unix-ms" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "microsoftgraphuser-microsoftgraphuser",
    name: "Entra ID Users",
    pack: "MicrosoftGraphUser",
    vendor: "Microsoft",
    summary: "GET /v1.0/users returns the Graph value array.",
    docUrl: "https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphUser/Integrations/MicrosoftGraphUser",
    auth: { mode: "bearer", bearer: { token: "dummy-graph-token" } },
    differences: [
      "The list is { value, @odata.nextLink }. $top and $skip page it. The real API also accepts $filter as OData, which this mock ignores.",
      "User objects keep id, displayName, userPrincipalName, and accountEnabled. The XSOAR client selects a longer property list.",
      "Set the server URL to the catch URL. The client appends v1.0/users when its base URL is the Graph host. Bearer tokens are checked.",
    ],
    operations: [
      op({
        id: "list-users",
        method: "GET",
        pathTemplate: "/v1.0/users",
        summary: "List users",
        status: 200,
        list: true,
        envelope: { type: "odata", context: "https://graph.microsoft.com/v1.0/$metadata#users" },
        pagination: { style: "offset", limitParam: "$top", offsetParam: "$skip", defaultLimit: 100, maxLimit: 500 },
        record: object("user", [
          field("id", "uuid"),
          field("displayName", "string", { example: "Ada Lovelace" }),
          field("userPrincipalName", "email"),
          field("accountEnabled", "boolean"),
        ]),
      }),
    ],
  }),
  preset({
    id: "azureactivedirectory-azureadidentityprotection",
    name: "Azure Active Directory Identity Protection  (Deprecated)",
    pack: "AzureActiveDirectory",
    vendor: "Microsoft",
    summary: "GET /v1.0/identityProtection/riskyUsers returns the Entra risky-user list.",
    docUrl: "https://learn.microsoft.com/en-us/graph/api/riskyuser-list?view=graph-rest-1.0",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/AzureActiveDirectory/Integrations/AzureADIdentityProtection",
    auth: { mode: "bearer", bearer: { token: "dummy-graph-token" } },
    differences: [
      "The list is { value, @odata.nextLink }. riskLevel and riskState are the documented enums.",
      "confirmCompromised and dismiss are not modeled.",
      "The pack name still says Azure AD. The public API is Entra ID Protection. Bearer tokens are checked.",
    ],
    operations: [
      op({
        id: "list-risky-users",
        method: "GET",
        pathTemplate: "/v1.0/identityProtection/riskyUsers",
        summary: "List risky users",
        status: 200,
        list: true,
        envelope: { type: "odata", context: "https://graph.microsoft.com/v1.0/$metadata#riskyUsers" },
        pagination: { style: "offset", limitParam: "$top", offsetParam: "$skip", defaultLimit: 50, maxLimit: 500 },
        record: object("riskyUser", [
          field("id", "uuid"),
          field("userDisplayName", "string", { example: "Ada Lovelace" }),
          field("userPrincipalName", "email"),
          field("riskLevel", "enum", { enumValues: ["low", "medium", "high", "hidden", "none"] }),
          field("riskState", "enum", { enumValues: ["atRisk", "confirmedCompromised", "remediated", "dismissed"] }),
          field("riskLastUpdatedDateTime", "timestamp", { format: "iso" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "aws-securityhub-aws-securityhub",
    name: "AWS - Security Hub",
    pack: "AWS-SecurityHub",
    vendor: "Amazon Web Services",
    summary: "GetFindings on POST /, selected by X-Amz-Target.",
    docUrl: "https://docs.aws.amazon.com/securityhub/1.0/APIReference/API_GetFindings.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/AWS-SecurityHub/Integrations/AWS_SecurityHub",
    differences: [
      "The XSOAR pack uses boto3. GetFindings is POST / with X-Amz-Target SecurityHub_2018-10-26.GetFindings and a Findings array.",
      "Finding objects keep Id, ProductArn, Title, Severity.Label, and UpdatedAt. Resources and compliance are omitted.",
      "SigV4 is not checked. BatchUpdateFindings is not modeled.",
    ],
    operations: [
      op({
        id: "get-findings",
        method: "POST",
        pathTemplate: "/",
        summary: "Get findings",
        status: 200,
        list: true,
        envelope: { type: "wrapped", arrayKey: "Findings" },
        headerMatch: { "x-amz-target": "SecurityHub_2018-10-26.GetFindings" },
        pagination: { style: "cursor", limitParam: "MaxResults", cursorParam: "NextToken", defaultLimit: 20, maxLimit: 100 },
        record: object("finding", [
          field("Id", "id"),
          field("ProductArn", "string", { example: "arn:aws:securityhub:us-east-1::product/aws/guardduty" }),
          field("Title", "string", { example: "GuardDuty finding" }),
          object("Severity", [field("Label", "enum", { enumValues: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] })]),
          field("UpdatedAt", "timestamp", { format: "iso" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "qualys-qualysv2",
    name: "Qualys VMDR",
    pack: "qualys",
    vendor: "Qualys",
    summary: "GET /api/2.0/fo/asset/host/ returns a shortened host list.",
    docUrl: "https://docs.qualys.com/en/vm/api/assets/index.htm",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/qualys/Integrations/Qualysv2",
    auth: { mode: "basic", basic: { username: "lab-admin", password: "dummy-not-a-real-password" } },
    differences: [
      "The host list API returns HOST_LIST_OUTPUT XML. This mock returns a shortened host with id, IP, and DNS. Detection details and the DTD are omitted.",
      "The pack also calls /api/5.0/fo/ and the knowledge base. Those routes are not modeled.",
      "Basic auth is checked. The Qualys session cookie flow is not.",
    ],
    operations: [
      op({
        id: "list-hosts",
        method: "GET",
        pathTemplate: "/api/2.0/fo/asset/host/",
        summary: "List hosts",
        status: 200,
        list: false,
        contentType: "text/xml; charset=utf-8",
        envelope: { type: "xml" },
        pagination: { style: "none", defaultLimit: 1, maxLimit: 1 },
        record: object("HOST_LIST_OUTPUT", [
          object("HOST", [
            field("ID", "integer"),
            field("IP", "ip"),
            field("DNS", "string", { example: "lab-workstation.example.com" }),
            field("LAST_VULN_SCAN_DATETIME", "timestamp", { format: "iso" }),
          ]),
        ]),
      }),
    ],
  }),
];
