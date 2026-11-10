import { defaultChaos, defaultPagination, type FieldSpec, type MockAuth, type MockOperation, type MockSpec } from "./mock-spec";

const checkedAt = "2026-11-10";

function field(name: string, kind: FieldSpec["kind"], extra: Partial<FieldSpec> = {}): FieldSpec {
  return { name, kind, ...extra };
}

function object(name: string, children: FieldSpec[]): FieldSpec {
  return { name, kind: "object", children };
}

function op(
  partial: Omit<MockOperation, "headers" | "pagination" | "contentType"> & {
    pagination?: Partial<MockOperation["pagination"]>;
    contentType?: string;
    headers?: Record<string, string>;
  },
): MockOperation {
  const { pagination, contentType, headers, ...rest } = partial;
  return {
    ...rest,
    headers: headers ?? {},
    contentType: contentType ?? "application/json; charset=utf-8",
    pagination: { ...defaultPagination(), style: "none", ...pagination },
  };
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
  vendor?: string;
  summary: string;
  docUrl: string;
  sourceUrl: string;
  differences: string[];
  operations: MockOperation[];
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
    vendor: input.vendor ?? "Palo Alto Networks",
    fidelity: "verified",
    curated: true,
    summary: input.summary,
    notes: input.differences,
    attribution:
      "Checked against a public vendor reference or, when that page was not reloaded, the demisto/content client. See /presets/ATTRIBUTION.md.",
    sourceUrl: input.sourceUrl,
    spec: {
      version: 1,
      source: {
        kind: "preset",
        id: input.id,
        name: input.name,
        fidelity: "verified",
        attribution: "Public API reference or demisto/content client (MIT).",
        sourceUrl: input.docUrl,
        notes: input.differences,
        verification: { status: "verified", docUrl: input.docUrl, checkedAt, differences: input.differences },
      },
      operations: input.operations,
      chaos: defaultChaos(input.id),
      totalRecords: 40,
      auth: input.auth ?? { mode: "none" },
    },
  };
}

function jsonOp(id: string, method: MockOperation["method"], path: string, summary: string, record: FieldSpec): MockOperation {
  return op({
    id,
    method,
    pathTemplate: path,
    summary,
    status: 200,
    list: false,
    envelope: { type: "object" },
    record,
  });
}

function reply(children: FieldSpec[]): FieldSpec {
  return object("body", [object("reply", children)]);
}

