import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commandCoverageLabel, validateMockSpec } from "./mock-spec";

describe("AWS command coverage", () => {
  it("states vendor, approximate, and missing counts", () => {
    expect(commandCoverageLabel({ total: 66, vendor: 63, approximate: 0, missing: 3 })).toBe(
      "63 of 66 commands from vendor docs, 0 approximate, 3 missing",
    );
  });

  it("keeps the catalog counts and the IAM vendor examples", () => {
    const index = JSON.parse(readFileSync("public/presets/index.json", "utf8")) as {
      presets: Array<{ id: string; commandCoverage?: { total: number; vendor: number; approximate: number; missing: number } }>;
    };
    const covered = index.presets.filter((preset) => preset.commandCoverage);
    expect(covered.length).toBeGreaterThan(0);
    const sums = (rows: typeof covered) => {
      let vendor = 0;
      let approximate = 0;
      let missing = 0;
      for (const preset of rows) {
        const row = preset.commandCoverage!;
        expect(row.vendor + row.approximate + row.missing).toBe(row.total);
        vendor += row.vendor;
        approximate += row.approximate;
        missing += row.missing;
      }
      return { vendor, approximate, missing };
    };
    const aws = sums(covered.filter((preset) => preset.id.startsWith("aws-") || preset.id === "feedaws-feedaws"));
    expect(aws).toEqual({ vendor: 419, approximate: 34, missing: 219 });
    const graph = sums(covered.filter((preset) => preset.id.startsWith("microsoftgraph")));
    expect(graph).toEqual({ vendor: 98, approximate: 5, missing: 187 });
    const defender = sums(
      covered.filter(
        (preset) =>
          preset.id === "microsoftdefenderadvancedthreatprotection-microsoftdefenderadvancedthreatprotect" ||
          preset.id === "azuresentinel-azuresentinel",
      ),
    );
    expect(defender).toEqual({ vendor: 38, approximate: 0, missing: 79 });
    const falcon = sums(
      covered.filter((preset) =>
        [
          "crowdstrikefalcon-crowdstrikefalcon",
          "crowdstrikefalconx-crowdstrikefalconx",
          "crowdstrikeintel-crowdstrikefalconintel-v2",
        ].includes(preset.id),
      ),
    );
    expect(falcon).toEqual({ vendor: 0, approximate: 14, missing: 102 });
    const xdr = sums(covered.filter((preset) => preset.id.startsWith("cortexxdr-")));
    expect(xdr).toEqual({ vendor: 35, approximate: 13, missing: 84 });
    const okta = sums(
      covered.filter(
        (preset) => preset.id.startsWith("okta-") || preset.id.startsWith("oktastandardconnector-"),
      ),
    );
    expect(okta).toEqual({ vendor: 61, approximate: 26, missing: 8 });
    const servicenow = sums(covered.filter((preset) => preset.id.startsWith("servicenow-")));
    expect(servicenow).toEqual({ vendor: 44, approximate: 0, missing: 10 });
    const jira = sums(covered.filter((preset) => preset.id.startsWith("jira-")));
    expect(jira).toEqual({ vendor: 31, approximate: 5, missing: 14 });
    const assets = sums(
      covered.filter((preset) => preset.id.startsWith("atlassianjiraservicemanagement-")),
    );
    expect(assets).toEqual({ vendor: 7, approximate: 0, missing: 8 });
    const gsuite = sums(covered.filter((preset) => preset.id.startsWith("gsuite")));
    expect(gsuite).toEqual({ vendor: 1, approximate: 2, missing: 31 });
    const splunk = sums(covered.filter((preset) => preset.id.startsWith("splunkpy-")));
    expect(splunk).toEqual({ vendor: 2, approximate: 6, missing: 50 });
    const qradar = sums(covered.filter((preset) => preset.id === "qradar-qradar-v3"));
    expect(qradar).toEqual({ vendor: 0, approximate: 3, missing: 68 });
    const proofpoint = sums(covered.filter((preset) => preset.id.startsWith("proofpoint")));
    expect(proofpoint).toEqual({ vendor: 0, approximate: 8, missing: 41 });
    const mimecast = sums(covered.filter((preset) => preset.id.startsWith("mimecast-")));
    expect(mimecast).toEqual({ vendor: 0, approximate: 1, missing: 47 });
    const sentinelone = sums(covered.filter((preset) => preset.id.startsWith("sentinelone-")));
    expect(sentinelone).toEqual({ vendor: 0, approximate: 3, missing: 80 });
    const zscaler = sums(covered.filter((preset) => preset.id.startsWith("zscaler-")));
    expect(zscaler).toEqual({ vendor: 0, approximate: 6, missing: 45 });
    const panos = sums(covered.filter((preset) => preset.id === "pan-os-panorama"));
    expect(panos).toEqual({ vendor: 2, approximate: 223, missing: 64 });
    const panosSpec = JSON.parse(readFileSync("public/presets/integrations/pan-os-panorama.json", "utf8")) as {
      spec: Parameters<typeof validateMockSpec>[0];
    };
    const showDevice = validateMockSpec(panosSpec.spec).source.commandDocs?.find(
      (row) => row.command === "pan-os-show-device-version",
    );
    expect(showDevice).toMatchObject({ status: "vendor", calls: ["GET /api?type=op&cmd=<show><system><info/></system></show>"] });
    const showInfo = validateMockSpec(panosSpec.spec).operations.find((item) => item.id === "show-system-info-closed");
    expect(showInfo?.fixture).toContain("<hostname>firewall</hostname>");
    const prisma = sums(covered.filter((preset) => preset.id.startsWith("prismacloud")));
    expect(prisma).toEqual({ vendor: 0, approximate: 4, missing: 81 });
    const virustotal = sums(covered.filter((preset) => preset.id.startsWith("virustotal-")));
    expect(virustotal).toEqual({ vendor: 0, approximate: 4, missing: 43 });
    const cisco = sums(
      covered.filter((preset) =>
        [
          "amp-ampv2",
          "ciscofirepower-ciscofirepower",
          "cisco-ise-cisco-ise",
          "cisco-umbrella-cisco-umbrella-investigate",
          "cisco-umbrella-enforcement-ciscoumbrellaenforcement",
          "ciscoumbrellareporting-ciscoumbrellareporting",
          "ciscoasa-ciscoasa",
          "ciscostealthwatch-ciscostealthwatch",
          "ciscosma-ciscosma",
          "ciscoemailsecurity-ciscoemailsecurity",
        ].includes(preset.id),
      ),
    );
    expect(cisco).toEqual({ vendor: 0, approximate: 22, missing: 179 });
    const amp = JSON.parse(readFileSync("public/presets/integrations/amp-ampv2.json", "utf8")) as {
      spec: Parameters<typeof validateMockSpec>[0];
    };
    const events = validateMockSpec(amp.spec).source.commandDocs?.find((row) => row.command === "cisco-amp-event-list");
    expect(events).toMatchObject({ status: "approximate", calls: ["GET /events"] });
    const azure = sums(
      covered.filter((preset) =>
        [
          "azure-azure",
          "azurecompute-azurecompute-v2",
          "azuredataexplorer-azuredataexplorer",
          "azurefirewall-azurefirewall",
          "azurekeyvault-azurekeyvault",
          "azurekubernetesservices-azurekubernetesservices",
          "azureloganalytics-azureloganalytics",
          "azurenetworksecuritygroups-azurenetworksecuritygroups",
          "azureresourcegraph-azureresourcegraph",
          "azureriskyusers-azureriskyusers",
          "azuresecuritycenter-azuresecuritycenter-v2",
          "azuresecuritycenter-microsoftdefenderforcloudeventcollector",
          "azuresqlmanagement-azuresqlmanagement",
          "azurestorage-azurestorage",
          "azurestoragequeue-azurestoragequeue",
          "azurestoragetable-azurestoragetable",
          "azurewaf-azurewaf",
        ].includes(preset.id),
      ),
    );
    expect(azure).toEqual({ vendor: 169, approximate: 21, missing: 225 });
    const logs = JSON.parse(readFileSync("public/presets/integrations/azureloganalytics-azureloganalytics.json", "utf8")) as {
      spec: Parameters<typeof validateMockSpec>[0];
    };
    const query = validateMockSpec(logs.spec).source.commandDocs?.find(
      (row) => row.command === "azure-log-analytics-execute-query",
    );
    expect(query).toMatchObject({ status: "vendor", calls: ["POST /v1/workspaces/{workspace_id}/query"] });
    const queryOp = validateMockSpec(logs.spec).operations.find(
      (item) => item.method === "POST" && item.pathTemplate === "/v1/workspaces/{workspace_id}/query",
    );
    expect(queryOp?.fixture).toContain("PrimaryResult");

    const iam = JSON.parse(readFileSync("public/presets/integrations/aws-iam-aws-iam.json", "utf8")) as {
      spec: Parameters<typeof validateMockSpec>[0];
    };
    const spec = validateMockSpec(iam.spec);
    const users = spec.source.commandDocs?.find((row) => row.command === "aws-iam-list-users");
    expect(users).toMatchObject({ status: "vendor", calls: ["iam:ListUsers"] });
    const operation = spec.operations.find((item) => item.awsAction === "ListUsers");
    expect(operation?.fixture).toContain("ListUsersResponse");
    expect(operation?.queryMatch).toEqual({ Action: "ListUsers" });
  });

  it("counts Microsoft Graph commands from the published response examples", () => {
    const groups = JSON.parse(
      readFileSync("public/presets/integrations/microsoftgraphgroups-microsoftgraphgroups.json", "utf8"),
    ) as { spec: Parameters<typeof validateMockSpec>[0] };
    const spec = validateMockSpec(groups.spec);
    const list = spec.source.commandDocs?.find((row) => row.command === "msgraph-groups-list-groups");
    expect(list).toMatchObject({ status: "vendor" });
    const operation = spec.operations.find((item) => item.method === "GET" && item.pathTemplate === "/groups");
    expect(operation?.fixture).toContain("Golf Assist");
  });
});
