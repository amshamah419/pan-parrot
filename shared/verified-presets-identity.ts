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
function op(partial: Omit<MockOperation, "headers" | "pagination" | "contentType">): MockOperation {
  return {
    ...partial,
    headers: {},
    contentType: "application/json; charset=utf-8",
    pagination: { ...defaultPagination(), style: "none" },
  };
}
function jsonOp(id: string, method: MockOperation["method"], path: string, summary: string, record: FieldSpec): MockOperation {
  return op({ id, method, pathTemplate: path, summary, status: 200, list: false, envelope: { type: "object" }, record });
}
function arrayOp(id: string, method: MockOperation["method"], path: string, summary: string, item: string, children: FieldSpec[]): MockOperation {
  return op({
    id, method, pathTemplate: path, summary, status: 200, list: true, envelope: { type: "array" },
    record: object(item, children),
  });
}

const bearer: MockAuth = { mode: "bearer", bearer: { token: "dummy-bearer" } };
const basic: MockAuth = { mode: "basic", basic: { username: "lab-admin", password: "dummy-not-a-real-password" } };
function headerKey(name: string, value = "dummy-key"): MockAuth {
  return { mode: "api-key", apiKey: { in: "header", name, value } };
}

function preset(input: {
  id: string; name: string; pack: string; vendor: string; summary: string; docUrl: string; sourceUrl: string;
  differences: string[]; operations: MockOperation[]; auth?: MockAuth;
}) {
  return {
    id: input.id, name: input.name, pack: input.pack, vendor: input.vendor, fidelity: "verified" as const, curated: true as const,
    summary: input.summary, notes: input.differences,
    attribution: "Checked against a public vendor reference or, when that page was not reloaded, the demisto/content client. See /presets/ATTRIBUTION.md.",
    sourceUrl: input.sourceUrl,
    spec: {
      version: 1 as const,
      source: {
        kind: "preset" as const, id: input.id, name: input.name, fidelity: "verified" as const,
        attribution: "Public API reference or demisto/content client (MIT).", sourceUrl: input.docUrl, notes: input.differences,
        verification: { status: "verified" as const, docUrl: input.docUrl, checkedAt, differences: input.differences },
      },
      operations: input.operations, chaos: defaultChaos(input.id), totalRecords: 40, auth: input.auth ?? { mode: "none" as const },
    } satisfies MockSpec,
  };
}

const gh = (pack: string, folder: string) => `https://github.com/demisto/content/tree/master/Packs/${pack}/Integrations/${folder}`;

