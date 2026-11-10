import { describe, expect, it } from "vitest";
import { formParams } from "./aws-query";
import { generateMockResponse, matchOperation } from "./generate";
import { verifiedPresets } from "./verified-presets";
import { localName, parseXml, type XmlElement } from "./xml";

const ec2 = verifiedPresets.find((preset) => preset.id === "aws-ec2-aws-ec2");
const iam = verifiedPresets.find((preset) => preset.id === "aws-iam-aws-iam");

function text(element: XmlElement | undefined): string {
  return element?.text || "";
}

function child(element: XmlElement | undefined, name: string): XmlElement | undefined {
  return element?.children.find((item) => localName(item.name) === name);
}

function children(element: XmlElement | undefined, name: string): XmlElement[] {
  return element?.children.filter((item) => localName(item.name) === name) || [];
}

describe("AWS query protocol", () => {
  it("parses Action form bodies and ignores JSON", () => {
    expect(formParams("Action=DescribeInstances&Version=2016-11-15&MaxResults=2")).toEqual({
      Action: "DescribeInstances",
      Version: "2016-11-15",
      MaxResults: "2",
    });
    expect(formParams("NextToken=pp_a%2Bb")).toEqual({ NextToken: "pp_a+b" });
    expect(formParams('{"Action":"DescribeInstances"}')).toEqual({});
    expect(formParams("<Action>DescribeInstances</Action>")).toEqual({});
  });

  it("returns DescribeInstances XML that follows the EC2 query parser", () => {
    if (!ec2) throw new Error("missing EC2 preset");
    const spec = ec2.spec;
    expect(
      matchOperation(spec, "POST", "/", {}, {
        body: "Action=DescribeInstances&Version=2016-11-15",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      })?.operation.id,
    ).toBe("describe-instances");
    expect(matchOperation(spec, "POST", "/", { Action: "DescribeInstances" })?.operation.id).toBe("describe-instances");
    expect(matchOperation(spec, "POST", "/", {}, { body: "Action=DescribeVolumes" })).toBeNull();
    expect(
      matchOperation(spec, "POST", "/", {}, { headers: { "x-amz-target": "AmazonEC2.DescribeInstances" } }),
    ).toBeNull();

    const operation = spec.operations[0];
    const first = generateMockResponse({
      spec,
      operation,
      pathParams: {},
      query: {},
      body: "Action=DescribeInstances&Version=2016-11-15&MaxResults=2",
      requestIndex: 1,
    });
    expect(first.headers["content-type"]).toContain("xml");
    const root = parseXml(first.body);
    expect(localName(root.name)).toBe("DescribeInstancesResponse");
    expect(root.namespace).toBe("http://ec2.amazonaws.com/doc/2016-11-15/");
    expect(text(child(root, "requestId"))).toMatch(/^[0-9a-f-]{36}$/);
    const reservations = children(child(root, "reservationSet"), "item");
    expect(reservations).toHaveLength(2);
    const instance = child(child(reservations[0], "instancesSet"), "item");
    expect(text(child(instance, "instanceId"))).toMatch(/^instanceId_/);
    expect(text(child(instance, "instanceType"))).toBe("t3.micro");
    expect(text(child(child(instance, "instanceState"), "code"))).toBe("16");
    expect(text(child(child(instance, "instanceState"), "name"))).toBe("running");
    expect(text(child(child(instance, "placement"), "availabilityZone"))).toBe("us-east-1a");
    const token = text(child(root, "nextToken"));
    expect(token).toMatch(/^pp_/);

    const seen = new Set<string>();
    let next: string | null = null;
    let pages = 0;
    while (pages < 30) {
      const body = next
        ? `Action=DescribeInstances&MaxResults=2&NextToken=${encodeURIComponent(next)}`
        : "Action=DescribeInstances&MaxResults=2";
      const page = generateMockResponse({
        spec,
        operation,
        pathParams: {},
        query: {},
        body,
        requestIndex: pages + 1,
      });
      const parsed = parseXml(page.body);
      for (const reservation of children(child(parsed, "reservationSet"), "item")) {
        const instance = child(child(reservation, "instancesSet"), "item");
        seen.add(text(child(instance, "instanceId")));
      }
      const step = text(child(parsed, "nextToken"));
      pages += 1;
      if (!step) break;
      next = step;
    }
    expect(seen.size).toBe(spec.totalRecords);
    expect(pages).toBe(Math.ceil(spec.totalRecords / 2));
  });

  it("returns ListUsers XML with Marker paging", () => {
    if (!iam) throw new Error("missing IAM preset");
    const spec = iam.spec;
    const operation = spec.operations[0];
    expect(matchOperation(spec, "POST", "/", {}, { body: "Action=ListUsers&Version=2010-05-08" })?.operation.id).toBe(
      "list-users",
    );
    expect(matchOperation(spec, "POST", "/", {}, { body: "Action=ListRoles" })).toBeNull();

    const first = generateMockResponse({
      spec,
      operation,
      pathParams: {},
      query: {},
      body: "Action=ListUsers&MaxItems=2",
      requestIndex: 3,
    });
    const root = parseXml(first.body);
    expect(localName(root.name)).toBe("ListUsersResponse");
    expect(root.namespace).toBe("https://iam.amazonaws.com/doc/2010-05-08/");
    const result = child(root, "ListUsersResult");
    expect(text(child(result, "IsTruncated"))).toBe("true");
    const marker = text(child(result, "Marker"));
    expect(marker).toMatch(/^pp_/);
    const users = children(child(result, "Users"), "member");
    expect(users).toHaveLength(2);
    expect(text(child(users[0], "Path"))).toBe("/");
    expect(text(child(users[0], "UserName"))).toBe("jsmith");
    expect(text(child(users[0], "Arn"))).toBe("arn:aws:iam::123456789012:user/jsmith");
    expect(text(child(users[0], "UserId"))).not.toBe(text(child(users[1], "UserId")));
    expect(text(child(child(root, "ResponseMetadata"), "RequestId"))).toMatch(/^[0-9a-f-]{36}$/);

    const second = generateMockResponse({
      spec,
      operation,
      pathParams: {},
      query: {},
      body: `Action=ListUsers&MaxItems=2&Marker=${encodeURIComponent(marker)}`,
      requestIndex: 4,
    });
    const next = parseXml(second.body);
    const nextUsers = children(child(child(next, "ListUsersResult"), "Users"), "member");
    expect(text(child(nextUsers[0], "UserId"))).not.toBe(text(child(users[0], "UserId")));

    let token: string | null = null;
    let truncated = "true";
    let pages = 0;
    const ids = new Set<string>();
    while (truncated === "true" && pages < 30) {
      const body = token
        ? `Action=ListUsers&MaxItems=2&Marker=${encodeURIComponent(token)}`
        : "Action=ListUsers&MaxItems=2";
      const page = parseXml(
        generateMockResponse({ spec, operation, pathParams: {}, query: {}, body, requestIndex: pages + 1 }).body,
      );
      const pageResult = child(page, "ListUsersResult");
      for (const user of children(child(pageResult, "Users"), "member")) ids.add(text(child(user, "UserId")));
      truncated = text(child(pageResult, "IsTruncated"));
      token = text(child(pageResult, "Marker"));
      pages += 1;
      if (truncated === "false") expect(token).toBe("");
    }
    expect(ids.size).toBe(spec.totalRecords);
    expect(truncated).toBe("false");
  });
});
