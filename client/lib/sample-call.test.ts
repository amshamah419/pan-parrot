import { describe, expect, it } from "vitest";
import { verifiedPresets } from "@shared/verified-presets";
import { sampleRequest } from "./sample-call";

describe("sample call", () => {
  it("posts EC2 Action as a form body and keeps GET calls as GET", () => {
    const ec2 = verifiedPresets.find((preset) => preset.id === "aws-ec2-aws-ec2");
    if (!ec2) throw new Error("missing EC2 preset");
    const posted = sampleRequest(ec2.spec.operations[0], { mode: "none" });
    expect(posted.method).toBe("POST");
    expect(posted.headers["content-type"]).toContain("form-urlencoded");
    expect(posted.body).toBe("Action=DescribeInstances&MaxResults=2");

    const iam = verifiedPresets.find((preset) => preset.id === "aws-iam-aws-iam");
    if (!iam) throw new Error("missing IAM preset");
    expect(sampleRequest(iam.spec.operations[0], { mode: "none" }).body).toBe("Action=ListUsers&MaxItems=2");

    const cloudtrail = verifiedPresets.find((preset) => preset.id === "aws-cloudtrail-aws-cloudtrail");
    if (!cloudtrail) throw new Error("missing CloudTrail preset");
    const jsonProtocol = sampleRequest(cloudtrail.spec.operations[0], { mode: "none" });
    expect(jsonProtocol.method).toBe("POST");
    expect(jsonProtocol.body).toBeUndefined();
    expect(jsonProtocol.headers["x-amz-target"]).toBe("CloudTrail_20131101.LookupEvents");
  });
});