export const identityVerifiedPresets = [
  preset({
    id: "okta-oktaeventcollector", name: "Okta Event Collector", pack: "Okta", vendor: "Okta",
    summary: "GET /api/v1/logs returns system log events.",
    docUrl: "https://developer.okta.com/docs/reference/api/system-log/",
    sourceUrl: gh("Okta", "OktaEventCollector"),
    differences: [
      "The collector GETs /api/v1/logs. Okta returns a JSON array. This mock returns one event.",
      "The since filter and the Link header page are not modeled. Okta v2 user and group commands stay on the Okta v2 preset.",
      "The system log page was not reloaded. The SSWS token is the dummy API key.",
    ],
    auth: headerKey("Authorization", "SSWS dummy-okta-key"),
    operations: [arrayOp("logs", "GET", "/api/v1/logs", "List system log events", "event", [
      field("uuid", "id"), field("eventType", "string", { example: "user.session.start" }), field("published", "timestamp", { format: "iso" }),
    ])],
  }),
  preset({
    id: "okta-okta-iam", name: "Okta IAM", pack: "Okta", vendor: "Okta",
    summary: "GET /api/v1/users lists Okta users.",
    docUrl: "https://developer.okta.com/docs/reference/api/users/",
    sourceUrl: gh("Okta", "Okta_IAM"),
    differences: [
      "Okta IAM reads /api/v1/users. The README shows id, status, and profile. This mock returns one user.",
      "Create, lifecycle, and group assignment are not modeled.",
      "The users API page was not reloaded. The SSWS token is the dummy API key.",
    ],
    auth: headerKey("Authorization", "SSWS dummy-okta-key"),
    operations: [arrayOp("users", "GET", "/api/v1/users", "List users", "user", [
      field("id", "id"), field("status", "const", { constValue: "ACTIVE" }), field("profile", "string", { example: "ada@lab.example" }),
    ])],
  }),
  preset({
    id: "pingidentity-pingone", name: "PingOne", pack: "PingIdentity", vendor: "Ping Identity",
    summary: "Users in a PingOne environment.",
    docUrl: "https://docs.pingidentity.com/pingone/main/p1_apiResources.html",
    sourceUrl: gh("PingIdentity", "PingOne"),
    differences: [
      "The client base is /v1/environments/{environment_id}/ and GETs users. This mock uses environment lab-env and returns _embedded.users.",
      "Create, update, and population calls are not modeled.",
      "The PingOne API resources page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [
      jsonOp("users", "GET", "/v1/environments/lab-env/users", "List users", object("body", [
        object("_embedded", [
          listField("users", "user", [
            field("id", "id"),
            field("username", "string", { example: "ada" }),
            field("email", "email"),
          ]),
        ]),
      ])),
    ],
  }),
  preset({
    id: "onelogin-onelogineventcollector", name: "OneLogin Event Collector", pack: "OneLogin", vendor: "OneLogin",
    summary: "GET /api/1/events returns events.",
    docUrl: "https://developers.onelogin.com/api-docs/1/events/get-events",
    sourceUrl: gh("OneLogin", "OneLoginEventCollector"),
    differences: [
      "The collector GETs /api/1/events after OAuth at /auth/oauth2/v2/token. This mock returns { data } with one event.",
      "Event types and the token route are not modeled. The query is ignored.",
      "The get-events page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("events", "GET", "/api/1/events", "List events", object("body", [
      listField("data", "event", [field("id", "id"), field("event_type_id", "integer"), field("created_at", "timestamp", { format: "iso" })]),
    ]))],
  }),
  preset({
    id: "gsuiteadmin-gsuiteadmin", name: "Google Workspace Admin", pack: "GSuiteAdmin", vendor: "Google",
    summary: "Directory users.",
    docUrl: "https://developers.google.com/admin-sdk/directory/reference/rest/v1/users/list",
    sourceUrl: gh("GSuiteAdmin", "GSuiteAdmin"),
    differences: [
      "The client calls /v1/users on the Admin SDK directory base. This mock is GET /admin/directory/v1/users and returns { users }.",
      "Mobile devices, aliases, and transfers are not modeled.",
      "The users.list page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("users", "GET", "/admin/directory/v1/users", "List users", object("body", [
      listField("users", "user", [field("id", "id"), field("primaryEmail", "email"), field("suspended", "const", { constValue: false })]),
    ]))],
  }),
  preset({
    id: "gsuiteauditor-gsuiteauditor", name: "G Suite Auditor", pack: "GsuiteAuditor", vendor: "Google",
    summary: "Admin reports login activity.",
    docUrl: "https://developers.google.com/admin-sdk/reports/reference/rest/v1/activities/list",
    sourceUrl: gh("GsuiteAuditor", "GsuiteAuditor"),
    differences: [
      "The client GETs /reports/v1/activity/users/{user}/applications/{app} on admin.googleapis.com. This mock is users/all and application login.",
      "Other application names do not match. nextPageToken is omitted.",
      "The activities.list page was not reloaded. A bearer token is required. Security alerts stay on the G Suite Security Alert Center preset.",
    ],
    auth: bearer,
    operations: [jsonOp("login", "GET", "/reports/v1/activity/users/all/applications/login", "List login activity", object("body", [
      listField("items", "activity", [field("id", "id"), field("actor", "email"), field("event", "string", { example: "login_success" })]),
    ]))],
  }),
  preset({
    id: "infoblox-infoblox", name: "Infoblox NIOS", pack: "Infoblox", vendor: "Infoblox",
    summary: "WAPI host records.",
    docUrl: "https://docs.infoblox.com/space/nios85/page/2512664126/Infoblox+REST+API",
    sourceUrl: gh("Infoblox", "Infoblox"),
    differences: [
      "The client base is /wapi/v2.13.1/ and GETs record:host. WAPI returns a JSON array. This mock returns one host.",
      "IPv4 address search and record create are not modeled.",
      "The NIOS REST page was not reloaded. Basic auth is the lab user.",
    ],
    auth: basic,
    operations: [arrayOp("hosts", "GET", "/wapi/v2.13.1/record:host", "List host records", "host", [
      field("_ref", "id"), field("name", "string", { example: "lab.example" }), field("ipv4addr", "ip"),
    ])],
  }),
  preset({
    id: "infobloxbloxone-infobloxbloxonethreatdefenseeventcollector", name: "Infoblox BloxOne Threat Defense Event Collector", pack: "InfobloxBloxOne", vendor: "Infoblox",
    summary: "DNS security events.",
    docUrl: "https://csp.infoblox.com",
    sourceUrl: gh("InfobloxBloxOne", "InfobloxBloxOneThreatDefenseEventCollector"),
    differences: [
      "The collector GETs /api/dnsdata/v2/dns_event. The CSP console was not loaded as an API reference.",
      "This mock returns one DNS event. The query window is ignored.",
      "The Authorization header is the dummy key. Dossier and TIDE commands stay on the other Infoblox presets.",
    ],
    auth: headerKey("Authorization"),
    operations: [jsonOp("events", "GET", "/api/dnsdata/v2/dns_event", "List DNS events", object("body", [
      listField("result", "event", [field("id", "id"), field("qname", "string", { example: "lab.example" }), field("src_ip", "ip")]),
    ]))],
  }),
  preset({
    id: "feedinfobloxthreatintelligence-feedinfobloxthreatintelligence", name: "Infoblox Threat Intelligence Feed", pack: "FeedInfobloxThreatIntelligence", vendor: "Infoblox",
    summary: "Hourly TIDE IP threats.",
    docUrl: "https://csp.infoblox.com",
    sourceUrl: gh("FeedInfobloxThreatIntelligence", "FeedInfobloxThreatIntelligence"),
    differences: [
      "The feed GETs /tide/api/data/threats/{type}/hourly. This mock is the ip hourly route.",
      "Other indicator types are not modeled. The CSP page was not loaded.",
      "The Authorization header is the dummy key.",
    ],
    auth: headerKey("Authorization"),
    operations: [jsonOp("hourly", "GET", "/tide/api/data/threats/ip/hourly", "List hourly IP threats", object("body", [
      listField("threat", "indicator", [field("id", "id"), field("ip", "ip"), field("threat_level", "integer")]),
    ]))],
  }),
  preset({
    id: "cisco-umbrella-cloud-security-ciscoumbrellacloudsecurityv2", name: "Cisco Umbrella Cloud Security v2", pack: "Cisco-umbrella-cloud-security", vendor: "Cisco",
    summary: "Destination lists.",
    docUrl: "https://developer.cisco.com/docs/cloud-security/umbrella-api-reference-policies-destination-lists/",
    sourceUrl: gh("Cisco-umbrella-cloud-security", "CiscoUmbrellaCloudSecurityv2"),
    differences: [
      "The client base is https://api.umbrella.com and GETs policies/v2/destinationlists. This mock returns one list.",
      "Destinations inside a list and the /v2/token route are not modeled. Reporting stays on the Umbrella Reporting preset.",
      "The destination-lists page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("lists", "GET", "/policies/v2/destinationlists", "List destination lists", object("body", [
      listField("data", "list", [field("id", "id"), field("name", "string", { example: "lab-block" }), field("access", "const", { constValue: "block" })]),
    ]))],
  }),
  preset({
    id: "cisco-umbrella-enforcement-ciscoumbrellaenforcement", name: "Cisco Umbrella Enforcement", pack: "Cisco-umbrella-enforcement", vendor: "Cisco",
    summary: "Enforcement domain list.",
    docUrl: "https://developer.cisco.com/docs/cloud-security/umbrella-api-reference-enforcement-domains/",
    sourceUrl: gh("Cisco-umbrella-enforcement", "CiscoUmbrellaEnforcement"),
    differences: [
      "The client GETs domains with customerKey. This mock returns a JSON array of one domain.",
      "Add and delete are not modeled. customerKey is not checked.",
      "The enforcement domains page was not reloaded.",
    ],
    auth: headerKey("customerKey", "dummy-umbrella-key"),
    operations: [arrayOp("domains", "GET", "/domains", "List enforcement domains", "domain", [
      field("id", "id"), field("name", "string", { example: "lab.example" }),
    ])],
  }),
  preset({
    id: "cisco-umbrella-cisco-umbrella-investigate", name: "Cisco Umbrella Investigate", pack: "Cisco-umbrella", vendor: "Cisco",
    summary: "Domain categorization.",
    docUrl: "https://developer.cisco.com/docs/cloud-security/umbrella-api-reference-investigate-categorization/",
    sourceUrl: gh("Cisco-umbrella", "Cisco-umbrella-investigate"),
    differences: [
      "The client GETs investigate/v2/domains/categorization/{domain}. This mock answers lab.example.",
      "Search and the auth token route are not modeled.",
      "The categorization page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("category", "GET", "/investigate/v2/domains/categorization/lab.example", "Categorize a domain", object("body", [
      object("lab.example", [field("status", "const", { constValue: "1" }), field("security_categories", "string", { example: "Malware" })]),
    ]))],
  }),
  preset({
    id: "cloudflarewaf-cloudflarewaf", name: "Cloudflare WAF", pack: "CloudflareWAF", vendor: "Cloudflare",
    summary: "Zones and firewall rules.",
    docUrl: "https://developers.cloudflare.com/api/resources/firewall/subresources/rules/methods/list/",
    sourceUrl: gh("CloudflareWAF", "CloudflareWAF"),
    differences: [
      "The client base defaults to https://api.cloudflare.com/client/v4/. This mock lists zones and firewall rules for zone lab-zone.",
      "Create, update, and filters are not modeled. The result array is one item.",
      "The firewall rules page was not reloaded. Authorization is the dummy bearer.",
    ],
    auth: bearer,
    operations: [
      jsonOp("zones", "GET", "/client/v4/zones", "List zones", object("body", [
        field("success", "const", { constValue: true }),
        listField("result", "zone", [field("id", "id"), field("name", "string", { example: "lab.example" })]),
      ])),
      jsonOp("rules", "GET", "/zones/lab-zone/firewall/rules", "List firewall rules", object("body", [
        field("success", "const", { constValue: true }),
        listField("result", "rule", [field("id", "id"), field("action", "enum", { enumValues: ["block", "challenge", "allow"] })]),
      ])),
    ],
  }),
  preset({
    id: "cloudflarezerotrust-cloudflarezerotrusteventcollector", name: "Cloudflare Zero Trust", pack: "CloudflareZeroTrust", vendor: "Cloudflare",
    summary: "Access request logs.",
    docUrl: "https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/logs/",
    sourceUrl: gh("CloudflareZeroTrust", "CloudflareZeroTrustEventCollector"),
    differences: [
      "The collector GETs /client/v4/accounts/{account}/access/logs/access_requests. This mock uses account lab-account.",
      "Gateway logs are not modeled. The result array is one request.",
      "The Access logs page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("access", "GET", "/client/v4/accounts/lab-account/access/logs/access_requests", "List access requests", object("body", [
      field("success", "const", { constValue: true }),
      listField("result", "request", [field("id", "id"), field("user_email", "email"), field("action", "const", { constValue: "allow" })]),
    ]))],
  }),
  preset({
    id: "feedcloudflare-feedcloudflare", name: "Cloudflare Feed", pack: "FeedCloudflare", vendor: "Cloudflare",
    summary: "Cloudflare published IP ranges.",
    docUrl: "https://www.cloudflare.com/ips/",
    sourceUrl: gh("FeedCloudflare", "FeedCloudflare"),
    differences: [
      "The feed downloads https://www.cloudflare.com/ips-v4 as newline-separated text. This mock returns JSON { addresses } so the studio can page it.",
      "IPv6 ranges are not modeled. One example address is returned.",
      "The IPs page was not reloaded. No API key is required on the public list.",
    ],
    operations: [jsonOp("v4", "GET", "/ips-v4", "List IPv4 ranges", object("body", [
      listField("addresses", "address", [field("cidr", "const", { constValue: "1.1.1.1/32" })]),
    ]))],
  }),
  preset({
    id: "armis-armis", name: "Armis", pack: "Armis", vendor: "Armis",
    summary: "AQL device search.",
    docUrl: "https://www.armis.com/platform/",
    sourceUrl: gh("Armis", "Armis"),
    differences: [
      "The client base is /api/v1/ and GETs /search/ with an aql parameter. This mock returns one device. The AQL string is ignored.",
      "The access token route is not modeled.",
      "The Armis platform page was not an API reference. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("search", "GET", "/api/v1/search", "Search devices", object("body", [
      object("data", [listField("results", "device", [field("id", "id"), field("ipAddress", "ip"), field("name", "string", { example: "lab-plc" })])]),
    ]))],
  }),
  preset({
    id: "armis-armiseventcollector", name: "Armis Event Collector", pack: "Armis", vendor: "Armis",
    summary: "The same device search used by the collector.",
    docUrl: "https://www.armis.com/platform/",
    sourceUrl: gh("Armis", "ArmisEventCollector"),
    differences: [
      "The collector GETs /api/v1/search/ and reads data.results and data.next. It sends from and length.",
      "next is 0 so paging stops. The access token route is not modeled. The AQL string is ignored.",
      "The Armis platform page was not an API reference. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("search", "GET", "/api/v1/search", "Search devices", object("body", [
      object("data", [
        listField("results", "device", [field("id", "id"), field("ipAddress", "ip"), field("type", "const", { constValue: "PLC" })]),
        field("next", "const", { constValue: 0 }),
      ]),
    ]))],
  }),
  preset({
    id: "claroty-claroty", name: "Claroty", pack: "Claroty", vendor: "Claroty",
    summary: "Ranger alerts.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/Claroty/Integrations/Claroty",
    sourceUrl: gh("Claroty", "Claroty"),
    differences: [
      "Claroty API pages were not loaded. The client GETs ranger/alerts after auth/authenticate.",
      "This mock returns one alert. Assets and the login route are not modeled.",
      "A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("alerts", "GET", "/ranger/alerts", "List alerts", object("body", [
      listField("alerts", "alert", [field("id", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high"] }), field("type", "string", { example: "network" })]),
    ]))],
  }),
  preset({
    id: "clarotyxdome-xdome", name: "xDome", pack: "ClarotyXDome", vendor: "Claroty",
    summary: "Device and alert relations.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/ClarotyXDome/Integrations/XDome",
    sourceUrl: gh("ClarotyXDome", "XDome"),
    differences: [
      "xDome API pages were not loaded. The client POSTs /api/v1/device_alert_relations/ and device_vulnerability_relations/.",
      "This mock returns one relation. Status updates are not modeled.",
      "A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("relations", "POST", "/api/v1/device_alert_relations", "List device alert relations", object("body", [
      listField("items", "relation", [field("id", "id"), field("device_id", "id"), field("alert_id", "id")]),
    ]))],
  }),
  preset({
    id: "nozominetworks-nozominetworks", name: "Nozomi Networks", pack: "NozomiNetworks", vendor: "Nozomi Networks",
    summary: "Open API query.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/NozomiNetworks/Integrations/NozomiNetworks",
    sourceUrl: gh("NozomiNetworks", "NozomiNetworks"),
    differences: [
      "Nozomi API pages were not loaded. The client POSTs /api/open/query/do after /api/open/sign_in.",
      "This mock returns one row. Sign-in, ack, and close are not modeled. The query is ignored.",
      "A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("query", "POST", "/api/open/query/do", "Run a query", object("body", [
      listField("result", "row", [field("id", "id"), field("name", "string", { example: "lab-asset" }), field("ip", "ip")]),
    ]))],
  }),
  preset({
    id: "microsoftdefenderthreatintelligence-microsoftdefenderthreatintelligence", name: "Microsoft Defender Threat Intelligence", pack: "MicrosoftDefenderThreatIntelligence", vendor: "Microsoft",
    summary: "Threat intelligence articles.",
    docUrl: "https://learn.microsoft.com/en-us/graph/api/security-threatintelligence-list-articles",
    sourceUrl: gh("MicrosoftDefenderThreatIntelligence", "MicrosoftDefenderThreatIntelligence"),
    differences: [
      "The client GETs v1.0/security/threatIntelligence/articles on Microsoft Graph. This mock returns { value } with one article.",
      "Indicators, intel profiles, and a single article are not modeled.",
      "The list-articles page was not reloaded. A bearer token is required. 365 Defender incidents stay on their earlier preset.",
    ],
    auth: bearer,
    operations: [jsonOp("articles", "GET", "/v1.0/security/threatIntelligence/articles", "List articles", object("body", [
      listField("value", "article", [field("id", "id"), field("title", "string", { example: "Lab threat article" }), field("createdDateTime", "timestamp", { format: "iso" })]),
    ]))],
  }),
  preset({
    id: "recordedfuturev3-recordedfuturealerts", name: "Recorded Future Alerts", pack: "RecordedFutureV3", vendor: "Recorded Future",
    summary: "Search v3 alerts.",
    docUrl: "https://support.recordedfuture.com/hc/en-us/articles/115000894468-API-Documentation",
    sourceUrl: gh("RecordedFutureV3", "RecordedFutureAlerts"),
    differences: [
      "The client POSTs /v3/alert/search and GETs /info/whoami. This mock returns one alert from the search.",
      "Update and rules are not modeled. The search body is ignored.",
      "The support article was not reloaded. The X-RFToken header is the dummy key.",
    ],
    auth: headerKey("X-RFToken"),
    operations: [jsonOp("search", "POST", "/v3/alert/search", "Search alerts", object("body", [
      listField("data", "alert", [field("id", "id"), field("title", "string", { example: "Lab alert" }), field("severity", "enum", { enumValues: ["Informational", "Moderate", "Critical"] })]),
    ]))],
  }),
  preset({
    id: "recordedfuture-recordedfutureplaybookalerts", name: "Recorded Future - Playbook Alerts", pack: "RecordedFuture", vendor: "Recorded Future",
    summary: "Search playbook alerts.",
    docUrl: "https://support.recordedfuture.com/hc/en-us/articles/115000894468-API-Documentation",
    sourceUrl: gh("RecordedFuture", "RecordedFuturePlaybookAlerts"),
    differences: [
      "The client POSTs /v2/playbook_alert/search. This mock returns one playbook alert.",
      "Fetch, lookup, and update are not modeled.",
      "The support article was not reloaded. The X-RFToken header is the dummy key.",
    ],
    auth: headerKey("X-RFToken"),
    operations: [jsonOp("search", "POST", "/v2/playbook_alert/search", "Search playbook alerts", object("body", [
      listField("data", "alert", [field("id", "id"), field("title", "string", { example: "Playbook alert" }), field("status", "const", { constValue: "New" })]),
    ]))],
  }),
  preset({
    id: "recordedfuture-recordedfutureeventcollector", name: "Recorded Future Event Collector", pack: "RecordedFuture", vendor: "Recorded Future",
    summary: "XSIAM alert search.",
    docUrl: "https://support.recordedfuture.com/hc/en-us/articles/115000894468-API-Documentation",
    sourceUrl: gh("RecordedFuture", "RecordedFutureEventCollector"),
    differences: [
      "The collector base is https://api.recordedfuture.com/gw/xsiam and GETs /alert/search. This mock returns one alert.",
      "Config info is not modeled. The query is ignored.",
      "The support article was not reloaded. The X-RFToken header is the dummy key.",
    ],
    auth: headerKey("X-RFToken"),
    operations: [jsonOp("alerts", "GET", "/alert/search", "Search alerts", object("body", [
      listField("data", "alert", [field("id", "id"), field("title", "string", { example: "Collector alert" })]),
    ]))],
  }),
  preset({
    id: "identityrecordedfuture-identityrecordedfuture", name: "Recorded Future Identity", pack: "IdentityRecordedFuture", vendor: "Recorded Future",
    summary: "Credential search.",
    docUrl: "https://support.recordedfuture.com/hc/en-us/articles/115000894468-API-Documentation",
    sourceUrl: gh("IdentityRecordedFuture", "IdentityRecordedFuture"),
    differences: [
      "The client POSTs /v2/identity/credentials/search. This mock returns one credential hit.",
      "Lookup and password lookup are not modeled. The search body is ignored.",
      "The support article was not reloaded. The X-RFToken header is the dummy key.",
    ],
    auth: headerKey("X-RFToken"),
    operations: [jsonOp("search", "POST", "/v2/identity/credentials/search", "Search credentials", object("body", [
      listField("data", "credential", [field("id", "id"), field("login", "email"), field("domain", "string", { example: "lab.example" })]),
    ]))],
  }),
  preset({
    id: "recordedfutureasi-recordedfutureasi", name: "Recorded Future Attack Surface Intelligence", pack: "RecordedFutureASI", vendor: "Recorded Future",
    summary: "Attack-surface issues for a project.",
    docUrl: "https://docs.securitytrails.com/docs/overview",
    sourceUrl: gh("RecordedFutureASI", "RecordedFutureASI"),
    differences: [
      "The client base is hardcoded to https://api.securitytrails.com/v1/asi. Fetch calls /rules/{project}/recent/issues and reads data plus meta.snapshot.",
      "The earlier mock used snapshot latest and an issues array. Activity history is not modeled.",
      "The SecurityTrails overview was not reloaded. The API key header is the dummy key.",
    ],
    auth: headerKey("APIKEY"),
    operations: [jsonOp("issues", "GET", "/v1/asi/rules/lab-project/recent/issues", "List issues", object("body", [
      object("meta", [field("snapshot", "const", { constValue: "recent" })]),
      listField("data", "rule", [
        field("name", "string", { example: "Open admin port" }),
        field("description", "string", { example: "An admin port is exposed" }),
        field("classification", "enum", { enumValues: ["informational", "moderate", "high"] }),
        object("example_entities", [
          { name: "domains", kind: "array", minItems: 1, maxItems: 1, item: field("domain", "const", { constValue: "lab.example" }) },
          { name: "ips", kind: "array", minItems: 1, maxItems: 1, item: field("ip", "const", { constValue: "203.0.113.10" }) },
        ]),
        object("rule_metadata", [
          object("entity_counts", [field("domains", "integer"), field("ips", "integer")]),
        ]),
      ]),
    ]))],
  }),
  preset({
    id: "recordedfuture-recordedfuturelists", name: "Recorded Future - Lists", pack: "RecordedFuture", vendor: "Recorded Future",
    summary: "Search watchlists.",
    docUrl: "https://support.recordedfuture.com/hc/en-us/articles/115000894468-API-Documentation",
    sourceUrl: gh("RecordedFuture", "RecordedFutureLists"),
    differences: [
      "The client POSTs /v2/lists/search. This mock returns one list.",
      "Entity add, remove, and lookup are not modeled.",
      "The support article was not reloaded. The X-RFToken header is the dummy key.",
    ],
    auth: headerKey("X-RFToken"),
    operations: [jsonOp("search", "POST", "/v2/lists/search", "Search lists", object("body", [
      listField("data", "list", [field("id", "id"), field("name", "string", { example: "lab-watchlist" })]),
    ]))],
  }),
  preset({
    id: "secureworks-taegisxdrv2", name: "TaegisXDR v2", pack: "Secureworks", vendor: "Secureworks",
    summary: "GraphQL investigations.",
    docUrl: "https://docs.ctpx.secureworks.com/apis/graphql/",
    sourceUrl: gh("Secureworks", "TaegisXDRv2"),
    differences: [
      "The client POSTs /graphql. This mock returns data.investigations with one investigation. The query text is not executed.",
      "Auth at /auth/api/v2/auth/token and alert evidence mutations are not modeled.",
      "The GraphQL docs page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("graphql", "POST", "/graphql", "Query investigations", object("body", [
      object("data", [listField("investigations", "investigation", [field("id", "id"), field("status", "const", { constValue: "OPEN" })])]),
    ]))],
  }),
  preset({
    id: "checkpointxdr-checkpointxdr", name: "Check Point XDR", pack: "CheckPointXDR", vendor: "Check Point",
    summary: "XDR incidents.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/CheckPointXDR/Integrations/CheckPointXDR",
    sourceUrl: gh("CheckPointXDR", "CheckPointXDR"),
    differences: [
      "Infinity XDR pages were not loaded. The client lists /api/xdr/v1/incidents and reads /app/xdr/api/xdr/v1/incidents/{id}.",
      "This mock lists incidents. Login at /auth/external is not modeled.",
      "A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("incidents", "GET", "/app/xdr/api/xdr/v1/incidents", "List incidents", object("body", [
      listField("incidents", "incident", [field("id", "id"), field("severity", "enum", { enumValues: ["low", "medium", "high"] }), field("title", "string", { example: "Suspicious connection" })]),
    ]))],
  }),
  preset({
    id: "virustotal-feedlivehunt", name: "VirusTotal Livehunt Feed", pack: "VirusTotal", vendor: "VirusTotal",
    summary: "Livehunt notification files.",
    docUrl: "https://docs.virustotal.com/reference/intelligence-hunting-notifications",
    sourceUrl: gh("VirusTotal", "FeedLivehunt"),
    differences: [
      "The feed GETs intelligence/hunting_notification_files on https://www.virustotal.com/api/v3/. This mock returns { data } with one file.",
      "The notification cursor is ignored. File reputation stays on VirusTotal v3.",
      "The hunting notifications page was not reloaded. x-apikey is the dummy key.",
    ],
    auth: headerKey("x-apikey"),
    operations: [jsonOp("files", "GET", "/intelligence/hunting_notification_files", "List livehunt files", object("body", [
      listField("data", "file", [field("id", "id"), field("type", "const", { constValue: "file" })]),
    ]))],
  }),
  preset({
    id: "virustotal-feedretrohunt", name: "VirusTotal Retrohunt Feed", pack: "VirusTotal", vendor: "VirusTotal",
    summary: "Finished retrohunt jobs.",
    docUrl: "https://docs.virustotal.com/reference/intelligence-retrohunt",
    sourceUrl: gh("VirusTotal", "FeedRetrohunt"),
    differences: [
      "The feed GETs intelligence/retrohunt_jobs?filter=status:finished. This mock returns one finished job.",
      "Matching files for a job are not modeled.",
      "The retrohunt page was not reloaded. x-apikey is the dummy key.",
    ],
    auth: headerKey("x-apikey"),
    operations: [jsonOp("jobs", "GET", "/intelligence/retrohunt_jobs", "List finished retrohunt jobs", object("body", [
      listField("data", "job", [field("id", "id"), field("status", "const", { constValue: "finished" })]),
    ]))],
  }),
  preset({
    id: "hoxhunt-hoxhuntv2", name: "Hoxhunt v2", pack: "Hoxhunt", vendor: "Hoxhunt",
    summary: "GraphQL incidents.",
    docUrl: "https://github.com/demisto/content/tree/master/Packs/Hoxhunt/Integrations/HoxhuntV2",
    sourceUrl: gh("Hoxhunt", "HoxhuntV2"),
    differences: [
      "The pack posts a GraphQL query to the configured base URL. This mock answers POST /graphql with data.incidents. The query is not executed.",
      "Point the instance URL at the catch URL plus /graphql if the client uses an empty suffix. Incident updates are not modeled.",
      "Hoxhunt API pages were not loaded. Authorization is the dummy key.",
    ],
    auth: headerKey("Authorization"),
    operations: [jsonOp("graphql", "POST", "/graphql", "Query incidents", object("body", [
      object("data", [listField("incidents", "incident", [field("id", "id"), field("state", "const", { constValue: "OPEN" }), field("updatedAt", "timestamp", { format: "iso" })])]),
    ]))],
  }),
  preset({
    id: "fullhunt-fullhunt", name: "FullHunt", pack: "FullHunt", vendor: "FullHunt",
    summary: "Domain details.",
    docUrl: "https://api-docs.fullhunt.io/",
    sourceUrl: gh("FullHunt", "FullHunt"),
    differences: [
      "The client base is /api/v1 and GETs /domain/{domain}/details. This mock answers lab.example.",
      "Host lookup, subdomains, and /auth/status are not modeled.",
      "The API docs page was not reloaded. X-API-KEY is the dummy key.",
    ],
    auth: headerKey("X-API-KEY"),
    operations: [jsonOp("details", "GET", "/domain/lab.example/details", "Get domain details", object("body", [
      field("domain", "const", { constValue: "lab.example" }),
      listField("hosts", "host", [field("ip", "ip"), field("dns", "string", { example: "www.lab.example" })]),
    ]))],
  }),
  preset({
    id: "sekoiaintelligencecenter-sekoiaintelligencecenter", name: "SEKOIAIntelligenceCenter", pack: "SEKOIAIntelligenceCenter", vendor: "SEKOIA",
    summary: "Intelligence Center indicators.",
    docUrl: "https://docs.sekoia.io/develop/rest_api/intelligence_center/intelligence/",
    sourceUrl: gh("SEKOIAIntelligenceCenter", "SEKOIAIntelligenceCenter"),
    differences: [
      "The client GETs /v2/inthreat/indicators and /v2/inthreat/observables. This mock returns one indicator.",
      "Observables and indicator context are not modeled. Auth validate is not modeled.",
      "The intelligence API page was not reloaded. A bearer token is required.",
    ],
    auth: bearer,
    operations: [jsonOp("indicators", "GET", "/v2/inthreat/indicators", "List indicators", object("body", [
      listField("items", "indicator", [field("id", "id"), field("pattern", "string", { example: "[ipv4-addr:value = '1.2.3.4']" }), field("valid_from", "timestamp", { format: "iso" })]),
    ]))],
  }),
];
