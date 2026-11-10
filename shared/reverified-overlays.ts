import type { MockOperation } from "./mock-spec";

export interface ReverifiedOverlay {
  summary: string;
  differences: string[];
  docUrl: string;
  sourceUrl: string;
  operations: MockOperation[];
}

export const reverifiedOverlays: Record<string, ReverifiedOverlay> = {
  "alienvault-otx-alienvault-otx-v2": {
    "summary": "Rebuilt from the client: GET /IPv4/general.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /IPv4/general, GET /cve/general. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://otx.alienvault.com/api",
    "operations": [
      {
        "id": "get-ipv4-general-0",
        "method": "GET",
        "pathTemplate": "/IPv4/general",
        "summary": "GET /IPv4/general",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "AlienVaultOTX",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alexa",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "asn",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "attack_ids",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "author",
              "kind": "object",
              "children": [
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "username",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "count",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-cve-general-1",
        "method": "GET",
        "pathTemplate": "/cve/general",
        "summary": "GET /cve/general",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "AlienVaultOTX",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alexa",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "asn",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "attack_ids",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "author",
              "kind": "object",
              "children": [
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "username",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "count",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/AlienVault_OTX/Integrations/AlienVault_OTX_v2"
  },
  "amp-ampv2": {
    "summary": "Rebuilt from the client: GET /events.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /events. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.cisco.com/docs/secure-endpoint/v1-api-reference-events/",
    "operations": [
      {
        "id": "get-events-0",
        "method": "GET",
        "pathTemplate": "/events",
        "summary": "GET /events",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": true,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "offset",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Allow",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "connector_guid",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "active",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "ancestry",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "application",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "available",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "bp_data",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "end_date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "errors",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "event_type",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/AMP/Integrations/AMPv2"
  },
  "azureactivedirectory-azureadidentityprotection": {
    "summary": "Rebuilt from the client: POST /beta/riskyUsers/confirmCompromised.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /beta/riskyUsers/confirmCompromised, POST /beta/riskyUsers/dismiss. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/riskyuser-list?view=graph-rest-1.0",
    "operations": [
      {
        "id": "post-beta-riskyusers-confirmcompromised-0",
        "method": "POST",
        "pathTemplate": "/beta/riskyUsers/confirmCompromised",
        "summary": "POST /beta/riskyUsers/confirmCompromised",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "context",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "detectedDateTime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "latest_detection_found",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "riskDetail",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "riskEventType",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-beta-riskyusers-dismiss-1",
        "method": "POST",
        "pathTemplate": "/beta/riskyUsers/dismiss",
        "summary": "POST /beta/riskyUsers/dismiss",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "context",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "detectedDateTime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "latest_detection_found",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "riskDetail",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "riskEventType",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/AzureActiveDirectory/Integrations/AzureADIdentityProtection"
  },
  "carbon-black-enterprise-response-carbonblackresponsev2": {
    "summary": "Rebuilt from the client: GET /api/v2/alert.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v2/alert, POST /api/v1/alerts. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.carbonblack.com/reference/enterprise-response/6.3/rest-api/",
    "operations": [
      {
        "id": "get-api-v2-alert-0",
        "method": "GET",
        "pathTemplate": "/api/v2/alert",
        "summary": "GET /api/v2/alert",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ProcessOpen_sub-type",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert_severity",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "build_version_string",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "computer_name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "created_time",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-api-v1-alerts-1",
        "method": "POST",
        "pathTemplate": "/api/v1/alerts",
        "summary": "POST /api/v1/alerts",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ProcessOpen_sub-type",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert_severity",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "build_version_string",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "computer_name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "created_time",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Carbon_Black_Enterprise_Response/Integrations/CarbonBlackResponseV2"
  },
  "cisco-meraki-ciscomerakiv2": {
    "summary": "Rebuilt from the client: GET /organizations/{organization_id}/networks.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /organizations/{organization_id}/networks, GET /organizations. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.cisco.com/meraki/api-v1/get-organizations/",
    "operations": [
      {
        "id": "get-organizations-organization-id-networks-0",
        "method": "GET",
        "pathTemplate": "/organizations/{organization_id}/networks",
        "summary": "GET /organizations/{organization_id}/networks",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Address",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CIDR",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Comment",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Enable",
              "kind": "boolean"
            },
            {
              "name": "Enabled",
              "kind": "boolean"
            }
          ]
        }
      },
      {
        "id": "get-organizations-1",
        "method": "GET",
        "pathTemplate": "/organizations",
        "summary": "GET /organizations",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Address",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CIDR",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Comment",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Enable",
              "kind": "boolean"
            },
            {
              "name": "Enabled",
              "kind": "boolean"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/cisco-meraki/Integrations/CiscoMerakiv2"
  },
  "cisco-umbrella-cloud-security-ciscoumbrellacloudsecurityv2": {
    "summary": "Rebuilt from the client: GET /{destination_list_id}/destinations.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /{destination_list_id}/destinations. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.cisco.com/docs/cloud-security/umbrella-api-reference-policies-destination-lists/",
    "operations": [
      {
        "id": "get-destination-list-id-destinations-0",
        "method": "GET",
        "pathTemplate": "/{destination_list_id}/destinations",
        "summary": "GET /{destination_list_id}/destinations",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": true,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "page",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "access",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "bundleTypeId",
                  "kind": "integer"
                },
                {
                  "name": "comment",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "createdAt",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "destination",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "meta",
              "kind": "object",
              "children": [
                {
                  "name": "limit",
                  "kind": "integer"
                },
                {
                  "name": "page",
                  "kind": "integer"
                },
                {
                  "name": "total",
                  "kind": "integer"
                }
              ]
            },
            {
              "name": "status",
              "kind": "object",
              "children": [
                {
                  "name": "code",
                  "kind": "integer"
                },
                {
                  "name": "text",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Cisco-umbrella-cloud-security/Integrations/CiscoUmbrellaCloudSecurityv2"
  },
  "cisco-umbrella-enforcement-ciscoumbrellaenforcement": {
    "summary": "Rebuilt from the client: POST /events.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /events. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.cisco.com/docs/cloud-security/umbrella-api-reference-enforcement-domains/",
    "operations": [
      {
        "id": "post-events-0",
        "method": "POST",
        "pathTemplate": "/events",
        "summary": "POST /events",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "cred_api_key",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "meta",
              "kind": "object",
              "children": [
                {
                  "name": "next",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Cisco-umbrella-enforcement/Integrations/CiscoUmbrellaEnforcement"
  },
  "ciscoasa-ciscoasa": {
    "summary": "Rebuilt from the client: GET /api/access/global/rules.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/access/global/rules, GET /api/access/in/{interface}/rules. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.cisco.com/docs/cisco-asa-rest-api/",
    "operations": [
      {
        "id": "get-api-access-global-rules-0",
        "method": "GET",
        "pathTemplate": "/api/access/global/rules",
        "summary": "GET /api/access/global/rules",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ASDM_CLIAccessType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Location",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "MSCHAPauthenticated",
              "kind": "boolean"
            },
            {
              "name": "active",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "destinationAddress",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-api-access-in-interface-rules-1",
        "method": "GET",
        "pathTemplate": "/api/access/in/{interface}/rules",
        "summary": "GET /api/access/in/{interface}/rules",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ASDM_CLIAccessType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Location",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "MSCHAPauthenticated",
              "kind": "boolean"
            },
            {
              "name": "active",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "destinationAddress",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CiscoASA/Integrations/CiscoASA"
  },
  "ciscofirepower-ciscofirepower": {
    "summary": "Rebuilt from the client: POST /api/fmc_config/v1/domain/{domain_uuid}/policy/accesspolicies.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /api/fmc_config/v1/domain/{domain_uuid}/policy/accesspolicies. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.cisco.com/docs/fmc/",
    "operations": [
      {
        "id": "post-api-fmc-config-v1-domain-domain-uuid-pol-0",
        "method": "POST",
        "pathTemplate": "/api/fmc_config/v1/domain/{domain_uuid}/policy/accesspolicies",
        "summary": "POST /api/fmc_config/v1/domain/{domain_uuid}/policy/accesspolicies",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "DOMAIN_UUID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "X-auth-access-token",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "action",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "appCategories",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "appProductivity",
              "kind": "object",
              "children": [
                {
                  "name": "name",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "applicationTypes",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CiscoFirepower/Integrations/CiscoFirepower"
  },
  "claroty-claroty": {
    "summary": "Rebuilt from the client: GET /ranger/alerts/{rid}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /ranger/alerts/{rid}, POST /ranger/ranger_api/resolve_alerts. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/Claroty/Integrations/Claroty",
    "operations": [
      {
        "id": "get-ranger-alerts-rid-0",
        "method": "GET",
        "pathTemplate": "/ranger/alerts/{rid}",
        "summary": "GET /ranger/alerts/{rid}",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Authorization",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CVE",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CVE-ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Modified",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Published",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-ranger-ranger-api-resolve-alerts-1",
        "method": "POST",
        "pathTemplate": "/ranger/ranger_api/resolve_alerts",
        "summary": "POST /ranger/ranger_api/resolve_alerts",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Authorization",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CVE",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CVE-ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Modified",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Published",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Claroty/Integrations/Claroty"
  },
  "clarotyxdome-xdome": {
    "summary": "Rebuilt from the client: POST /device_alert_relations.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /device_alert_relations. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/ClarotyXDome/Integrations/XDome",
    "operations": [
      {
        "id": "post-device-alert-relations-0",
        "method": "POST",
        "pathTemplate": "/device_alert_relations",
        "summary": "POST /device_alert_relations",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "alert_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert_name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "device_name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "device_uid",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "last_fetch",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "latest_ids",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/ClarotyXDome/Integrations/XDome"
  },
  "cofenseintelligencev2-cofenseintelligencev2": {
    "summary": "Rebuilt from the client: POST /apiv1/threat/search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /apiv1/threat/search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/CofenseIntelligenceV2/Integrations/CofenseIntelligenceV2",
    "operations": [
      {
        "id": "post-apiv1-threat-search-0",
        "method": "POST",
        "pathTemplate": "/apiv1/threat/search",
        "summary": "POST /apiv1/threat/search",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "blockSet",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "page",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "threats",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "data_1",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "domain_search_response",
              "kind": "object",
              "children": [
                {
                  "name": "data",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "success",
                  "kind": "boolean"
                }
              ]
            },
            {
              "name": "email_search_response",
              "kind": "object",
              "children": [
                {
                  "name": "data",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "success",
                  "kind": "boolean"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CofenseIntelligenceV2/Integrations/CofenseIntelligenceV2"
  },
  "crowdstrikefalcon-crowdstrikefalcon": {
    "summary": "Rebuilt from the client: GET /alerts/queries/alerts/v2.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /alerts/queries/alerts/v2, POST /alerts/entities/alerts/v2. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.crowdstrike.com/api-reference/collections/alerts/",
    "operations": [
      {
        "id": "get-alerts-queries-alerts-v2-0",
        "method": "GET",
        "pathTemplate": "/alerts/queries/alerts/v2",
        "summary": "GET /alerts/queries/alerts/v2",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": true,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "offset",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@rawstring",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Authorization",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Content-Disposition",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Content-Type",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CreatedAt",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "DeletedAt",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-alerts-entities-alerts-v2-1",
        "method": "POST",
        "pathTemplate": "/alerts/entities/alerts/v2",
        "summary": "POST /alerts/entities/alerts/v2",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@rawstring",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Authorization",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Content-Disposition",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Content-Type",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CreatedAt",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "DeletedAt",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CrowdStrikeFalcon/Integrations/CrowdStrikeFalcon"
  },
  "cyberark-aim-cyberarkaim-v2": {
    "summary": "Rebuilt from the client: POST /AIMWebService/api/Accounts.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /AIMWebService/api/Accounts. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.cyberark.com/credential-providers/latest/en/content/ccp/calling-the-web-service-using-rest.htm",
    "operations": [
      {
        "id": "post-aimwebservice-api-accounts-0",
        "method": "POST",
        "pathTemplate": "/AIMWebService/api/Accounts",
        "summary": "POST /AIMWebService/api/Accounts",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Content",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Object",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "UserName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "key_text_creds",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/cyberark_AIM/Integrations/CyberArkAIM_v2"
  },
  "extrahop-extrahop-v2": {
    "summary": "Rebuilt from the client: GET /api/v1/alerts.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v1/alerts, POST /api/v1/detections/search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.extrahop.com/current/rest-detections/",
    "operations": [
      {
        "id": "get-api-v1-alerts-0",
        "method": "GET",
        "pathTemplate": "/api/v1/alerts",
        "summary": "GET /api/v1/alerts",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ExtraHop",
              "kind": "object",
              "children": [
                {
                  "name": "Record",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "_source",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "already_fetched",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "analysis",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "analysis_level",
              "kind": "integer"
            },
            {
              "name": "annotations",
              "kind": "object",
              "children": [
                {
                  "name": "protocols",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      },
      {
        "id": "post-api-v1-detections-search-1",
        "method": "POST",
        "pathTemplate": "/api/v1/detections/search",
        "summary": "POST /api/v1/detections/search",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ExtraHop",
              "kind": "object",
              "children": [
                {
                  "name": "Record",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "_source",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "already_fetched",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "analysis",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "analysis_level",
              "kind": "integer"
            },
            {
              "name": "annotations",
              "kind": "object",
              "children": [
                {
                  "name": "protocols",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/ExtraHop/Integrations/ExtraHop_v2"
  },
  "fireeyeetp-fireeyeetp": {
    "summary": "Rebuilt from the client: GET /events/{message_id}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /events/{message_id}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/FireEyeETP/Integrations/FireEyeETP",
    "operations": [
      {
        "id": "get-events-message-id-0",
        "method": "GET",
        "pathTemplate": "/events/{message_id}",
        "summary": "GET /events/{message_id}",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Delivered_msg",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Logs",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "acceptedDateTime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert",
              "kind": "object",
              "children": [
                {
                  "name": "attack-time",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "explanation",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "malware_md5",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "name",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "occurred",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "alert_date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert_id",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/FireEyeETP/Integrations/FireEyeETP"
  },
  "fortigate-fortigate": {
    "summary": "Rebuilt from the client: GET /api/v2/cmdb/system/vdom.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v2/cmdb/system/vdom, GET /api/v2/select. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.fortinet.com/document/fortigate/7.4.0/administration-guide/954635/rest-api-administrator",
    "operations": [
      {
        "id": "get-api-v2-cmdb-system-vdom-0",
        "method": "GET",
        "pathTemplate": "/api/v2/cmdb/system/vdom",
        "summary": "GET /api/v2/cmdb/system/vdom",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Action",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "AllowRouting",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "AppServiceType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "AssociatedInterface",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CacheTTL",
              "kind": "integer"
            },
            {
              "name": "Category",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-api-v2-select-1",
        "method": "GET",
        "pathTemplate": "/api/v2/select",
        "summary": "GET /api/v2/select",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Action",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "AllowRouting",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "AppServiceType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "AssociatedInterface",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CacheTTL",
              "kind": "integer"
            },
            {
              "name": "Category",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/FortiGate/Integrations/FortiGate"
  },
  "freshworksfreshservice-freshworksfreshservice": {
    "summary": "Rebuilt from the client: POST /api/v2/tickets.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /api/v2/tickets. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://api.freshservice.com/v2/#view_all_ticket",
    "operations": [
      {
        "id": "post-api-v2-tickets-0",
        "method": "POST",
        "pathTemplate": "/api/v2/tickets",
        "summary": "POST /api/v2/tickets",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Conversation",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Note",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Task",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "agent",
              "kind": "object",
              "children": [
                {
                  "name": "active",
                  "kind": "boolean"
                },
                {
                  "name": "address",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "auto_assign_status_changed_at",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "auto_assign_tickets",
                  "kind": "boolean"
                },
                {
                  "name": "background_information",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "agents",
              "kind": "object",
              "children": [
                {
                  "name": "active",
                  "kind": "boolean"
                },
                {
                  "name": "address",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "auto_assign_status_changed_at",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "auto_assign_tickets",
                  "kind": "boolean"
                },
                {
                  "name": "background_information",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "application",
              "kind": "object",
              "children": [
                {
                  "name": "additional_data",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "application_type",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "category",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "created_at",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "description",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/FreshworksFreshservice/Integrations/FreshworksFreshservice"
  },
  "fullhunt-fullhunt": {
    "summary": "Rebuilt from the client: GET /domain/{domain}/details.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /domain/{domain}/details. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://api-docs.fullhunt.io/",
    "operations": [
      {
        "id": "get-domain-domain-details-0",
        "method": "GET",
        "pathTemplate": "/domain/{domain}/details",
        "summary": "GET /domain/{domain}/details",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "http",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "user",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "user_credits",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/FullHunt/Integrations/FullHunt"
  },
  "gsuiteadmin-gsuiteadmin": {
    "summary": "Rebuilt from the client: POST /admin/directory/v1/users.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /admin/directory/v1/users. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developers.google.com/admin-sdk/directory/reference/rest/v1/users/list",
    "operations": [
      {
        "id": "post-admin-directory-v1-users-0",
        "method": "POST",
        "pathTemplate": "/admin/directory/v1/users",
        "summary": "POST /admin/directory/v1/users",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ALIAS_ADD_SUCCESS",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CHROMEOS_DEVICES_LIST",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CHROMEOS_DEVICE_ACTION",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CHROMEOS_DEVICE_ACTION_SUCCESS",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CHROME_BROWSER_LIST",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CUSTOM_USER_SCHEMA",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/GSuiteAdmin/Integrations/GSuiteAdmin"
  },
  "mcafeewebgateway-skyhighsecurewebgatewayonprem": {
    "summary": "Rebuilt from the client: GET /list.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /list. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://success.myshn.net/Skyhigh_Secure_Web_Gateway",
    "operations": [
      {
        "id": "get-list-0",
        "method": "GET",
        "pathTemplate": "/list",
        "summary": "GET /list",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ListEntries",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "entry",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "listType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "title",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/McAfeeWebGateway/Integrations/SkyhighSecureWebGatewayOnPrem"
  },
  "microsoftgraphapplications-microsoftgraphapplications": {
    "summary": "Rebuilt from the client: GET /v1.0/servicePrincipals.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /v1.0/servicePrincipals, PATCH /beta/applications/{service_id}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/application-list",
    "operations": [
      {
        "id": "get-v1-0-serviceprincipals-0",
        "method": "GET",
        "pathTemplate": "/v1.0/servicePrincipals",
        "summary": "GET /v1.0/servicePrincipals",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "replyUrls",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "patch-beta-applications-service-id-1",
        "method": "PATCH",
        "pathTemplate": "/beta/applications/{service_id}",
        "summary": "PATCH /beta/applications/{service_id}",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "replyUrls",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphApplications/Integrations/MicrosoftGraphApplications"
  },
  "microsoftgraphgroups-microsoftgraphgroups": {
    "summary": "Rebuilt from the client: GET /groups.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /groups. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/group-list",
    "operations": [
      {
        "id": "get-groups-0",
        "method": "GET",
        "pathTemplate": "/groups",
        "summary": "GET /groups",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "credentials_certificate_thumbprint",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "creds_auth_code",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "creds_auth_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "creds_tenant_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphGroups/Integrations/MicrosoftGraphGroups"
  },
  "microsoftgraphidentityandaccess-microsoftgraphidentityandaccess": {
    "summary": "Rebuilt from the client: GET /v1.0/identityProtection/riskDetections.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /v1.0/identityProtection/riskDetections, GET /v1.0/directoryRoles. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/rbacapplication-list-roleassignments",
    "operations": [
      {
        "id": "get-v1-0-identityprotection-riskdetections-0",
        "method": "GET",
        "pathTemplate": "/v1.0/identityProtection/riskDetections",
        "summary": "GET /v1.0/identityProtection/riskDetections",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "GrantControls",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "activity",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "activityDateTime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "additionalInfo",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alertDescription",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "appDisplayName",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-v1-0-directoryroles-1",
        "method": "GET",
        "pathTemplate": "/v1.0/directoryRoles",
        "summary": "GET /v1.0/directoryRoles",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "GrantControls",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "activity",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "activityDateTime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "additionalInfo",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alertDescription",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "appDisplayName",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphIdentityandAccess/Integrations/MicrosoftGraphIdentityandAccess"
  },
  "microsoftgraphmail-microsoftgraphlistener": {
    "summary": "Rebuilt from the client: GET /users/{_mailbox_to_fetch}/messages.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /users/{_mailbox_to_fetch}/messages, GET /users/{_mailbox_to_fetch}/mailFolders/{folder_id}/messages. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions",
    "operations": [
      {
        "id": "get-users-mailbox-to-fetch-messages-0",
        "method": "GET",
        "pathTemplate": "/users/{_mailbox_to_fetch}/messages",
        "summary": "GET /users/{_mailbox_to_fetch}/messages",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "type",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "Attachments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Contents",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "File",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileName",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-users-mailbox-to-fetch-mailfolders-folde-1",
        "method": "GET",
        "pathTemplate": "/users/{_mailbox_to_fetch}/mailFolders/{folder_id}/messages",
        "summary": "GET /users/{_mailbox_to_fetch}/mailFolders/{folder_id}/messages",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "type",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "Attachments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Contents",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "File",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileName",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphMail/Integrations/MicrosoftGraphListener"
  },
  "microsoftgraphmail-microsoftgraphmail": {
    "summary": "Rebuilt from the client: GET /users/{_mailbox_to_fetch}/messages.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /users/{_mailbox_to_fetch}/messages, GET /users/{_mailbox_to_fetch}/mailFolders/{folder_id}/messages. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/user-list-messages",
    "operations": [
      {
        "id": "get-users-mailbox-to-fetch-messages-0",
        "method": "GET",
        "pathTemplate": "/users/{_mailbox_to_fetch}/messages",
        "summary": "GET /users/{_mailbox_to_fetch}/messages",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "context",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "type",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "Attachments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Contents",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "File",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileName",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-users-mailbox-to-fetch-mailfolders-folde-1",
        "method": "GET",
        "pathTemplate": "/users/{_mailbox_to_fetch}/mailFolders/{folder_id}/messages",
        "summary": "GET /users/{_mailbox_to_fetch}/mailFolders/{folder_id}/messages",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "context",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "type",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "Attachments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Contents",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "File",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileName",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphMail/Integrations/MicrosoftGraphMail"
  },
  "microsoftgraphteams-microsoftgraphteams": {
    "summary": "Rebuilt from the client: GET /chats/{chat_id}/messages.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /chats/{chat_id}/messages. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/channel-list-messages",
    "operations": [
      {
        "id": "get-chats-chat-id-messages-0",
        "method": "GET",
        "pathTemplate": "/chats/{chat_id}/messages",
        "summary": "GET /chats/{chat_id}/messages",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "Subject",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "content",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "delegated_user",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "user",
              "kind": "object",
              "children": [
                {
                  "name": "displayName",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphTeams/Integrations/MicrosoftGraphTeams"
  },
  "microsoftgraphuser-microsoftgraphuser": {
    "summary": "Rebuilt from the client: POST /users.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /users. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0",
    "operations": [
      {
        "id": "post-users-0",
        "method": "POST",
        "pathTemplate": "/users",
        "summary": "POST /users",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "nextLink",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "AUTHENTICATOR",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "DisplayName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FIDO2",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "JobTitle",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphUser/Integrations/MicrosoftGraphUser"
  },
  "microsoftteams-microsoftteamsmanagement": {
    "summary": "Rebuilt from the client: POST /v1.0/teams.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /v1.0/teams. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/group-list",
    "operations": [
      {
        "id": "post-v1-0-teams-0",
        "method": "POST",
        "pathTemplate": "/v1.0/teams",
        "summary": "POST /v1.0/teams",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "@odata",
              "kind": "object",
              "children": [
                {
                  "name": "context",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "count",
                  "kind": "integer"
                },
                {
                  "name": "type",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "discoverySettings",
              "kind": "object",
              "children": [
                {
                  "name": "showInTeamsSearchAndSuggestions",
                  "kind": "boolean"
                }
              ]
            },
            {
              "name": "displayName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "email",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "funSettings",
              "kind": "object",
              "children": [
                {
                  "name": "allowCustomMemes",
                  "kind": "boolean"
                },
                {
                  "name": "allowGiphy",
                  "kind": "boolean"
                },
                {
                  "name": "allowStickersAndMemes",
                  "kind": "boolean"
                },
                {
                  "name": "giphyContentRating",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "guestSettings",
              "kind": "object",
              "children": [
                {
                  "name": "allowCreateUpdateChannels",
                  "kind": "boolean"
                },
                {
                  "name": "allowDeleteChannels",
                  "kind": "boolean"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftTeams/Integrations/MicrosoftTeamsManagement"
  },
  "okta-okta-iam": {
    "summary": "Rebuilt from the client: GET /users.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /users. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.okta.com/docs/reference/api/users/",
    "operations": [
      {
        "id": "get-users-0",
        "method": "GET",
        "pathTemplate": "/users",
        "summary": "GET /users",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ApplicationID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CustomFields",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "IAMConfiguration",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_links",
              "kind": "object",
              "children": [
                {
                  "name": "logo",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "alternateId",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "context",
              "kind": "object",
              "children": [
                {
                  "name": "IntegrationBrand",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "IntegrationInstance",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Okta/Integrations/Okta_IAM"
  },
  "palo-alto-networks-enterprise-dlp-palo-alto-networks-enterprise-dlp": {
    "summary": "Rebuilt from the client: POST /public/incident-feedback/{incident_id}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /public/incident-feedback/{incident_id}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.paloaltonetworks.com/enterprise-dlp/enterprise-dlp-admin/enterprise-dlp-api",
    "operations": [
      {
        "id": "post-public-incident-feedback-incident-id-0",
        "method": "POST",
        "pathTemplate": "/public/incident-feedback/{incident_id}",
        "summary": "POST /public/incident-feedback/{incident_id}",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "DataPatternMatches",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "DataPatternName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "DataProfile",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Detections",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "HighConfidenceFrequency",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "LowConfidenceFrequency",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Palo_Alto_Networks_Enterprise_DLP/Integrations/Palo_Alto_Networks_Enterprise_DLP"
  },
  "paloaltonetworks-devicesecurity-paloaltonetworks-devicesecurity": {
    "summary": "Rebuilt from the client: GET /iot/pub/v1/alert/list.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /iot/pub/v1/alert/list, GET /iot/pub/v1/device. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.paloaltonetworks.com/iot/iot-security-api/iot-security-api",
    "operations": [
      {
        "id": "get-iot-pub-v1-alert-list-0",
        "method": "GET",
        "pathTemplate": "/iot/pub/v1/alert/list",
        "summary": "GET /iot/pub/v1/alert/list",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "boundary_ids",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "detected_date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "deviceid",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "devices",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-iot-pub-v1-device-1",
        "method": "GET",
        "pathTemplate": "/iot/pub/v1/device",
        "summary": "GET /iot/pub/v1/device",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "boundary_ids",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "detected_date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "deviceid",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "devices",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_DeviceSecurity/Integrations/PaloAltoNetworks_DeviceSecurity"
  },
  "paloaltonetworks-iot-paloaltonetworks-iot": {
    "summary": "Rebuilt from the client: GET /pub/v4.0/alert/list.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /pub/v4.0/alert/list, GET /pub/v4.0/device/list. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.paloaltonetworks.com/iot/iot-security-api/iot-security-api",
    "operations": [
      {
        "id": "get-pub-v4-0-alert-list-0",
        "method": "GET",
        "pathTemplate": "/pub/v4.0/alert/list",
        "summary": "GET /pub/v4.0/alert/list",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "access_key_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "api_timeout",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "detected_date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "deviceid",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-pub-v4-0-device-list-1",
        "method": "GET",
        "pathTemplate": "/pub/v4.0/device/list",
        "summary": "GET /pub/v4.0/device/list",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "access_key_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "api_timeout",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "detected_date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "deviceid",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_IoT/Integrations/PaloAltoNetworks_IoT"
  },
  "prismacloud-prismacloudiam": {
    "summary": "Rebuilt from the client: POST /user.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /user. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://pan.dev/prisma-cloud/api/cspm/user/",
    "operations": [
      {
        "id": "post-user-0",
        "method": "POST",
        "pathTemplate": "/user",
        "summary": "POST /user",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "email",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "enabled",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "x-redlock-status",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/PrismaCloud/Integrations/PrismaCloudIAM"
  },
  "prismasaassecurity-saassecurity": {
    "summary": "Rebuilt from the client: GET /incident/api/apps.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /incident/api/apps, GET /incident/api/incidents/{inc_id}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.paloaltonetworks.com/saas-security/saas-security-admin/saas-security-api",
    "operations": [
      {
        "id": "get-incident-api-apps-0",
        "method": "GET",
        "pathTemplate": "/incident/api/apps",
        "summary": "GET /incident/api/apps",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "action_date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "action_taker",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "app_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "app_name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "app_type",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "asset_cloud_uri",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-incident-api-incidents-inc-id-1",
        "method": "GET",
        "pathTemplate": "/incident/api/incidents/{inc_id}",
        "summary": "GET /incident/api/incidents/{inc_id}",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "action_date",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "action_taker",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "app_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "app_name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "app_type",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "asset_cloud_uri",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/PrismaSaasSecurity/Integrations/SaasSecurity"
  },
  "proofpointserverprotection-proofpointprotectionserverv2": {
    "summary": "Rebuilt from the client: GET /pss/filter.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /pss/filter, GET /pss/health. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/ProofpointServerProtection/Integrations/ProofpointProtectionServerv2",
    "operations": [
      {
        "id": "get-pss-filter-0",
        "method": "GET",
        "pathTemplate": "/pss/filter",
        "summary": "GET /pss/filter",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "count",
              "kind": "integer"
            },
            {
              "name": "records",
              "kind": "object",
              "children": [
                {
                  "name": "date",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "folder",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "from",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "guid",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "host_ip",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "result",
              "kind": "object",
              "children": [
                {
                  "name": "Agent",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Attachment_Names",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Date",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Disposition_Action",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Disposition_SmtpProfile",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "status",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-pss-health-1",
        "method": "GET",
        "pathTemplate": "/pss/health",
        "summary": "GET /pss/health",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "count",
              "kind": "integer"
            },
            {
              "name": "records",
              "kind": "object",
              "children": [
                {
                  "name": "date",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "folder",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "from",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "guid",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "host_ip",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "result",
              "kind": "object",
              "children": [
                {
                  "name": "Agent",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Attachment_Names",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Date",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Disposition_Action",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Disposition_SmtpProfile",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "status",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/ProofpointServerProtection/Integrations/ProofpointProtectionServerV2"
  },
  "proofpointthreatprotection-proofpointthreatprotection": {
    "summary": "Rebuilt from the client: GET /emailProtection/modules/spam/orgBlockList.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /emailProtection/modules/spam/orgBlockList, GET /emailProtection/modules/spam/orgSafeList. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://help.proofpoint.com/Threat_Insight_Dashboard/API_Documentation/People_API",
    "operations": [
      {
        "id": "get-emailprotection-modules-spam-orgblocklis-0",
        "method": "GET",
        "pathTemplate": "/emailProtection/modules/spam/orgBlockList",
        "summary": "GET /emailProtection/modules/spam/orgBlockList",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "entries",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-emailprotection-modules-spam-orgsafelist-1",
        "method": "GET",
        "pathTemplate": "/emailProtection/modules/spam/orgSafeList",
        "summary": "GET /emailProtection/modules/spam/orgSafeList",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "entries",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/ProofpointThreatProtection/Integrations/ProofpointThreatProtection"
  },
  "qradar-qradar-v3": {
    "summary": "Rebuilt from the client: GET /api/ariel/searches/{search_id}/results.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/ariel/searches/{search_id}/results, GET /api/ariel/searches. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://ibmsecuritydocs.github.io/qradar_api_21.0/21.0--siem_offenses--get.html",
    "operations": [
      {
        "id": "get-api-ariel-searches-search-id-results-0",
        "method": "GET",
        "pathTemplate": "/api/ariel/searches/{search_id}/results",
        "summary": "GET /api/ariel/searches/{search_id}/results",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Asset",
              "kind": "object",
              "children": [
                {
                  "name": "hostnames",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "products",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "users",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "CreationDate",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Enabled",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Endpoint",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-api-ariel-searches-1",
        "method": "GET",
        "pathTemplate": "/api/ariel/searches",
        "summary": "GET /api/ariel/searches",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Asset",
              "kind": "object",
              "children": [
                {
                  "name": "hostnames",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "products",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "users",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "CreationDate",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Enabled",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Endpoint",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/QRadar/Integrations/QRadar_v3"
  },
  "qualys-qualysv2": {
    "summary": "Rebuilt from the client: GET /api/5.0/fo/asset/host/vm/detection.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/5.0/fo/asset/host/vm/detection, GET /api/3.0/fo/scan. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.qualys.com/en/vm/api/assets/index.htm",
    "operations": [
      {
        "id": "get-api-5-0-fo-asset-host-vm-detection-0",
        "method": "GET",
        "pathTemplate": "/api/5.0/fo/asset/host/vm/detection",
        "summary": "GET /api/5.0/fo/asset/host/vm/detection",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Address",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "BUGTRAQ_LIST",
              "kind": "object",
              "children": [
                {
                  "name": "BUGTRAQ",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "CATEGORY",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CODE",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CORRELATION",
              "kind": "object",
              "children": [
                {
                  "name": "EXPLOITS",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "CVE_LIST",
              "kind": "object",
              "children": [
                {
                  "name": "CVE",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      },
      {
        "id": "get-api-3-0-fo-scan-1",
        "method": "GET",
        "pathTemplate": "/api/3.0/fo/scan",
        "summary": "GET /api/3.0/fo/scan",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Address",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "BUGTRAQ_LIST",
              "kind": "object",
              "children": [
                {
                  "name": "BUGTRAQ",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "CATEGORY",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CODE",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CORRELATION",
              "kind": "object",
              "children": [
                {
                  "name": "EXPLOITS",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "CVE_LIST",
              "kind": "object",
              "children": [
                {
                  "name": "CVE",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/qualys/Integrations/Qualysv2"
  },
  "qualysfim-qualysfim": {
    "summary": "Rebuilt from the client: POST /fim/v3/incidents/search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /fim/v3/incidents/search, POST /fim/v2/incidents/{incident_id}/events/search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.qualys.com/en/fim/api/index.htm",
    "operations": [
      {
        "id": "post-fim-v3-incidents-search-0",
        "method": "POST",
        "pathTemplate": "/fim/v3/incidents/search",
        "summary": "POST /fim/v3/incidents/search",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "action",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "actor",
              "kind": "object",
              "children": [
                {
                  "name": "imagePath",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "process",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "processID",
                  "kind": "integer"
                },
                {
                  "name": "userID",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "userName",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "agentVersion",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "approvalDate",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "approvalStatus",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "approvalType",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-fim-v2-incidents-incident-id-events-sear-1",
        "method": "POST",
        "pathTemplate": "/fim/v2/incidents/{incident_id}/events/search",
        "summary": "POST /fim/v2/incidents/{incident_id}/events/search",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "action",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "actor",
              "kind": "object",
              "children": [
                {
                  "name": "imagePath",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "process",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "processID",
                  "kind": "integer"
                },
                {
                  "name": "userID",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "userName",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "agentVersion",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "approvalDate",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "approvalStatus",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "approvalType",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/QualysFIM/Integrations/QualysFIM"
  },
  "rapid7-insightidr-rapid7-insightidr": {
    "summary": "Rebuilt from the client: POST /idr/v2/investigations.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /idr/v2/investigations, GET /idr/v1/investigations. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://help.rapid7.com/insightidr/en-us/api/v2/index.html",
    "operations": [
      {
        "id": "post-idr-v2-investigations-0",
        "method": "POST",
        "pathTemplate": "/idr/v2/investigations",
        "summary": "POST /idr/v2/investigations",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Content-Disposition",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ProductAlert",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "apikey_creds",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assignee",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "created_time",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-idr-v1-investigations-1",
        "method": "GET",
        "pathTemplate": "/idr/v1/investigations",
        "summary": "GET /idr/v1/investigations",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Content-Disposition",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ProductAlert",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "apikey_creds",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assignee",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "created_time",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Rapid7_InsightIDR/Integrations/Rapid7_InsightIDR"
  },
  "rapid7insightvmcloud-rapid7insightvmcloud": {
    "summary": "Rebuilt from the client: POST /v4/integration/assets.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /v4/integration/assets, POST /v4/integration/vulnerabilities. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://help.rapid7.com/insightvm/en-us/api/index.html",
    "operations": [
      {
        "id": "post-v4-integration-assets-0",
        "method": "POST",
        "pathTemplate": "/v4/integration/assets",
        "summary": "POST /v4/integration/assets",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": true,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "page",
          "limitParam": "size",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "scans",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-v4-integration-vulnerabilities-1",
        "method": "POST",
        "pathTemplate": "/v4/integration/vulnerabilities",
        "summary": "POST /v4/integration/vulnerabilities",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": true,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "page",
          "limitParam": "size",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "scans",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Rapid7InsightVMCloud/Integrations/Rapid7InsightVMCloud"
  },
  "recordedfuture-recordedfuture": {
    "summary": "Rebuilt from the client: POST /v2/alert/fetch_incidents.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /v2/alert/fetch_incidents. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://api.recordedfuture.com/v2/",
    "operations": [
      {
        "id": "post-v2-alert-fetch-incidents-0",
        "method": "POST",
        "pathTemplate": "/v2/alert/fetch_incidents",
        "summary": "POST /v2/alert/fetch_incidents",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "CommandResults",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Evidence",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "asn",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "context",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "create_indicator",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "demisto_last_run",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/RecordedFuture/Integrations/RecordedFuture"
  },
  "secureworks-taegisxdrv2": {
    "summary": "Rebuilt from the client: POST /graphql.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /graphql. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.ctpx.secureworks.com/apis/graphql/",
    "operations": [
      {
        "id": "post-graphql-0",
        "method": "POST",
        "pathTemplate": "/graphql",
        "summary": "POST /graphql",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "alerts",
              "kind": "object",
              "children": [
                {
                  "name": "list",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "client_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "client_secret",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "commandline",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "created_at",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "addCommentToInvestigation",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "addEvidenceToInvestigation",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "alertsServiceSearch",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "alertsServiceUpdateResolutionInfo",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "archiveInvestigation",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/SecureWorks/Integrations/TaegisXDRv2"
  },
  "securonix-securonix": {
    "summary": "Rebuilt from the client: GET /incident/get.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /incident/get. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://documentation.securonix.com/",
    "operations": [
      {
        "id": "get-incident-get-0",
        "method": "GET",
        "pathTemplate": "/incident/get",
        "summary": "GET /incident/get",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "ACTIVE",
              "kind": "object",
              "children": [
                {
                  "name": "action",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "status",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "Comments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Content-Disposition",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "DONE",
              "kind": "object",
              "children": [
                {
                  "name": "action",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "status",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "Eventid",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Policies",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Securonix/Integrations/Securonix"
  },
  "skyhighsecurity-skyhighsecurity": {
    "summary": "Rebuilt from the client: POST /external/api/v1/queryIncidents.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /external/api/v1/queryIncidents. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://success.myshn.net/Skyhigh_CASB/Skyhigh_CASB_APIs",
    "operations": [
      {
        "id": "post-external-api-v1-queryincidents-0",
        "method": "POST",
        "pathTemplate": "/external/api/v1/queryIncidents",
        "summary": "POST /external/api/v1/queryIncidents",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "actorId",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "body",
              "kind": "object",
              "children": [
                {
                  "name": "incidents",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "responseInfo",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "content",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "content_checksum",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "integer"
            },
            {
              "name": "identifier",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/SkyhighSecurity/Integrations/SkyhighSecurity"
  },
  "slack-slackeventcollector": {
    "summary": "Rebuilt from the client: GET /logs.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /logs. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://api.slack.com/admins/audit-logs",
    "operations": [
      {
        "id": "get-logs-0",
        "method": "GET",
        "pathTemplate": "/logs",
        "summary": "GET /logs",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "action",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "actor",
              "kind": "object",
              "children": [
                {
                  "name": "type",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "user",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "context",
              "kind": "object",
              "children": [
                {
                  "name": "ip_address",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "location",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "session_id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "ua",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "date_create",
              "kind": "integer"
            },
            {
              "name": "entity",
              "kind": "object",
              "children": [
                {
                  "name": "type",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "user",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "entries",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Slack/Integrations/SlackEventCollector"
  },
  "sophosxgfirewall-sophosxgfirewall": {
    "summary": "Rebuilt from the client: GET /webconsole/APIController.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /webconsole/APIController. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.sophos.com/nsg/sophos-firewall/19.5/API/",
    "operations": [
      {
        "id": "get-webconsole-apicontroller-0",
        "method": "GET",
        "pathTemplate": "/webconsole/APIController",
        "summary": "GET /webconsole/APIController",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "IsDeleted",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Response",
              "kind": "object",
              "children": [
                {
                  "name": "@APIVersion",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "@IPS_CAT_VER",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Login",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "SecurityPolicy",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "endpoint_tag",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "table_headers",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/SophosXGFirewall/Integrations/SophosXGFirewall"
  },
  "urlscan-urlscan": {
    "summary": "Rebuilt from the client: GET /search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://urlscan.io/docs/api/",
    "operations": [
      {
        "id": "get-search-0",
        "method": "GET",
        "pathTemplate": "/search",
        "summary": "GET /search",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "EffectiveURL",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FeedRelatedIndicators",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "File",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Indicator",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/UrlScan/Integrations/UrlScan"
  },
  "varonissaas-varonissaas": {
    "summary": "Rebuilt from the client: POST /app/dataquery/api/search/v2/search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /app/dataquery/api/search/v2/search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/VaronisSaaS",
    "operations": [
      {
        "id": "post-app-dataquery-api-search-v2-search-0",
        "method": "POST",
        "pathTemplate": "/app/dataquery/api/search/v2/search",
        "summary": "POST /app/dataquery/api/search/v2/search",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "Alert",
              "kind": "object",
              "children": [
                {
                  "name": "Alert",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Asset",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "CloseReason",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Data",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "Device",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "AlertSeqId",
              "kind": "integer"
            },
            {
              "name": "Category",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CloseNotes",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "CloseReason",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ContainMaliciousExternalIP",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/VaronisSaaS/Integrations/VaronisSaaS"
  },
  "virustotal-virustotalv3": {
    "summary": "Rebuilt from the client: GET /api/v3/files/{file}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v3/files/{file}, GET /api/v3/ip_addresses/{ip}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.virustotal.com/reference/file-info",
    "operations": [
      {
        "id": "get-api-v3-files-file-0",
        "method": "GET",
        "pathTemplate": "/api/v3/files/{file}",
        "summary": "GET /api/v3/files/{file}",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "CompanyName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileTypeExtension",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "MIMEType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "OriginalFileName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ProductName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "abuse",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-api-v3-ip-addresses-ip-1",
        "method": "GET",
        "pathTemplate": "/api/v3/ip_addresses/{ip}",
        "summary": "GET /api/v3/ip_addresses/{ip}",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "CompanyName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileTypeExtension",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "MIMEType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "OriginalFileName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ProductName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "abuse",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/VirusTotal/Integrations/VirusTotalV3"
  },
  "vmray-vmray": {
    "summary": "Rebuilt from the client: POST /sample/submit.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /sample/submit, GET /analysis/sample/{sample}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://www.vmray.com/cyber-security-blog/vmray-analyzer-api/",
    "operations": [
      {
        "id": "post-sample-submit-0",
        "method": "POST",
        "pathTemplate": "/sample/submit",
        "summary": "POST /sample/submit",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "JobID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "SampleID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "SampleURL",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "SubmissionID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "VMRay",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Verdict",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-analysis-sample-sample-1",
        "method": "GET",
        "pathTemplate": "/analysis/sample/{sample}",
        "summary": "GET /analysis/sample/{sample}",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": false,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "none",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "cursor",
          "defaultLimit": 20,
          "maxLimit": 100
        },
        "record": {
          "name": "body",
          "kind": "object",
          "children": [
            {
              "name": "JobID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "SampleID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "SampleURL",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "SubmissionID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "VMRay",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Verdict",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/VMRay/Integrations/VMRay"
  }
};
