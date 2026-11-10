import type { MockOperation } from "./mock-spec";

export interface ReverifiedOverlay {
  summary: string;
  differences: string[];
  docUrl: string;
  sourceUrl: string;
  operations: MockOperation[];
}

export const reverifiedOverlays: Record<string, ReverifiedOverlay> = {
  "abusedb-abusedb": {
    "summary": "Rebuilt from the client: GET /api/v2/check.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v2/check. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.abuseipdb.com/#check-endpoint",
    "operations": [
      {
        "id": "get-api-v2-check-0",
        "method": "GET",
        "pathTemplate": "/api/v2/check",
        "summary": "GET /api/v2/check",
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
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "reportedAddress",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "IP",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "abuseConfidenceScore",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "categories",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "countryCode",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "countryName",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/AbuseDB/Integrations/AbuseDB"
  },
  "azureloganalytics-azureloganalytics": {
    "summary": "Rebuilt from the client: POST /v1/workspaces/{workspace_id}/query.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /v1/workspaces/{workspace_id}/query. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/rest/api/loganalytics/dataaccess/query/execute",
    "operations": [
      {
        "id": "post-v1-workspaces-workspace-id-query-0",
        "method": "POST",
        "pathTemplate": "/v1/workspaces/{workspace_id}/query",
        "summary": "POST /v1/workspaces/{workspace_id}/query",
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
              "name": "columns",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "rows",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "tables",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "value",
              "kind": "object",
              "children": [
                {
                  "name": "authorizationSource",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "displayName",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "location",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "managedByTenants",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                }
              ]
            },
            {
              "name": "createDate",
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
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/AzureLogAnalytics/Integrations/AzureLogAnalytics"
  },
  "azuresentinel-azuresentinel": {
    "summary": "Rebuilt from the client: GET /subscriptions/{subscription_id}/resourceGroups/{resource_group_name}/providers/Microsoft.OperationalInsights/workspaces/{workspaceName}/providers/Micr",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /subscriptions/{subscription_id}/resourceGroups/{resource_group_name}/providers/Microsoft.OperationalInsights/workspaces/{workspaceName}/providers/Microsoft.SecurityInsights/incidents. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/rest/api/securityinsights/incidents/list?view=rest-securityinsights-2024-03-01",
    "operations": [
      {
        "id": "get-subscriptions-subscription-id-resourcegr-0",
        "method": "GET",
        "pathTemplate": "/subscriptions/{subscription_id}/resourceGroups/{resource_group_name}/providers/Microsoft.OperationalInsights/workspaces/{workspaceName}/providers/Microsoft.SecurityInsights/incidents",
        "summary": "GET /subscriptions/{subscription_id}/resourceGroups/{resource_group_name}/providers/Microsoft.OperationalInsights/workspaces/{workspaceName}/providers/Microsoft.SecurityInsights/in",
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
              "name": "value",
              "kind": "object",
              "children": [
                {
                  "name": "kind",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "name",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "properties",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "CreatedTimeUTC",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "IncidentNumber",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "KillChainPhases",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "LastModifiedTimeUTC",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/AzureSentinel/Integrations/AzureSentinel"
  },
  "checkpointndr-checkpointndr": {
    "summary": "Rebuilt from the client: GET /incidents/v1/insights.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /incidents/v1/insights, GET /incidents/v1/events. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/CheckPointNDR/Integrations/CheckPointNDR",
    "operations": [
      {
        "id": "get-incidents-v1-insights-0",
        "method": "GET",
        "pathTemplate": "/incidents/v1/insights",
        "summary": "GET /incidents/v1/insights",
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
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "description",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "discovery_date",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "name",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "statistics",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "events",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "from",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "last_fetch",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "objects",
              "kind": "object",
              "children": [
                {
                  "name": "actions",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "assign",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "attachments",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                },
                {
                  "name": "count",
                  "kind": "integer"
                },
                {
                  "name": "created",
                  "kind": "integer"
                }
              ]
            }
          ]
        }
      },
      {
        "id": "get-incidents-v1-events-1",
        "method": "GET",
        "pathTemplate": "/incidents/v1/events",
        "summary": "GET /incidents/v1/events",
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
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "description",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "discovery_date",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "name",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "statistics",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "events",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "from",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "last_fetch",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "objects",
              "kind": "object",
              "children": [
                {
                  "name": "actions",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "assign",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "attachments",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                },
                {
                  "name": "count",
                  "kind": "integer"
                },
                {
                  "name": "created",
                  "kind": "integer"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CheckPointNDR/Integrations/CheckPointNDR"
  },
  "checkpointxdr-checkpointxdr": {
    "summary": "Rebuilt from the client: GET /app/xdr/api/xdr/v1/incidents.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /app/xdr/api/xdr/v1/incidents. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/CheckPointXDR/Integrations/CheckPointXDR",
    "operations": [
      {
        "id": "get-app-xdr-api-xdr-v1-incidents-0",
        "method": "GET",
        "pathTemplate": "/app/xdr/api/xdr/v1/incidents",
        "summary": "GET /app/xdr/api/xdr/v1/incidents",
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
              "name": "Outgoing",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "closeReason",
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
                  "name": "incident_id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "incidents",
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
              "name": "display_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CheckPointXDR/Integrations/CheckPointXDR"
  },
  "cisco-umbrella-cisco-umbrella-investigate": {
    "summary": "Rebuilt from the client: GET /investigate/v2/domains/categorization/{domain}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /investigate/v2/domains/categorization/{domain}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.cisco.com/docs/cloud-security/umbrella-api-reference-investigate-categorization/",
    "operations": [
      {
        "id": "get-investigate-v2-domains-categorization-do-0",
        "method": "GET",
        "pathTemplate": "/investigate/v2/domains/categorization/{domain}",
        "summary": "GET /investigate/v2/domains/categorization/{domain}",
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
              "name": "CoOccurrences",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Domain",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "DomainHistory",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Related",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "administrativeContactCountry",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Cisco-umbrella/Integrations/Cisco-umbrella-investigate"
  },
  "cloudflarewaf-cloudflarewaf": {
    "summary": "Rebuilt from the client: POST /zones/{zone_id}/firewall/rules.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /zones/{zone_id}/firewall/rules, GET /zones. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developers.cloudflare.com/api/resources/firewall/subresources/rules/methods/list/",
    "operations": [
      {
        "id": "post-zones-zone-id-firewall-rules-0",
        "method": "POST",
        "pathTemplate": "/zones/{zone_id}/firewall/rules",
        "summary": "POST /zones/{zone_id}/firewall/rules",
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
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "filter",
              "kind": "object",
              "children": [
                {
                  "name": "expression",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "global_api_key",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "kind",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-zones-1",
        "method": "GET",
        "pathTemplate": "/zones",
        "summary": "GET /zones",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": true,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "page",
          "limitParam": "per_page",
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
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "filter",
              "kind": "object",
              "children": [
                {
                  "name": "expression",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "global_api_key",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "kind",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CloudflareWAF/Integrations/CloudflareWAF"
  },
  "cofensevision-cofensevision": {
    "summary": "Rebuilt from the client: GET /api/v4/quarantineJobs.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v4/quarantineJobs, POST /api/v4/quarantineJobs. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/CofenseVision/Integrations/CofenseVision",
    "operations": [
      {
        "id": "get-api-v4-quarantinejobs-0",
        "method": "GET",
        "pathTemplate": "/api/v4/quarantineJobs",
        "summary": "GET /api/v4/quarantineJobs",
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
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "attributes",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "metadata",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "address",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "attachmentExcludeMimeTypes",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "attachmentHashCriteria",
              "kind": "object",
              "children": [
                {
                  "name": "attachmentHashes",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                }
              ]
            },
            {
              "name": "attachmentMimeTypes",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            }
          ]
        }
      },
      {
        "id": "post-api-v4-quarantinejobs-1",
        "method": "POST",
        "pathTemplate": "/api/v4/quarantineJobs",
        "summary": "POST /api/v4/quarantineJobs",
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
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "attributes",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "metadata",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "address",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "attachmentExcludeMimeTypes",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "attachmentHashCriteria",
              "kind": "object",
              "children": [
                {
                  "name": "attachmentHashes",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                }
              ]
            },
            {
              "name": "attachmentMimeTypes",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CofenseVision/Integrations/CofenseVision"
  },
  "cortexxdr-cortexxdrir": {
    "summary": "Rebuilt from the client: POST /public_api/v1/incidents/get_incidents.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /public_api/v1/incidents/get_incidents. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs-cortex.paloaltonetworks.com/r/Cortex-XDR-REST-API/Get-Incidents",
    "operations": [
      {
        "id": "post-public-api-v1-incidents-get-incidents-0",
        "method": "POST",
        "pathTemplate": "/public_api/v1/incidents/get_incidents",
        "summary": "POST /public_api/v1/incidents/get_incidents",
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
              "name": "XDM",
              "kind": "object",
              "children": [
                {
                  "name": "ASSET_GROUP",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "action_file_path",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert_count",
              "kind": "integer"
            },
            {
              "name": "alert_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alerts",
              "kind": "object",
              "children": [
                {
                  "name": "action",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "action_country",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "action_external_hostname",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "action_file_macro_sha256",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "action_file_md5",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "alerts_limit_per_incident",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CortexXDR/Integrations/CortexXDRIR"
  },
  "cortexxdr-xdr-iocs": {
    "summary": "Rebuilt from the client: POST /public_api/v1/indicators/tim_insert_jsons.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /public_api/v1/indicators/tim_insert_jsons, POST /public_api/v1/indicators/{path}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs-cortex.paloaltonetworks.com/r/Cortex-XDR-REST-API/Insert-or-Update-Indicators",
    "operations": [
      {
        "id": "post-public-api-v1-indicators-tim-insert-json-0",
        "method": "POST",
        "pathTemplate": "/public_api/v1/indicators/tim_insert_jsons",
        "summary": "POST /public_api/v1/indicators/tim_insert_jsons",
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
              "name": "IOC_TYPE",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "REPUTATION",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "RULE_COMMENT",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "RULE_EXPIRATION_TIME",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "RULE_INDICATOR",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "RULE_MODIFY_TIME",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-public-api-v1-indicators-path-1",
        "method": "POST",
        "pathTemplate": "/public_api/v1/indicators/{path}",
        "summary": "POST /public_api/v1/indicators/{path}",
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
              "name": "IOC_TYPE",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "REPUTATION",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "RULE_COMMENT",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "RULE_EXPIRATION_TIME",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "RULE_INDICATOR",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "RULE_MODIFY_TIME",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CortexXDR/Integrations/XDR_iocs"
  },
  "cortexxdr-xqlqueryingengine": {
    "summary": "Rebuilt from the client: POST /xql/get_query_results.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /xql/get_query_results, POST /xql/start_xql_query. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs-cortex.paloaltonetworks.com/r/Cortex-XDR-REST-API/Start-an-XQL-Query",
    "operations": [
      {
        "id": "post-xql-get-query-results-0",
        "method": "POST",
        "pathTemplate": "/xql/get_query_results",
        "summary": "POST /xql/get_query_results",
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
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "reply",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "results",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Incidents",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ParentEntry",
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
                }
              ]
            }
          ]
        }
      },
      {
        "id": "post-xql-start-xql-query-1",
        "method": "POST",
        "pathTemplate": "/xql/start_xql_query",
        "summary": "POST /xql/start_xql_query",
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
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "reply",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "results",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Incidents",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ParentEntry",
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
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CortexXDR/Integrations/XQLQueryingEngine"
  },
  "crowdstrikefalconsandbox-crowdstrikefalconsandboxv2": {
    "summary": "Rebuilt from the client: GET /system/environments.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /system/environments, GET /report/{file}/summary. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://www.hybrid-analysis.com/docs/api/v2",
    "operations": [
      {
        "id": "get-system-environments-0",
        "method": "GET",
        "pathTemplate": "/system/environments",
        "summary": "GET /system/environments",
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
              "name": "Vx-Filename",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "count",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "entryInfoFile",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "environment_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "image",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "integrationReliability",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-report-file-summary-1",
        "method": "GET",
        "pathTemplate": "/report/{file}/summary",
        "summary": "GET /report/{file}/summary",
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
              "name": "Vx-Filename",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "count",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "entryInfoFile",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "environment_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "image",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "integrationReliability",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CrowdStrikeFalconSandbox/Integrations/CrowdStrikeFalconSandboxV2"
  },
  "crowdstrikeintel-crowdstrikefalconintel-v2": {
    "summary": "Rebuilt from the client: GET /intel/combined/indicators/v1.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /intel/combined/indicators/v1, GET /intel/combined/actors/v1. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/CrowdStrikeIntel/Integrations/CrowdStrikeFalconIntel_v2",
    "operations": [
      {
        "id": "get-intel-combined-indicators-v1-0",
        "method": "GET",
        "pathTemplate": "/intel/combined/indicators/v1",
        "summary": "GET /intel/combined/indicators/v1",
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
              "name": "Value",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "active",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "actors",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "capability",
              "kind": "object",
              "children": [
                {
                  "name": "value",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "created_date",
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
        "id": "get-intel-combined-actors-v1-1",
        "method": "GET",
        "pathTemplate": "/intel/combined/actors/v1",
        "summary": "GET /intel/combined/actors/v1",
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
              "name": "Value",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "active",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "actors",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "capability",
              "kind": "object",
              "children": [
                {
                  "name": "value",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "created_date",
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
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CrowdStrikeIntel/Integrations/CrowdStrikeFalconIntel_v2"
  },
  "crowdstrikemalquery-crowdstrikemalquery": {
    "summary": "Rebuilt from the client: GET /malquery/aggregates/quotas/v1.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /malquery/aggregates/quotas/v1, GET /malquery/entities/download-files/v1. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/CrowdStrikeMalquery/Integrations/CrowdStrikeMalquery",
    "operations": [
      {
        "id": "get-malquery-aggregates-quotas-v1-0",
        "method": "GET",
        "pathTemplate": "/malquery/aggregates/quotas/v1",
        "summary": "GET /malquery/aggregates/quotas/v1",
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
              "name": "credentials_client",
              "kind": "object",
              "children": [
                {
                  "name": "identifier",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "integrationReliability",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "label",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "md5",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "meta",
              "kind": "object",
              "children": [
                {
                  "name": "days_left",
                  "kind": "integer"
                },
                {
                  "name": "download_count",
                  "kind": "integer"
                },
                {
                  "name": "download_counts",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                },
                {
                  "name": "download_limit",
                  "kind": "integer"
                },
                {
                  "name": "hunt_count",
                  "kind": "integer"
                }
              ]
            },
            {
              "name": "path",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-malquery-entities-download-files-v1-1",
        "method": "GET",
        "pathTemplate": "/malquery/entities/download-files/v1",
        "summary": "GET /malquery/entities/download-files/v1",
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
              "name": "credentials_client",
              "kind": "object",
              "children": [
                {
                  "name": "identifier",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "integrationReliability",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "label",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "md5",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "meta",
              "kind": "object",
              "children": [
                {
                  "name": "days_left",
                  "kind": "integer"
                },
                {
                  "name": "download_count",
                  "kind": "integer"
                },
                {
                  "name": "download_counts",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                },
                {
                  "name": "download_limit",
                  "kind": "integer"
                },
                {
                  "name": "hunt_count",
                  "kind": "integer"
                }
              ]
            },
            {
              "name": "path",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CrowdStrikeMalquery/Integrations/CrowdStrikeMalquery"
  },
  "crowdstrikeopenapi-crowdstrikeopenapi": {
    "summary": "Rebuilt from the client: GET /devices/queries/devices/v1.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /devices/queries/devices/v1, POST /real-time-response/combined/batch-init-session/v1. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://falcon.crowdstrike.com/documentation/page/a2a7fc0e/real-time-response-apis",
    "operations": [
      {
        "id": "get-devices-queries-devices-v1-0",
        "method": "GET",
        "pathTemplate": "/devices/queries/devices/v1",
        "summary": "GET /devices/queries/devices/v1",
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
              "name": "Content-Disposition",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-real-time-response-combined-batch-init-s-1",
        "method": "POST",
        "pathTemplate": "/real-time-response/combined/batch-init-session/v1",
        "summary": "POST /real-time-response/combined/batch-init-session/v1",
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
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/CrowdStrikeOpenAPI/Integrations/CrowdStrikeOpenAPI"
  },
  "devo-devo": {
    "summary": "Rebuilt from the client: POST /search/query.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /search/query. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.devo.com/space/latest/147554326/Query+API",
    "operations": [
      {
        "id": "post-search-query-0",
        "method": "POST",
        "pathTemplate": "/search/query",
        "summary": "POST /search/query",
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
              "name": "eventdate",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "from",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "json",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "limit",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "markdown",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "note",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Devo/Integrations/Devo"
  },
  "dspm-dspm": {
    "summary": "Rebuilt from the client: GET /v1/assets.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /v1/assets, GET /v1/risk-findings. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://pan.dev/prisma-cloud/api/dspm/",
    "operations": [
      {
        "id": "get-v1-assets-0",
        "method": "GET",
        "pathTemplate": "/v1/assets",
        "summary": "GET /v1/assets",
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
              "name": "assets",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "dspmApiKey",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "dspmBaseUrl",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "fields",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "files",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-v1-risk-findings-1",
        "method": "GET",
        "pathTemplate": "/v1/risk-findings",
        "summary": "GET /v1/risk-findings",
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
              "name": "assets",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "dspmApiKey",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "dspmBaseUrl",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "fields",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "files",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/DSPM/Integrations/DSPM"
  },
  "elasticsearch-elasticsearch-v2": {
    "summary": "Rebuilt from the client: POST /{index}/_search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /{index}/_search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-search",
    "operations": [
      {
        "id": "post-index-search-0",
        "method": "POST",
        "pathTemplate": "/{index}/_search",
        "summary": "POST /{index}/_search",
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
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "hits",
              "kind": "object",
              "children": [
                {
                  "name": "events",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "hits",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "max_score",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "total",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Tags",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_id",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Elasticsearch/Integrations/Elasticsearch_v2"
  },
  "elasticsearch-elasticsearcheventcollector": {
    "summary": "Rebuilt from the client: POST /{index}/_search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /{index}/_search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-search",
    "operations": [
      {
        "id": "post-index-search-0",
        "method": "POST",
        "pathTemplate": "/{index}/_search",
        "summary": "POST /{index}/_search",
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
              "name": "hits",
              "kind": "object",
              "children": [
                {
                  "name": "hits",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "total",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_index",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_source",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "access_token_expires_in",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Elasticsearch/Integrations/ElasticsearchEventCollector"
  },
  "gmail-gmail": {
    "summary": "Rebuilt from the client: GET /gmail/v1/users/{userId}/messages.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /gmail/v1/users/{userId}/messages, GET /gmail/v1/users/{userId}/messages/{id}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list",
    "operations": [
      {
        "id": "get-gmail-v1-users-userid-messages-0",
        "method": "GET",
        "pathTemplate": "/gmail/v1/users/{userId}/messages",
        "summary": "GET /gmail/v1/users/{userId}/messages",
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
              "name": "Attachments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Body",
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
            },
            {
              "name": "From",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Html",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-gmail-v1-users-userid-messages-id-1",
        "method": "GET",
        "pathTemplate": "/gmail/v1/users/{userId}/messages/{id}",
        "summary": "GET /gmail/v1/users/{userId}/messages/{id}",
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
              "name": "Attachments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Body",
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
            },
            {
              "name": "From",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Html",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Gmail/Integrations/Gmail"
  },
  "googlechroniclebackstory-googlechroniclebackstory": {
    "summary": "Rebuilt from the client: GET /v1/alert/listalerts.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /v1/alert/listalerts. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://cloud.google.com/chronicle/docs/reference/search-api",
    "operations": [
      {
        "id": "get-v1-alert-listalerts-0",
        "method": "GET",
        "pathTemplate": "/v1/alert/listalerts",
        "summary": "GET /v1/alert/listalerts",
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
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "AlertInfo",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "AlertName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Alerts",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Artifact",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Asset",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/GoogleChronicleBackstory/Integrations/GoogleChronicleBackstory"
  },
  "googlecloudscc-googlecloudscc": {
    "summary": "Rebuilt from the client: GET /v1/organizations/{organization}/sources/{source}/findings.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /v1/organizations/{organization}/sources/{source}/findings. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://cloud.google.com/security-command-center/docs/reference/rest/v1/organizations.sources.findings/list",
    "operations": [
      {
        "id": "get-v1-organizations-organization-sources-so-0",
        "method": "GET",
        "pathTemplate": "/v1/organizations/{organization}/sources/{source}/findings",
        "summary": "GET /v1/organizations/{organization}/sources/{source}/findings",
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
              "name": "ackId",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ancestors",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "assetType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assets",
              "kind": "object",
              "children": [
                {
                  "name": "ancestors",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                },
                {
                  "name": "assetType",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "iamPolicy",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "name",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "resource",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "bindings",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "category",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/GoogleCloudSCC/Integrations/GoogleCloudSCC"
  },
  "greynoise-greynoise": {
    "summary": "Rebuilt from the client: GET /v2/noise/context/{ip}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /v2/noise/context/{ip}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.greynoise.io/reference/get_v2-noise-context-ip",
    "operations": [
      {
        "id": "get-v2-noise-context-ip-0",
        "method": "GET",
        "pathTemplate": "/v2/noise/context/{ip}",
        "summary": "GET /v2/noise/context/{ip}",
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
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "IP",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "activity",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "actor",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "address",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "asn",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/GreyNoise/Integrations/GreyNoise"
  },
  "greynoise-greynoise-community": {
    "summary": "Rebuilt from the client: GET /v3/community/{ip}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /v3/community/{ip}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.greynoise.io/reference/get_v3-community-ip",
    "operations": [
      {
        "id": "get-v3-community-ip-0",
        "method": "GET",
        "pathTemplate": "/v3/community/{ip}",
        "summary": "GET /v3/community/{ip}",
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
              "name": "IP",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "actor",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "address",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "business_service_intelligence",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "category",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "classification",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/GreyNoise/Integrations/GreyNoise_Community"
  },
  "gsuiteauditor-gsuiteauditor": {
    "summary": "Rebuilt from the client: GET /admin/reports/v1/activity/users/{arg}/applications/{arg}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /admin/reports/v1/activity/users/{arg}/applications/{arg}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developers.google.com/admin-sdk/reports/reference/rest/v1/activities/list",
    "operations": [
      {
        "id": "get-admin-reports-v1-activity-users-arg-appl-0",
        "method": "GET",
        "pathTemplate": "/admin/reports/v1/activity/users/{arg}/applications/{arg}",
        "summary": "GET /admin/reports/v1/activity/users/{arg}/applications/{arg}",
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
              "name": "actor",
              "kind": "object",
              "children": [
                {
                  "name": "email",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "profileId",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "events",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "object",
              "children": [
                {
                  "name": "applicationName",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "time",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "ipAddress",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "items",
              "kind": "object",
              "children": [
                {
                  "name": "actor",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "etag",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "events",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                },
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "kind",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "nextPageToken",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/GsuiteAuditor/Integrations/GsuiteAuditor"
  },
  "identityrecordedfuture-identityrecordedfuture": {
    "summary": "Rebuilt from the client: POST /v2/identity/credentials/search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /v2/identity/credentials/search, POST /playbook_alert/search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://support.recordedfuture.com/hc/en-us/articles/115000894468-API-Documentation",
    "operations": [
      {
        "id": "post-v2-identity-credentials-search-0",
        "method": "POST",
        "pathTemplate": "/v2/identity/credentials/search",
        "summary": "POST /v2/identity/credentials/search",
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
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "action_result",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "base64",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "image_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "panel_evidence_summary",
              "kind": "object",
              "children": [
                {
                  "name": "screenshots",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      },
      {
        "id": "post-playbook-alert-search-1",
        "method": "POST",
        "pathTemplate": "/playbook_alert/search",
        "summary": "POST /playbook_alert/search",
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
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "action_result",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "base64",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "image_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "panel_evidence_summary",
              "kind": "object",
              "children": [
                {
                  "name": "screenshots",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/IdentityRecordedFuture/Integrations/IdentityRecordedFuture"
  },
  "infoblox-infoblox": {
    "summary": "Rebuilt from the client: GET /record:host.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /record:host. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.infoblox.com/space/nios85/page/2512664126/Infoblox+REST+API",
    "operations": [
      {
        "id": "get-record-host-0",
        "method": "GET",
        "pathTemplate": "/record:host",
        "summary": "GET /record:host",
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
              "name": "Name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "next_page_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "result",
              "kind": "object",
              "children": [
                {
                  "name": "_ref",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "address",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "aliases",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                },
                {
                  "name": "binding_state",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "canonical",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "text",
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
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Infoblox/Integrations/Infoblox"
  },
  "jira-jirav3": {
    "summary": "Rebuilt from the client: GET /rest/api/{api_version}/search/jql.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /rest/api/{api_version}/search/jql, GET /rest/api/3/project/search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/",
    "operations": [
      {
        "id": "get-rest-api-api-version-search-jql-0",
        "method": "GET",
        "pathTemplate": "/rest/api/{api_version}/search/jql",
        "summary": "GET /rest/api/{api_version}/search/jql",
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
              "name": "Comment",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Components",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Creator",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-rest-api-3-project-search-1",
        "method": "GET",
        "pathTemplate": "/rest/api/3/project/search",
        "summary": "GET /rest/api/3/project/search",
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
              "name": "Comment",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Components",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Creator",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Jira/Integrations/JiraV3"
  },
  "lacework-lacework": {
    "summary": "Rebuilt from the client: GET /api/v2/Alerts.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v2/Alerts. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.lacework.net/api/v2/docs/#tag/Alerts",
    "operations": [
      {
        "id": "get-api-v2-alerts-0",
        "method": "GET",
        "pathTemplate": "/api/v2/Alerts",
        "summary": "GET /api/v2/Alerts",
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
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "account_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alertId",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alertType",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alert_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "end_time",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Lacework/Integrations/Lacework"
  },
  "microsoftcloudappsecurity-microsoftcloudappsecurity": {
    "summary": "Rebuilt from the client: GET /alerts.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /alerts. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/defender-cloud-apps/api-alerts",
    "operations": [
      {
        "id": "get-alerts-0",
        "method": "GET",
        "pathTemplate": "/alerts",
        "summary": "GET /alerts",
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
              "name": "_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "alertsNotFound",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "appName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "client_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "closed_benign",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "closed_false_positive",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftCloudAppSecurity/Integrations/MicrosoftCloudAppSecurity"
  },
  "microsoftdefenderthreatintelligence-microsoftdefenderthreatintelligence": {
    "summary": "Rebuilt from the client: GET /v1.0/security/threatIntelligence/articles.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /v1.0/security/threatIntelligence/articles, GET /v1.0/security/threatIntelligence/articles/{article_id}/indicators. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://learn.microsoft.com/en-us/graph/api/security-threatintelligence-list-articles",
    "operations": [
      {
        "id": "get-v1-0-security-threatintelligence-article-0",
        "method": "GET",
        "pathTemplate": "/v1.0/security/threatIntelligence/articles",
        "summary": "GET /v1.0/security/threatIntelligence/articles",
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
              "name": "artifact",
              "kind": "object",
              "children": [
                {
                  "name": "@odata",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "classification",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "creds_certificate",
              "kind": "object",
              "children": [
                {
                  "name": "identifier",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "domainStatus",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "registrant",
              "kind": "object",
              "children": [
                {
                  "name": "address",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "email",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "fax",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "name",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "organization",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      },
      {
        "id": "get-v1-0-security-threatintelligence-article-1",
        "method": "GET",
        "pathTemplate": "/v1.0/security/threatIntelligence/articles/{article_id}/indicators",
        "summary": "GET /v1.0/security/threatIntelligence/articles/{article_id}/indicators",
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
              "name": "artifact",
              "kind": "object",
              "children": [
                {
                  "name": "@odata",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "id",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "classification",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "creds_certificate",
              "kind": "object",
              "children": [
                {
                  "name": "identifier",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "domainStatus",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "registrant",
              "kind": "object",
              "children": [
                {
                  "name": "address",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "email",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "fax",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "name",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "organization",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/MicrosoftDefenderThreatIntelligence/Integrations/MicrosoftDefenderThreatIntelligence"
  },
  "mimecast-mimecasteventcollectorv2": {
    "summary": "Rebuilt from the client: GET /siem/v1/events/cg.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /siem/v1/events/cg. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://integrations.mimecast.com/documentation/endpoint-reference/logs-and-statistics/get-siem-logs/",
    "operations": [
      {
        "id": "get-siem-v1-events-cg-0",
        "method": "GET",
        "pathTemplate": "/siem/v1/events/cg",
        "summary": "GET /siem/v1/events/cg",
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
              "name": "data",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "@nextPage",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "http",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "message",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "meta",
              "kind": "object",
              "children": [
                {
                  "name": "pagination",
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
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Mimecast/Integrations/MimecastEventCollectorV2"
  },
  "mimecast-mimecastv2": {
    "summary": "SIEM logs as a zip plus an mc-siem-token header.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /api/audit/get-siem-logs. The collector writes that body as a zip and pages with the mc-siem-token header."
    ],
    "docUrl": "https://integrations.mimecast.com/documentation/endpoint-reference/logs-and-statistics/get-siem-logs/",
    "operations": [
      {
        "id": "post-api-audit-get-siem-logs-0",
        "method": "POST",
        "pathTemplate": "/api/audit/get-siem-logs",
        "summary": "POST /api/audit/get-siem-logs",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": true,
        "envelope": {
          "type": "array"
        },
        "pagination": {
          "style": "header",
          "limitParam": "limit",
          "offsetParam": "offset",
          "pageParam": "page",
          "cursorParam": "token",
          "defaultLimit": 20,
          "maxLimit": 500,
          "headerName": "mc-siem-token"
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
              "name": "after",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "eventTime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            }
          ]
        },
        "pack": {
          "format": "zip",
          "filename": "siem.zip",
          "entryName": "mta.json",
          "entryFormat": "wrapped-json",
          "wrapperType": "MTA"
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Mimecast/Integrations/MimecastEventCollector"
  },
  "netskope-netskopeeventcollector": {
    "summary": "Rebuilt from the client: GET /api/v2/events/dataexport/events/{_type}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v2/events/dataexport/events/{_type}, GET /api/v2/events/dataexport/{endpoint}/{_type}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.netskope.com/en/rest-api-v2-overview-312207/",
    "operations": [
      {
        "id": "get-api-v2-events-dataexport-events-type-0",
        "method": "GET",
        "pathTemplate": "/api/v2/events/dataexport/events/{_type}",
        "summary": "GET /api/v2/events/dataexport/events/{_type}",
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
              "name": "_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "context",
              "kind": "object",
              "children": [
                {
                  "name": "IntegrationInstance",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "operation",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "result",
              "kind": "object",
              "children": [
                {
                  "name": "_id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "_insertion_epoch_timestamp",
                  "kind": "integer"
                },
                {
                  "name": "access_method",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "appcategory",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "bypass_reason",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "timestamp",
              "kind": "integer"
            }
          ]
        }
      },
      {
        "id": "get-api-v2-events-dataexport-endpoint-type-1",
        "method": "GET",
        "pathTemplate": "/api/v2/events/dataexport/{endpoint}/{_type}",
        "summary": "GET /api/v2/events/dataexport/{endpoint}/{_type}",
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
              "name": "_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "context",
              "kind": "object",
              "children": [
                {
                  "name": "IntegrationInstance",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "operation",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "result",
              "kind": "object",
              "children": [
                {
                  "name": "_id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "_insertion_epoch_timestamp",
                  "kind": "integer"
                },
                {
                  "name": "access_method",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "appcategory",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "bypass_reason",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "timestamp",
              "kind": "integer"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Netskope/Integrations/NetskopeEventCollector"
  },
  "nozominetworks-nozominetworks": {
    "summary": "Rebuilt from the client: GET /api/open/query/do.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/open/query/do. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/NozomiNetworks/Integrations/NozomiNetworks",
    "operations": [
      {
        "id": "get-api-open-query-do-0",
        "method": "GET",
        "pathTemplate": "/api/open/query/do",
        "summary": "GET /api/open/query/do",
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
              "name": "customAlertFilter",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "defaultIncidentRole",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "endpoint",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "error",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "fecthAlsoIncidents",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/NozomiNetworks/Integrations/NozomiNetworks"
  },
  "paloaltonetworks-securityadvisories-paloaltonetworkssecurityadvisories": {
    "summary": "Rebuilt from the client: GET /api/v1/products/{product}/advisories.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/v1/products/{product}/advisories, GET /api/v1/products. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://security.paloaltonetworks.com/",
    "operations": [
      {
        "id": "get-api-v1-products-product-advisories-0",
        "method": "GET",
        "pathTemplate": "/api/v1/products/{product}/advisories",
        "summary": "GET /api/v1/products/{product}/advisories",
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
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "containers",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "cveMetadata",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "dataType",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "dataVersion",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "baseScore",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "baseSeverity",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "containers",
              "kind": "object",
              "children": [
                {
                  "name": "cna",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "cveMetadata",
              "kind": "object",
              "children": [
                {
                  "name": "cveId",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      },
      {
        "id": "get-api-v1-products-1",
        "method": "GET",
        "pathTemplate": "/api/v1/products",
        "summary": "GET /api/v1/products",
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
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "containers",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "cveMetadata",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "dataType",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "dataVersion",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "value",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "baseScore",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "baseSeverity",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "containers",
              "kind": "object",
              "children": [
                {
                  "name": "cna",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "cveMetadata",
              "kind": "object",
              "children": [
                {
                  "name": "cveId",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_SecurityAdvisories/Integrations/PaloAltoNetworksSecurityAdvisories"
  },
  "paloaltonetworks-threat-vault-threatvaultv2": {
    "summary": "Rebuilt from the client: GET /threats.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /threats. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://pan.dev/threat-vault/api/threat-vault-apis/",
    "operations": [
      {
        "id": "get-threats-0",
        "method": "GET",
        "pathTemplate": "/threats",
        "summary": "GET /threats",
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
              "name": "asn",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "cve",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "data",
              "kind": "object",
              "children": [
                {
                  "name": "fileinfo",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "reports",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "vulnerability",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "geo",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "id",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/PaloAltoNetworks_Threat_Vault/Integrations/ThreatVaultv2"
  },
  "rapid7-nexpose-rapid7-nexpose": {
    "summary": "Rebuilt from the client: GET /api/3/assets.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/3/assets, GET /api/3/tags/{tag_id_int}/assets. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://help.rapid7.com/insightvm/en-us/api/index.html",
    "operations": [
      {
        "id": "get-api-3-assets-0",
        "method": "GET",
        "pathTemplate": "/api/3/assets",
        "summary": "GET /api/3/assets",
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
              "name": "Addresses",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "Aliases",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "AssetId",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Estimate",
              "kind": "string",
              "example": "lab"
            },
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
      },
      {
        "id": "get-api-3-tags-tag-id-int-assets-1",
        "method": "GET",
        "pathTemplate": "/api/3/tags/{tag_id_int}/assets",
        "summary": "GET /api/3/tags/{tag_id_int}/assets",
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
              "name": "Addresses",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "Aliases",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "AssetId",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Estimate",
              "kind": "string",
              "example": "lab"
            },
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
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Rapid7_Nexpose/Integrations/Rapid7_Nexpose"
  },
  "rapid7appsec-rapid7appsec": {
    "summary": "Rebuilt from the client: GET /ias/v1/scans/{obj_id}/engine-events.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /ias/v1/scans/{obj_id}/engine-events, GET /ias/v1/scans/{obj_id}/platform-events. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://help.rapid7.com/insightappsec/en-us/api/v1/docs.html",
    "operations": [
      {
        "id": "get-ias-v1-scans-obj-id-engine-events-0",
        "method": "GET",
        "pathTemplate": "/ias/v1/scans/{obj_id}/engine-events",
        "summary": "GET /ias/v1/scans/{obj_id}/engine-events",
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
              "name": "status",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-ias-v1-scans-obj-id-platform-events-1",
        "method": "GET",
        "pathTemplate": "/ias/v1/scans/{obj_id}/platform-events",
        "summary": "GET /ias/v1/scans/{obj_id}/platform-events",
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
              "name": "status",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Rapid7AppSec/Integrations/Rapid7AppSec"
  },
  "recordedfuture-recordedfuturelists": {
    "summary": "Rebuilt from the client: POST /v2/lists/search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /v2/lists/search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://support.recordedfuture.com/hc/en-us/articles/115000894468-API-Documentation",
    "operations": [
      {
        "id": "post-v2-lists-search-0",
        "method": "POST",
        "pathTemplate": "/v2/lists/search",
        "summary": "POST /v2/lists/search",
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
              "name": "result",
              "kind": "object",
              "children": [
                {
                  "name": "message",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "result_actions",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "server_url",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "version",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/RecordedFuture/Integrations/RecordedFutureLists"
  },
  "recordedfuture-recordedfutureplaybookalerts": {
    "summary": "Rebuilt from the client: POST /v2/playbook_alert/search.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /v2/playbook_alert/search. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://support.recordedfuture.com/hc/en-us/articles/115000894468-API-Documentation",
    "operations": [
      {
        "id": "post-v2-playbook-alert-search-0",
        "method": "POST",
        "pathTemplate": "/v2/playbook_alert/search",
        "summary": "POST /v2/playbook_alert/search",
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
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "base64",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "description",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "image_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "panel_evidence_summary",
              "kind": "object",
              "children": [
                {
                  "name": "screenshots",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "rawJSON",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/RecordedFuture/Integrations/RecordedFuturePlaybookAlerts"
  },
  "servicenow-servicenowv2": {
    "summary": "Rebuilt from the client: GET /table/{table_name}.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /table/{table_name}, GET /table/{ticket_type}. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html",
    "operations": [
      {
        "id": "get-table-table-name-0",
        "method": "GET",
        "pathTemplate": "/table/{table_name}",
        "summary": "GET /table/{table_name}",
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
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Variables",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "active",
              "kind": "object",
              "children": [
                {
                  "name": "value",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "approval",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "approval_history",
              "kind": "object",
              "children": [
                {
                  "name": "value",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "asset_tag",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-table-ticket-type-1",
        "method": "GET",
        "pathTemplate": "/table/{ticket_type}",
        "summary": "GET /table/{ticket_type}",
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
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Variables",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "active",
              "kind": "object",
              "children": [
                {
                  "name": "value",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "approval",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "approval_history",
              "kind": "object",
              "children": [
                {
                  "name": "value",
                  "kind": "string",
                  "example": "lab"
                }
              ]
            },
            {
              "name": "asset_tag",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/ServiceNow/Integrations/ServiceNowv2"
  },
  "slack-slackv3": {
    "summary": "Rebuilt from the client: GET /api/conversations.history.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/conversations.history. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://docs.slack.dev/reference/methods/conversations.history",
    "operations": [
      {
        "id": "get-api-conversations-history-0",
        "method": "GET",
        "pathTemplate": "/api/conversations.history",
        "summary": "GET /api/conversations.history",
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
              "name": "actions",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "app_token",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "auto_close",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "blocks",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "bot_id",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "bot_token",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Slack/Integrations/SlackV3"
  },
  "splunkpy-splunkpy": {
    "summary": "Rebuilt from the client: POST /services/search/jobs.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /services/search/jobs. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-tutorials/10.2/rest-api-tutorials/creating-searches-using-the-rest-api",
    "operations": [
      {
        "id": "post-services-search-jobs-0",
        "method": "POST",
        "pathTemplate": "/services/search/jobs",
        "summary": "POST /services/search/jobs",
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
              "name": "DBotScore",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Status",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_indextime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_raw",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_time",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ackId",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/SplunkPy/Integrations/SplunkPy"
  },
  "splunkpy-splunkpyv2": {
    "summary": "Rebuilt from the client: GET /services/search/jobs/{sid}/results.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /services/search/jobs/{sid}/results, POST /services/search/jobs. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-tutorials/10.2/rest-api-tutorials/creating-searches-using-the-rest-api",
    "operations": [
      {
        "id": "get-services-search-jobs-sid-results-0",
        "method": "GET",
        "pathTemplate": "/services/search/jobs/{sid}/results",
        "summary": "GET /services/search/jobs/{sid}/results",
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
              "name": "DBotScore",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Status",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_indextime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_raw",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_time",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ackId",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-services-search-jobs-1",
        "method": "POST",
        "pathTemplate": "/services/search/jobs",
        "summary": "POST /services/search/jobs",
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
              "name": "DBotScore",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Status",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_indextime",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_raw",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "_time",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ackId",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/SplunkPy/Integrations/SplunkPyV2"
  },
  "tenable-io-tenable-io": {
    "summary": "Rebuilt from the client: POST /vulns/export.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /vulns/export, POST /assets/export. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.tenable.com/reference/workbenches-assets",
    "operations": [
      {
        "id": "post-vulns-export-0",
        "method": "POST",
        "pathTemplate": "/vulns/export",
        "summary": "POST /vulns/export",
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
              "name": "Status",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "asset",
              "kind": "object",
              "children": [
                {
                  "name": "fqdn",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "hostname",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "ipv4",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "network_id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "operating_system",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                }
              ]
            },
            {
              "name": "assets",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assets_404_retry_count",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assets_available_chunks",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assets_export_uuid",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "post-assets-export-1",
        "method": "POST",
        "pathTemplate": "/assets/export",
        "summary": "POST /assets/export",
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
              "name": "Status",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "asset",
              "kind": "object",
              "children": [
                {
                  "name": "fqdn",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "hostname",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "ipv4",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "network_id",
                  "kind": "string",
                  "example": "lab"
                },
                {
                  "name": "operating_system",
                  "kind": "array",
                  "item": {
                    "name": "item",
                    "kind": "string",
                    "example": "lab"
                  }
                }
              ]
            },
            {
              "name": "assets",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assets_404_retry_count",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assets_available_chunks",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "assets_export_uuid",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Tenable_io/Integrations/Tenable_io"
  },
  "urlhaus-urlhaus": {
    "summary": "Rebuilt from the client: POST /url.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /url. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://urlhaus-api.abuse.ch/",
    "operations": [
      {
        "id": "post-url-0",
        "method": "POST",
        "pathTemplate": "/url",
        "summary": "POST /url",
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
              "name": "DownloadLink",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "MD5",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Signature",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Status",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Tags",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/URLHaus/Integrations/URLHaus"
  },
  "varonisdatasecurityplatform-varonisdatasecurityplatform": {
    "summary": "Rebuilt from the client: GET /api/alert/alert/GetAlerts.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /api/alert/alert/GetAlerts, GET /api/alert/alert/GetAlertedEvents. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://github.com/demisto/content/tree/master/Packs/VaronisDataSecurityPlatform",
    "operations": [
      {
        "id": "get-api-alert-alert-getalerts-0",
        "method": "GET",
        "pathTemplate": "/api/alert/alert/GetAlerts",
        "summary": "GET /api/alert/alert/GetAlerts",
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
              "name": "AlertSeqId",
              "kind": "integer"
            },
            {
              "name": "EventUTC",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Id",
              "kind": "integer"
            },
            {
              "name": "Name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ResultSet",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      },
      {
        "id": "get-api-alert-alert-getalertedevents-1",
        "method": "GET",
        "pathTemplate": "/api/alert/alert/GetAlertedEvents",
        "summary": "GET /api/alert/alert/GetAlertedEvents",
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
              "name": "AlertSeqId",
              "kind": "integer"
            },
            {
              "name": "EventUTC",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "Id",
              "kind": "integer"
            },
            {
              "name": "Name",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "ResultSet",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/VaronisDataSecurityPlatform/Integrations/VaronisDataSecurityPlatform"
  },
  "zendesk-zendeskv2": {
    "summary": "Rebuilt from the client: POST /api/v2/tickets.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched POST /api/v2/tickets. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#list-tickets",
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
              "name": "FileID",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "after_cursor",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "article",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "attachment",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "attachments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "body",
              "kind": "string",
              "example": "lab"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Zendesk/Integrations/Zendeskv2"
  },
  "zscaler-zscalerzidentity": {
    "summary": "Rebuilt from the client: GET /security/advanced.",
    "differences": [
      "Rebuilt from the XSOAR client. The checker matched GET /security/advanced, GET /users. Fields are keys the client reads or test_data contains."
    ],
    "docUrl": "https://help.zscaler.com/zia/getting-started-zia-api",
    "operations": [
      {
        "id": "get-security-advanced-0",
        "method": "GET",
        "pathTemplate": "/security/advanced",
        "summary": "GET /security/advanced",
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
              "name": "addresses",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "blacklistUrls",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "comments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "configuredName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "countries",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "customCategory",
              "kind": "boolean"
            }
          ]
        }
      },
      {
        "id": "get-users-1",
        "method": "GET",
        "pathTemplate": "/users",
        "summary": "GET /users",
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": true,
        "envelope": {
          "type": "object"
        },
        "pagination": {
          "style": "page",
          "limitParam": "pageSize",
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
              "name": "addresses",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "blacklistUrls",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "comments",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "configuredName",
              "kind": "string",
              "example": "lab"
            },
            {
              "name": "countries",
              "kind": "array",
              "item": {
                "name": "item",
                "kind": "string",
                "example": "lab"
              }
            },
            {
              "name": "customCategory",
              "kind": "boolean"
            }
          ]
        }
      }
    ],
    "sourceUrl": "https://github.com/demisto/content/tree/master/Packs/Zscaler/Integrations/ZscalerZIdentity"
  }
};