export const panSiemVerifiedPresets = [
  preset({
    id: "prismaaccess-prismaaccess",
    name: "Prisma Access",
    pack: "PrismaAccess",
    summary: "PAN-OS XML API on the Prisma Access management host.",
    docUrl: "https://docs.paloaltonetworks.com/prisma/prisma-access/prisma-access-panorama-admin/prisma-access-overview/prisma-access-overview",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PrismaAccess/Integrations/PrismaAccess",
    differences: [
      "The client calls GET https://server:port/api/ with type=op and type=config, then parses the XML response. SSH CLI commands are not HTTP and are not modeled.",
      "type=op returns system info. type=config returns a device-group entry. Commit and logout-mobile-user are on the PAN-OS preset, not here.",
      "The dummy API key is not a Prisma Access credential. The overview page was not reloaded; the calls are the public client.",
    ],
    auth: {
      mode: "panos-key",
      panos: { username: "lab-admin", password: "dummy-not-a-real-password", apiKey: "dummy-panos-api-key" },
    },
    operations: [
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
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [
            object("system", [
              field("hostname", "const", { constValue: "prisma-access" }),
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
        summary: "Read device groups",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
        queryMatch: { type: "config" },
        record: object("response", [
          field("status", "const", { constValue: "success", xml: { attribute: true } }),
          object("result", [
            object("entry", [field("name", "const", { constValue: "lab-device-group", xml: { attribute: true } })]),
          ]),
        ]),
      }),
    ],
  }),
  preset({
    id: "prismaaccess-prismasase",
    name: "Palo Alto Networks - Strata Cloud Manager",
    pack: "PrismaAccess",
    summary: "SSE config security rules and addresses.",
    docUrl: "https://pan.dev/sase/docs/config/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PrismaAccess/Integrations/PrismaSASE",
    differences: [
      "PrismaSASE.py lists and writes objects under /sse/config/v1/. This mock is GET security-rules and GET addresses. The data array is one shortened rule or address.",
      "Folder, position, and tsg_id query parameters are accepted and not applied. Create, edit, and delete are not modeled.",
      "The pan.dev config page was not reloaded. A bearer token is required. Directory-sync cache-users is not modeled.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "security-rules",
        "GET",
        "/sse/config/v1/security-rules",
        "List security rules",
        object("body", [
          {
            name: "data",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("rule", [
              field("id", "id"),
              field("name", "string", { example: "allow-lab" }),
              field("action", "enum", { enumValues: ["allow", "deny"] }),
              field("folder", "const", { constValue: "Shared" }),
            ]),
          },
        ]),
      ),
      jsonOp(
        "addresses",
        "GET",
        "/sse/config/v1/addresses",
        "List address objects",
        object("body", [
          {
            name: "data",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("address", [
              field("id", "id"),
              field("name", "string", { example: "lab-host" }),
              field("ip_netmask", "const", { constValue: "10.0.0.8/32" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "cortexxpanse-cortexxpanse",
    name: "Cortex Xpanse",
    pack: "CortexXpanse",
    summary: "Incidents and external services under public_api/v1.",
    docUrl: "https://docs-cortex.paloaltonetworks.com/r/Cortex-Xpanse-REST-API/Get-Incidents",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CortexXpanse/Integrations/CortexXpanse",
    differences: [
      "The client POSTs /public_api/v1/incidents/get_incidents/ and /public_api/v1/assets/get_external_services/. Both return { reply }.",
      "Alert multi-events, IP ranges, and attack-surface rules are not modeled. Search filters in the body are ignored.",
      "The Xpanse REST page was not reloaded. x-xdr-auth-id is the dummy key header.",
    ],
    auth: headerKey("x-xdr-auth-id"),
    operations: [
      jsonOp(
        "incidents",
        "POST",
        "/public_api/v1/incidents/get_incidents",
        "Get incidents",
        reply([
          field("total_count", "integer"),
          {
            name: "incidents",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("incident", [
              field("incident_id", "id"),
              field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
              field("status", "const", { constValue: "new" }),
              field("description", "string", { example: "Exposed service" }),
            ]),
          },
        ]),
      ),
      jsonOp(
        "services",
        "POST",
        "/public_api/v1/assets/get_external_services",
        "Get external services",
        reply([
          {
            name: "external_services",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("service", [
              field("service_id", "id"),
              field("ip", "ip"),
              field("port", "integer"),
              field("protocol", "const", { constValue: "tcp" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "autofocus-autofocusv2",
    name: "Palo Alto Networks AutoFocus v2 (Deprecated)",
    pack: "AutoFocus",
    summary: "Sample search and threat indicator context.",
    docUrl: "https://docs.paloaltonetworks.com/autofocus/autofocus-api/about-the-autofocus-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/AutoFocus/Integrations/AutofocusV2",
    differences: [
      "The client posts /api/v1.0/samples/search and reads hits, then GETs /api/v1.0/tic. The pack is marked deprecated in XSOAR.",
      "The search cookie poll at /samples/results/{cookie} is not modeled. This mock returns hits on the search call.",
      "The AutoFocus API page was not reloaded. The apiKey header is the dummy key.",
    ],
    auth: headerKey("apiKey", "dummy-autofocus-key"),
    operations: [
      jsonOp(
        "samples-search",
        "POST",
        "/api/v1.0/samples/search",
        "Search samples",
        object("body", [
          field("autofocus_cookie", "id"),
          field("total", "integer"),
          {
            name: "hits",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("hit", [
              field("_id", "id"),
              field("sha256", "id"),
              field("verdict", "enum", { enumValues: ["malware", "benign", "grayware"] }),
            ]),
          },
        ]),
      ),
      jsonOp(
        "tic",
        "GET",
        "/api/v1.0/tic",
        "Threat indicator context",
        object("body", [
          field("indicator", "string", { example: "8.8.8.8" }),
          field("indicatorType", "const", { constValue: "ipv4" }),
          {
            name: "tags",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("tag", [
              field("tag_name", "string", { example: "lab-malware" }),
              field("public_tag_name", "string", { example: "Malware" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "palo-alto-networks-wildfire-wildfirereports",
    name: "Palo Alto Networks WildFire Reports",
    pack: "Palo_Alto_Networks_WildFire",
    summary: "POST /publicapi/get/report returns XML file_info.",
    docUrl: "https://docs.paloaltonetworks.com/wildfire/u-v/wildfire-api/get-wildfire-information-through-the-wildfire-api/get-a-wildfire-report-wildfire-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Palo_Alto_Networks_WildFire/Integrations/WildFireReports",
    differences: [
      "WildFireReports.py posts /publicapi/get/report. The client appends /publicapi when the base URL does not already end with it.",
      "This mock returns XML file_info. PDF and MAEC reports are not modeled. Verdict and URL submit live on the WildFire v2 preset.",
      "The report page was not reloaded. The apikey form field must be the dummy key.",
    ],
    auth: { mode: "api-key", apiKey: { in: "form", name: "apikey", value: "dummy-wildfire-key" } },
    operations: [
      op({
        id: "report",
        method: "POST",
        pathTemplate: "/publicapi/get/report",
        summary: "Get a WildFire report",
        status: 200,
        list: false,
        envelope: { type: "xml" },
        contentType: "application/xml; charset=utf-8",
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
    ],
  }),
  preset({
    id: "cortexxdr-xdr-iocs",
    name: "Cortex XDR - IOC",
    pack: "CortexXDR",
    summary: "Push and enable indicators on the XDR indicators API.",
    docUrl: "https://docs-cortex.paloaltonetworks.com/r/Cortex-XDR-REST-API/Insert-or-Update-Indicators",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CortexXDR/Integrations/XDR_iocs",
    differences: [
      "The client base is /public_api/v1/indicators/. tim_insert_jsons/ returns reply.success. enable_iocs returns reply true.",
      "Sync from the local indicator store and file-hash batches are not modeled. Validation errors are an empty list.",
      "The indicators page was not reloaded. x-xdr-auth-id is the dummy key.",
    ],
    auth: headerKey("x-xdr-auth-id"),
    operations: [
      jsonOp(
        "insert",
        "POST",
        "/public_api/v1/indicators/tim_insert_jsons",
        "Insert indicators",
        reply([
          field("success", "const", { constValue: true }),
          { name: "validation_errors", kind: "array", minItems: 0, maxItems: 0, item: field("error", "string") },
        ]),
      ),
      jsonOp("enable", "POST", "/public_api/v1/indicators/enable_iocs", "Enable indicators", reply([field("success", "const", { constValue: true })])),
    ],
  }),
  preset({
    id: "cortexxdr-xqlqueryingengine",
    name: "Cortex XDR - XQL Query Engine",
    pack: "CortexXDR",
    summary: "Start an XQL query and read its results.",
    docUrl: "https://docs-cortex.paloaltonetworks.com/r/Cortex-XDR-REST-API/Start-an-XQL-Query",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CortexXDR/Integrations/XQLQueryingEngine",
    differences: [
      "The pack calls start_xql_query. This mock is POST /public_api/v1/xql/start_xql_query and POST /public_api/v1/xql/get_query_results.",
      "Start returns reply.execution_id. Results return status SUCCESS and one shortened row. Quota and cost are omitted.",
      "The XQL page was not reloaded. The query text is not executed. x-xdr-auth-id is the dummy key.",
    ],
    auth: headerKey("x-xdr-auth-id"),
    operations: [
      jsonOp("start", "POST", "/public_api/v1/xql/start_xql_query", "Start an XQL query", reply([field("execution_id", "id")])),
      jsonOp(
        "results",
        "POST",
        "/public_api/v1/xql/get_query_results",
        "Get XQL results",
        reply([
          field("status", "const", { constValue: "SUCCESS" }),
          field("number_of_results", "integer"),
          object("results", [
            {
              name: "data",
              kind: "array",
              minItems: 1,
              maxItems: 1,
              item: object("row", [
                field("action_process_image_name", "string", { example: "cmd.exe" }),
                field("agent_hostname", "string", { example: "lab-host" }),
                field("_time", "timestamp", { format: "iso" }),
              ]),
            },
          ]),
        ]),
      ),
    ],
  }),
  preset({
    id: "paloaltonetworks-threat-vault-threatvaultv2",
    name: "Palo Alto Networks Threat Vault v2",
    pack: "PaloAltoNetworks_Threat_Vault",
    summary: "GET service/v1/threats returns signature data.",
    docUrl: "https://pan.dev/threat-vault/api/threat-vault-apis/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_Threat_Vault/Integrations/ThreatVaultv2",
    differences: [
      "The client sets the base to url + service/v1/ and GETs threats. This mock returns { data } with id, name, severity, and category.",
      "Release notes, batch search, and PCAP download are not modeled. Query arguments are not applied.",
      "The Threat Vault API page was not reloaded. The API key header is the dummy key.",
    ],
    auth: headerKey("x-api-key", "dummy-threatvault-key"),
    operations: [
      jsonOp(
        "threats",
        "GET",
        "/service/v1/threats",
        "Look up a threat signature",
        object("body", [
          {
            name: "data",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("threat", [
              field("id", "id"),
              field("name", "string", { example: "lab-signature" }),
              field("severity", "enum", { enumValues: ["low", "medium", "high", "critical"] }),
              field("category", "const", { constValue: "vulnerability" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "palo-alto-networks-enterprise-dlp-palo-alto-networks-enterprise-dlp",
    name: "Palo Alto Networks Enterprise DLP",
    pack: "Palo_Alto_Networks_Enterprise_DLP",
    summary: "POST /v4/api/incidents returns a page of DLP incidents.",
    docUrl: "https://docs.paloaltonetworks.com/enterprise-dlp/enterprise-dlp-admin/enterprise-dlp-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Palo_Alto_Networks_Enterprise_DLP/Integrations/Palo_Alto_Networks_Enterprise_DLP",
    differences: [
      "The client posts the absolute v4 incidents URL built from the DLP host. This mock is POST /v4/api/incidents with an incidents array.",
      "The next-page token query is not modeled. OAuth at auth.apps.paloaltonetworks.com is not modeled.",
      "The Enterprise DLP API page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "incidents",
        "POST",
        "/v4/api/incidents",
        "List DLP incidents",
        object("body", [
          {
            name: "incidents",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("incident", [
              field("incidentId", "id"),
              field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
              field("status", "const", { constValue: "open" }),
              field("createdAt", "timestamp", { format: "iso" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "paloaltonetworks-devicesecurity-paloaltonetworks-devicesecurity",
    name: "Palo Alto Networks Device Security",
    pack: "PaloAltoNetworks_DeviceSecurity",
    summary: "Device lookup and the alert list.",
    docUrl: "https://docs.paloaltonetworks.com/iot/iot-security-api/iot-security-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_DeviceSecurity/Integrations/PaloAltoNetworks_DeviceSecurity",
    differences: [
      "The client GETs /device and /alert/list. This mock returns one device and one alert. Vulnerability update is not modeled.",
      "OAuth at /oauth2/access_token is not modeled. A bearer token is required on the data calls.",
      "The IoT Security API page was not reloaded. deviceid and ip query values are not echoed.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "device",
        "GET",
        "/device",
        "Get a device",
        object("device", [
          field("deviceid", "id"),
          field("ip", "ip"),
          field("profile", "string", { example: "Windows PC" }),
          field("category", "const", { constValue: "IT Devices" }),
        ]),
      ),
      jsonOp(
        "alerts",
        "GET",
        "/alert/list",
        "List alerts",
        object("body", [
          {
            name: "alerts",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("alert", [
              field("alertid", "id"),
              field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
              field("name", "string", { example: "Unusually high traffic" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "dspm-dspm",
    name: "Prisma Cloud DSPM",
    pack: "DSPM",
    summary: "GET /v1/risk-findings and /v1/assets.",
    docUrl: "https://pan.dev/prisma-cloud/api/dspm/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/DSPM/Integrations/DSPM",
    differences: [
      "DSPM.py GETs /v1/risk-findings and /v1/assets. This mock returns a data array for each. Asset files and data types are not modeled.",
      "Paging query parameters are ignored. A bearer token is required.",
      "The DSPM API page was not reloaded. The paths are the public client constants.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "findings",
        "GET",
        "/v1/risk-findings",
        "List risk findings",
        object("body", [
          {
            name: "data",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("finding", [
              field("id", "id"),
              field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
              field("assetId", "id"),
            ]),
          },
        ]),
      ),
      jsonOp(
        "assets",
        "GET",
        "/v1/assets",
        "List assets",
        object("body", [
          {
            name: "data",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("asset", [
              field("id", "id"),
              field("name", "string", { example: "lab-bucket" }),
              field("type", "const", { constValue: "s3" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "prismasaassecurity-saassecurity",
    name: "SaaS Security",
    pack: "PrismaSaasSecurity",
    summary: "Incident delta and the app list.",
    docUrl: "https://docs.paloaltonetworks.com/saas-security/saas-security-admin/saas-security-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PrismaSaasSecurity/Integrations/SaasSecurity",
    differences: [
      "The client GETs /incident/api/incidents/delta and /incident/api/apps. This mock returns incidents and apps.",
      "State changes and remediation POSTs are not modeled. The next page token is a fixed example.",
      "The SaaS Security API page was not reloaded. OAuth at /oauth/token is not modeled. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "delta",
        "GET",
        "/incident/api/incidents/delta",
        "Fetch incident changes",
        object("body", [
          field("next_page_token", "id"),
          {
            name: "incidents",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("incident", [
              field("incident_id", "id"),
              field("severity", "enum", { enumValues: ["low", "medium", "high"] }),
              field("status", "const", { constValue: "open" }),
              field("application", "string", { example: "box" }),
            ]),
          },
        ]),
      ),
      jsonOp(
        "apps",
        "GET",
        "/incident/api/apps",
        "List connected apps",
        object("body", [
          {
            name: "apps",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("app", [field("name", "string", { example: "box" }), field("status", "const", { constValue: "connected" })]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "cortexattacksurfacemanagement-cortexattacksurfacemanagement",
    name: "Cortex Attack Surface Management",
    pack: "CortexAttackSurfaceManagement",
    summary: "External services on the ASM public API.",
    docUrl: "https://docs-cortex.paloaltonetworks.com/r/Cortex-Xpanse-REST-API/Get-External-Services",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CortexAttackSurfaceManagement/Integrations/CortexAttackSurfaceManagement",
    differences: [
      "The client base ends in /public_api/v1. Tests call /assets/get_external_services/. This mock returns reply.external_services.",
      "Remediation confirmation scanning is not modeled. Body filters are ignored.",
      "The Xpanse services page was not reloaded. x-xdr-auth-id is the dummy key.",
    ],
    auth: headerKey("x-xdr-auth-id"),
    operations: [
      jsonOp(
        "services",
        "POST",
        "/public_api/v1/assets/get_external_services",
        "Get external services",
        reply([
          {
            name: "external_services",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("service", [
              field("service_id", "id"),
              field("ip", "ip"),
              field("port", "integer"),
              field("protocol", "const", { constValue: "tcp" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "paloaltonetworks-iot-paloaltonetworks-iot",
    name: "Palo Alto Networks IoT",
    pack: "PaloAltoNetworks_IoT",
    summary: "GET /device/list and /alert/list.",
    docUrl: "https://docs.paloaltonetworks.com/iot/iot-security-api/iot-security-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_IoT/Integrations/PaloAltoNetworks_IoT",
    differences: [
      "The client GETs /device/list and /alert/list with customerid. This mock returns devices and alerts. Single-device lookup is not a separate route.",
      "customerid is not checked. A bearer token is required.",
      "The IoT Security API page was not reloaded. Alert and vulnerability updates are not modeled.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "devices",
        "GET",
        "/device/list",
        "List devices",
        object("body", [
          {
            name: "devices",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("device", [
              field("deviceid", "id"),
              field("ip", "ip"),
              field("profile", "string", { example: "Printer" }),
            ]),
          },
        ]),
      ),
      jsonOp(
        "alerts",
        "GET",
        "/alert/list",
        "List alerts",
        object("body", [
          {
            name: "alerts",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("alert", [field("alertid", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high"] })]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "paloaltonetworks-prisma-airs-prismaairsruntime",
    name: "Palo Alto Networks Prisma AIRS - AI Runtime Security",
    pack: "PaloAltoNetworks_Prisma_AIRs",
    summary: "Runtime scan plus the management profile list.",
    docUrl: "https://docs.paloaltonetworks.com/ai-runtime-security/activation-and-onboarding/ai-runtime-security-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_Prisma_AIRs/Integrations/PrismaAIRsRuntime",
    differences: [
      "Runtime scan posts ai_profile and contents. PrismaAirsApiModule is not in this content checkout. This mock answers POST /v1/scan/sync/request with scan_id, action, and category.",
      "GET /v1/mgmt/profiles/tsg/lab-tsg is the profiles list the client builds from MGMT_API_V1_PREFIX. API key create and DLP profiles are not modeled.",
      "The runtime API page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "scan",
        "POST",
        "/v1/scan/sync/request",
        "Scan a prompt",
        object("body", [
          field("scan_id", "id"),
          field("action", "enum", { enumValues: ["allow", "block"] }),
          field("category", "const", { constValue: "benign" }),
          field("prompt_detected", "const", { constValue: false }),
        ]),
      ),
      jsonOp(
        "profiles",
        "GET",
        "/v1/mgmt/profiles/tsg/lab-tsg",
        "List runtime profiles",
        object("body", [
          {
            name: "data",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("profile", [field("id", "id"), field("profile_name", "string", { example: "lab-profile" })]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "prismaaccess-prismaaccessegressipfeed",
    name: "Prisma Access Egress IP feed",
    pack: "PrismaAccess",
    summary: "POST /getPrismaAccessIP/v2 returns egress addresses.",
    docUrl: "https://docs.paloaltonetworks.com/prisma/prisma-access/prisma-access-panorama-admin/prisma-access-overview/retrieve-ip-addresses-for-prisma-access",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PrismaAccess/Integrations/PrismaAccessEgressIPFeed",
    differences: [
      "The feed client posts https://api.gpcloudservice.com/getPrismaAccessIP/v2. This mock returns status success and a result row with addresses.",
      "serviceType, addrType, and location in the body are not filtered. The address list is one example.",
      "The retrieve-IP page was not reloaded. The API key header is the dummy key.",
    ],
    auth: headerKey("header-api-key", "dummy-prisma-key"),
    operations: [
      jsonOp(
        "egress",
        "POST",
        "/getPrismaAccessIP/v2",
        "List Prisma Access egress IPs",
        object("body", [
          field("status", "const", { constValue: "success" }),
          {
            name: "result",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("zone", [
              field("zone", "string", { example: "americas" }),
              field("serviceType", "const", { constValue: "gp_gateway" }),
              field("addrType", "const", { constValue: "active" }),
              { name: "addresses", kind: "array", minItems: 1, maxItems: 1, item: field("address", "ip") },
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "paloaltonetworksaiops-paloaltonetworksaiops",
    name: "Palo Alto Networks AIOps",
    pack: "PaloAltoNetworksAIOps",
    summary: "Best-practice assessment request and job status.",
    docUrl: "https://pan.dev/aiops/api/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworksAIOps/Integrations/PaloAltoNetworksAIOps",
    differences: [
      "The client posts https://api.stratacloud.paloaltonetworks.com/aiops/bpa/v1/requests and GETs /aiops/bpa/v1/jobs/{id}. This mock returns a report id and status COMPLETED.",
      "The report download route is not modeled. The uploaded config is not parsed.",
      "The AIOps API page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("request", "POST", "/aiops/bpa/v1/requests", "Start a BPA job", object("body", [field("report_id", "id"), field("status", "const", { constValue: "IN_PROGRESS" })])),
      jsonOp(
        "job",
        "GET",
        "/aiops/bpa/v1/jobs/{report_id}",
        "Read BPA job status",
        object("body", [field("report_id", "id"), field("status", "const", { constValue: "COMPLETED" })]),
      ),
    ],
  }),
  preset({
    id: "cortexxpanse-feedxpanse",
    name: "Xpanse Feed",
    pack: "CortexXpanse",
    summary: "Internet exposure assets for the Xpanse feed.",
    docUrl: "https://docs-cortex.paloaltonetworks.com/r/Cortex-Xpanse-REST-API/Get-Assets-Internet-Exposure",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CortexXpanse/Integrations/FeedXpanse",
    differences: [
      "FeedXpanse.py POSTs /public_api/v1/assets/get_assets_internet_exposure/. This mock returns reply.assets with ip and name.",
      "Tags and TLP are added by the pack after the call. They are not in this body. Filters are ignored.",
      "The exposure page was not reloaded. x-xdr-auth-id is the dummy key.",
    ],
    auth: headerKey("x-xdr-auth-id"),
    operations: [
      jsonOp(
        "exposure",
        "POST",
        "/public_api/v1/assets/get_assets_internet_exposure",
        "Get internet-exposed assets",
        reply([
          {
            name: "assets",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("asset", [field("asset_id", "id"), field("name", "string", { example: "lab-web" }), field("ip", "ip")]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "paloaltonetworks-securityadvisories-paloaltonetworkssecurityadvisories",
    name: "Palo Alto Networks Security Advisories (Beta)",
    pack: "PaloAltoNetworks_SecurityAdvisories",
    summary: "Product list and PAN-OS advisories.",
    docUrl: "https://security.paloaltonetworks.com/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_SecurityAdvisories/Integrations/PaloAltoNetworksSecurityAdvisories",
    differences: [
      "The client GETs /products and /products/{product}/advisories. This mock lists products and answers /products/PAN-OS/advisories.",
      "Other product names do not match. Advisory fields are cve, severity, and title.",
      "security.paloaltonetworks.com was not reloaded. No API key is required on the public feed.",
    ],
    operations: [
      op({
        id: "products",
        method: "GET",
        pathTemplate: "/products",
        summary: "List products",
        status: 200,
        list: true,
        envelope: { type: "array" },
        record: object("product", [field("name", "string", { example: "PAN-OS" })]),
      }),
      jsonOp(
        "advisories",
        "GET",
        "/products/PAN-OS/advisories",
        "List PAN-OS advisories",
        object("body", [
          {
            name: "advisories",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("advisory", [
              field("cve", "string", { example: "CVE-2024-0001" }),
              field("severity", "enum", { enumValues: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }),
              field("title", "string", { example: "Lab advisory" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "fortigate-fortigate",
    name: "FortiGate",
    pack: "FortiGate",
    vendor: "Fortinet",
    summary: "GET /api/v2/cmdb/firewall/address returns results.",
    docUrl: "https://docs.fortinet.com/document/fortigate/7.4.0/administration-guide/954635/rest-api-administrator",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/FortiGate/Integrations/FortiGate",
    differences: [
      "The client base is api/v2 and ADDRESS_IPV4_ENDPOINT is cmdb/firewall/address. This mock returns { results } with name, subnet, and type.",
      "Address groups, policies, and bans are not modeled. vdom is not checked.",
      "The FortiOS REST guide was not reloaded. Authorization is a bearer token.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "addresses",
        "GET",
        "/api/v2/cmdb/firewall/address",
        "List IPv4 address objects",
        object("body", [
          field("http_status", "const", { constValue: 200 }),
          {
            name: "results",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("address", [
              field("name", "string", { example: "lab-host" }),
              field("subnet", "const", { constValue: "10.0.0.8/32" }),
              field("type", "const", { constValue: "ipmask" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "ciscoasa-ciscoasa",
    name: "Cisco ASA",
    pack: "CiscoASA",
    vendor: "Cisco",
    summary: "Token service and global access rules.",
    docUrl: "https://developer.cisco.com/docs/cisco-asa-rest-api/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CiscoASA/Integrations/CiscoASA",
    differences: [
      "The client POSTs /api/tokenservices and GETs /api/access/global/rules. The token is returned in X-Auth-Token and in the body.",
      "Interface-specific access/in and access/out rules are not modeled. The rules body is { items }.",
      "The ASA REST guide was not reloaded. Token creation uses basic auth. Later calls are not checked again.",
    ],
    auth: basic,
    operations: [
      op({
        id: "token",
        method: "POST",
        pathTemplate: "/api/tokenservices",
        summary: "Create a session token",
        status: 200,
        list: false,
        envelope: { type: "object" },
        headers: { "x-auth-token": "dummy-asa-token" },
        record: object("body", [field("token", "const", { constValue: "dummy-asa-token" })]),
      }),
      jsonOp(
        "rules",
        "GET",
        "/api/access/global/rules",
        "List global access rules",
        object("body", [
          {
            name: "items",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("rule", [
              field("objectId", "id"),
              field("permit", "const", { constValue: true }),
              field("sourceAddress", "const", { constValue: "any" }),
              field("destinationAddress", "const", { constValue: "any" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "ciscofirepower-ciscofirepower",
    name: "Cisco Firepower",
    pack: "CiscoFirepower",
    vendor: "Cisco",
    summary: "FMC token and access policies for a lab domain.",
    docUrl: "https://developer.cisco.com/docs/fmc/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CiscoFirepower/Integrations/CiscoFirepower",
    differences: [
      "The client POSTs api/fmc_platform/v1/auth/generatetoken and then uses DOMAIN_UUID. This mock returns the token header and lists policies under domain lab-domain.",
      "The policy body is { items }. Assignments, objects, and deploy are not modeled.",
      "The FMC guide was not reloaded. Token creation uses basic auth.",
    ],
    auth: basic,
    operations: [
      op({
        id: "token",
        method: "POST",
        pathTemplate: "/api/fmc_platform/v1/auth/generatetoken",
        summary: "Generate an FMC token",
        status: 200,
        list: false,
        envelope: { type: "object" },
        headers: { "x-auth-access-token": "dummy-fmc-token", domain_uuid: "lab-domain" },
        record: object("body", [field("token", "const", { constValue: "dummy-fmc-token" }), field("domain_uuid", "const", { constValue: "lab-domain" })]),
      }),
      jsonOp(
        "policies",
        "GET",
        "/api/fmc_config/v1/domain/lab-domain/policy/accesspolicies",
        "List access policies",
        object("body", [
          {
            name: "items",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("policy", [
              field("id", "id"),
              field("name", "string", { example: "lab-policy" }),
              field("type", "const", { constValue: "AccessPolicy" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "checkpointfirewall-checkpointfirewallv2",
    name: "CheckPoint Firewall v2",
    pack: "CheckpointFirewall",
    vendor: "Check Point",
    summary: "Web API login and show-hosts.",
    docUrl: "https://sc1.checkpoint.com/documents/latest/APIs/index.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CheckpointFirewall/Integrations/CheckPointFirewallV2",
    differences: [
      "The client posts login and show-hosts on a base URL that already includes /web_api. This mock answers /web_api/login and /web_api/show-hosts.",
      "Login returns sid. show-hosts returns objects with uid, name, and ipv4-address. Other show commands are not modeled.",
      "The management API index was not reloaded. X-chkp-sid is not checked after login.",
    ],
    operations: [
      jsonOp(
        "login",
        "POST",
        "/web_api/login",
        "Log in",
        object("body", [field("sid", "const", { constValue: "dummy-sid" }), field("uid", "id")]),
      ),
      jsonOp(
        "hosts",
        "POST",
        "/web_api/show-hosts",
        "Show hosts",
        object("body", [
          {
            name: "objects",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("host", [
              field("uid", "id"),
              field("name", "string", { example: "lab-host" }),
              field("ipv4-address", "ip"),
              field("type", "const", { constValue: "host" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "splunkpy-splunkpyv2",
    name: "SplunkPy v2",
    pack: "SplunkPy",
    vendor: "Splunk",
    summary: "Create a search job and read JSON results.",
    docUrl: "https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-tutorials/10.2/rest-api-tutorials/creating-searches-using-the-rest-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/SplunkPy/Integrations/SplunkPyV2",
    differences: [
      "SplunkPy v2 uses splunklib jobs. This mock is the same REST API: POST /services/search/jobs returns { sid } as if output_mode=json.",
      "GET /services/search/jobs/{sid}/results returns { results }. The search is not executed. Export streaming stays on the SplunkPy preset.",
      "Basic auth is the lab user. The management port is not checked.",
    ],
    auth: basic,
    operations: [
      jsonOp("create", "POST", "/services/search/jobs", "Create a search job", object("job", [field("sid", "id")])),
      jsonOp(
        "results",
        "GET",
        "/services/search/jobs/{sid}/results",
        "Read search results",
        object("body", [
          {
            name: "results",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("row", [
              field("_time", "timestamp", { format: "iso" }),
              field("host", "string", { example: "search-head" }),
              field("_raw", "string", { example: "user=ada action=login" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "elasticsearch-elasticsearcheventcollector",
    name: "Elasticsearch Event Collector",
    pack: "Elasticsearch",
    vendor: "Elastic",
    summary: "POST /lab-logs/_search returns hits.hits.",
    docUrl: "https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-search",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Elasticsearch/Integrations/ElasticsearchEventCollector",
    differences: [
      "The collector calls es.search on the fetch index. This mock is POST /lab-logs/_search and returns hits.total plus hits.hits._source.",
      "The query body is not executed. Point-in-time and search_after are not modeled. Use index name lab-logs.",
      "The search API page was not reloaded. Basic auth is the lab user.",
    ],
    auth: basic,
    operations: [
      jsonOp(
        "search",
        "POST",
        "/lab-logs/_search",
        "Search the lab index",
        object("body", [
          field("took", "integer"),
          field("timed_out", "const", { constValue: false }),
          object("hits", [
            object("total", [field("value", "integer"), field("relation", "const", { constValue: "eq" })]),
            {
              name: "hits",
              kind: "array",
              minItems: 1,
              maxItems: 1,
              item: object("hit", [
                field("_index", "const", { constValue: "lab-logs" }),
                field("_id", "id"),
                object("_source", [
                  field("@timestamp", "timestamp", { format: "iso" }),
                  field("message", "string", { example: "user=ada action=login" }),
                  field("host", "string", { example: "lab-host" }),
                ]),
              ]),
            },
          ]),
        ]),
      ),
    ],
  }),
  preset({
    id: "sumologic-sumologic",
    name: "SumoLogic",
    pack: "SumoLogic",
    vendor: "Sumo Logic",
    summary: "Create a search job and read messages.",
    docUrl: "https://www.sumologic.com/help/docs/api/search-job/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/SumoLogic/Integrations/SumoLogic",
    differences: [
      "SumoLogic.js POSTs search/jobs, then GETs search/jobs/{id}/messages. This mock uses /api/v1/search/jobs and returns { id } and { messages }.",
      "Records and the delete call are not modeled. The query is not executed. Offset and limit are ignored.",
      "The search job page was not reloaded. Basic auth is the access id and key. Cloud SIEM is a different preset.",
    ],
    auth: basic,
    operations: [
      jsonOp("create", "POST", "/api/v1/search/jobs", "Create a search job", object("job", [field("id", "id")])),
      jsonOp(
        "messages",
        "GET",
        "/api/v1/search/jobs/{id}/messages",
        "Read search messages",
        object("body", [
          {
            name: "messages",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("message", [object("map", [field("_raw", "string", { example: "user=ada action=login" }), field("_messagetime", "timestamp", { format: "unix-ms" })])]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "cisco-ise-cisco-ise",
    name: "Cisco ISE",
    pack: "cisco-ise",
    vendor: "Cisco",
    summary: "ERS endpoint list.",
    docUrl: "https://developer.cisco.com/docs/identity-services-engine/latest/#!endpoint",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/cisco-ise/Integrations/cisco-ise",
    differences: [
      "The client GETs /ers/config/endpoint. This mock returns SearchResult.total and resources with id and name.",
      "Endpoint groups and MAC filters are not modeled. ERS media types are not checked.",
      "The ISE endpoint page was not reloaded. Basic auth is the ERS admin.",
    ],
    auth: basic,
    operations: [
      jsonOp(
        "endpoints",
        "GET",
        "/ers/config/endpoint",
        "List endpoints",
        object("body", [
          object("SearchResult", [
            field("total", "integer"),
            {
              name: "resources",
              kind: "array",
              minItems: 1,
              maxItems: 1,
              item: object("resource", [field("id", "id"), field("name", "string", { example: "lab-endpoint" })]),
            },
          ]),
        ]),
      ),
    ],
  }),
  preset({
    id: "cisco-meraki-ciscomerakiv2",
    name: "Cisco Meraki v2",
    pack: "cisco-meraki",
    vendor: "Cisco",
    summary: "GET /api/v1/organizations and one org's networks.",
    docUrl: "https://developer.cisco.com/meraki/api-v1/get-organizations/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/cisco-meraki/Integrations/CiscoMerakiv2",
    differences: [
      "The client base is api/v1. GET organizations returns an array. GET organizations/lab-org/networks returns that org's networks.",
      "Inventory, licenses, and devices are not modeled. Other organization ids do not match.",
      "The Meraki get-organizations page was not reloaded. X-Cisco-Meraki-API-Key is the dummy key.",
    ],
    auth: headerKey("X-Cisco-Meraki-API-Key", "dummy-meraki-key"),
    operations: [
      op({
        id: "organizations",
        method: "GET",
        pathTemplate: "/api/v1/organizations",
        summary: "List organizations",
        status: 200,
        list: true,
        envelope: { type: "array" },
        record: object("organization", [field("id", "id"), field("name", "string", { example: "lab-org" })]),
      }),
      op({
        id: "networks",
        method: "GET",
        pathTemplate: "/api/v1/organizations/lab-org/networks",
        summary: "List networks",
        status: 200,
        list: true,
        envelope: { type: "array" },
        record: object("network", [
          field("id", "id"),
          field("name", "string", { example: "lab-network" }),
          field("productTypes", "const", { constValue: "appliance" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "zscaler-zscalerzidentity",
    name: "Zscaler Internet Access via ZIdentity",
    pack: "Zscaler",
    vendor: "Zscaler",
    summary: "Advanced security policy and the user list.",
    docUrl: "https://help.zscaler.com/zia/getting-started-zia-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/Zscaler/Integrations/ZscalerZIdentity",
    differences: [
      "The client base ends in /zia/api/v1. GET /security/advanced returns blacklistUrls. GET /users returns an array.",
      "URL categories, sandbox reports, and the activate call are not modeled. The obfuscated API key session is not checked.",
      "The ZIA API getting-started page was not reloaded. A bearer token stands in for the ZIdentity session.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "advanced",
        "GET",
        "/zia/api/v1/security/advanced",
        "Get the advanced security policy",
        object("body", [
          {
            name: "blacklistUrls",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: field("url", "string", { example: "http://example.test/blocked" }),
          },
        ]),
      ),
      op({
        id: "users",
        method: "GET",
        pathTemplate: "/zia/api/v1/users",
        summary: "List users",
        status: 200,
        list: true,
        envelope: { type: "array" },
        record: object("user", [field("id", "id"), field("email", "email"), field("name", "string", { example: "Ada Lovelace" })]),
      }),
    ],
  }),
  preset({
    id: "checkpointndr-checkpointndr",
    name: "Check Point Network Detection and Response (Infinity NDR)",
    pack: "CheckPointNDR",
    vendor: "Check Point",
    summary: "Login and the insights list.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/CheckPointNDR/Integrations/CheckPointNDR",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CheckPointNDR/Integrations/CheckPointNDR",
    differences: [
      "Infinity NDR API pages were not loaded. The client POSTs /Login/LoginAPI and GETs /incidents/v1/insights, then reads objects.",
      "This mock returns a token and one insight. The events lookup by id is not a separate route. The domain header is not checked.",
      "Login uses basic-style client id and access key in the body. This mock does not check that body.",
    ],
    operations: [
      jsonOp("login", "POST", "/Login/LoginAPI", "Log in", object("body", [field("token", "const", { constValue: "dummy-ndr-token" })])),
      jsonOp(
        "insights",
        "GET",
        "/incidents/v1/insights",
        "List insights",
        object("body", [
          field("status", "const", { constValue: "ok" }),
          {
            name: "objects",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("insight", [
              field("id", "id"),
              field("updated", "timestamp", { format: "unix-ms" }),
              field("probability", "integer"),
              field("title", "string", { example: "Suspicious connection" }),
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "fortisandbox-fortisandboxv2",
    name: "FortiSandbox v2",
    pack: "FortiSandbox",
    vendor: "Fortinet",
    summary: "JSON-RPC scan rating.",
    docUrl: "https://docs.fortinet.com/document/fortisandbox/4.4.0/administration-guide/330312/introduction-to-fortisandbox-api",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/FortiSandbox/Integrations/FortiSandboxv2",
    differences: [
      "The client posts jsonrpc. Scan methods put a url such as /scan/result/urlrating inside the body. This mock returns one result for every POST /jsonrpc.",
      "File submit and PDF report methods are the same route. The inner url is not branched.",
      "The FortiSandbox API guide was not reloaded. The bearer token is the dummy key.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "rpc",
        "POST",
        "/jsonrpc",
        "JSON-RPC scan result",
        object("body", [
          field("id", "integer"),
          field("ver", "const", { constValue: "2.0" }),
          object("result", [
            object("status", [field("code", "const", { constValue: 0 }), field("message", "const", { constValue: "OK" })]),
            object("data", [field("rating", "enum", { enumValues: ["Malicious", "Clean", "Unknown"] }), field("score", "integer")]),
          ]),
        ]),
      ),
    ],
  }),
  preset({
    id: "fortimanager-fortimanager",
    name: "FortiManager",
    pack: "FortiManager",
    vendor: "Fortinet",
    summary: "JSON-RPC device list.",
    docUrl: "https://fndn.fortinet.net/index.php?/fortiapi/5-fortimanager/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/FortiManager/Integrations/FortiManager",
    differences: [
      "The client POSTs jsonrpc. Device reads use /dvmdb/adom/{adom}/device inside the request. This mock returns one device for every POST /jsonrpc.",
      "Groups and other methods share that route. The request method name is not branched.",
      "The FortiManager API portal was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "rpc",
        "POST",
        "/jsonrpc",
        "JSON-RPC device list",
        object("body", [
          field("id", "integer"),
          {
            name: "result",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("result", [
              object("status", [field("code", "const", { constValue: 0 }), field("message", "const", { constValue: "OK" })]),
              {
                name: "data",
                kind: "array",
                minItems: 1,
                maxItems: 1,
                item: object("device", [field("name", "string", { example: "lab-fw" }), field("ip", "ip"), field("sn", "id")]),
              },
            ]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "ciscowsa-ciscowsav2",
    name: "Cisco WSA v2",
    pack: "CiscoWSA",
    vendor: "Cisco",
    summary: "Access policies and URL categories.",
    docUrl: "https://www.cisco.com/c/en/us/td/docs/security/wsa/wsa-14-5/user-guide/b_WSA_UserGuide_14_5/b_WSA_UserGuide_11_7_chapter_0101.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CiscoWSA/Integrations/CiscoWSA",
    differences: [
      "The client GETs /wsa/api/v3.0/web_security/access_policies and /wsa/api/v3.0/generic_resources/url_categories. No test fixture records the GET body.",
      "This mock returns access_policies and categories. Identification profiles and domain maps are not modeled.",
      "The WSA user guide was not reloaded. Basic auth is the appliance admin.",
    ],
    auth: basic,
    operations: [
      jsonOp(
        "policies",
        "GET",
        "/wsa/api/v3.0/web_security/access_policies",
        "List access policies",
        object("body", [
          {
            name: "access_policies",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("policy", [field("policy_name", "string", { example: "lab-policy" })]),
          },
        ]),
      ),
      jsonOp(
        "categories",
        "GET",
        "/wsa/api/v3.0/generic_resources/url_categories",
        "List URL categories",
        object("body", [
          {
            name: "categories",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("category", [field("category_name", "string", { example: "lab" })]),
          },
        ]),
      ),
    ],
  }),
  preset({
    id: "ciscostealthwatch-ciscostealthwatch",
    name: "Cisco Secure Network Analytics (Stealthwatch)",
    pack: "CiscoStealthwatch",
    vendor: "Cisco",
    summary: "Reporting tenants.",
    docUrl: "https://developer.cisco.com/docs/stealthwatch/enterprise/openapi/",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/CiscoStealthwatch/Integrations/CiscoStealthwatch",
    differences: [
      "The client GETs /sw-reporting/v1/tenants. This mock returns a data array with id and displayName.",
      "Tags, flows, and the SMC configuration routes are not modeled.",
      "The Stealthwatch OpenAPI page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp(
        "tenants",
        "GET",
        "/sw-reporting/v1/tenants",
        "List tenants",
        object("body", [
          {
            name: "data",
            kind: "array",
            minItems: 1,
            maxItems: 1,
            item: object("tenant", [field("id", "id"), field("displayName", "string", { example: "lab" })]),
          },
        ]),
      ),
    ],
  }),
];
