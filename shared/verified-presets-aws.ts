import { defaultChaos, defaultPagination, type FieldSpec, type MockAuth, type MockOperation, type MockSpec } from "./mock-spec";

const checkedAt = "2026-11-10";

export const AWS_DUMMY = {
  accessKeyId: "AKIA_DUMMY",
  sessionAccessKeyId: "ASIADUMMYEXAMPLE0001",
  secretAccessKey: "dummy-secret-key",
  sessionToken: "dummy-session-token",
  region: "us-east-1",
  expiration: "2030-01-01T00:00:00Z",
  account: "123456789012",
  roleArn: "arn:aws:iam::123456789012:role/pan-parrot",
  sessionName: "pan-parrot",
  messageBody: '{"source":"pan-parrot","action":"login"}',
  messageMd5: "5f49b4c450ee70bfdaefc23415f20d7b",
};

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
  },
): MockOperation {
  const { pagination, contentType, ...rest } = partial;
  return {
    ...rest,
    headers: {},
    contentType: contentType ?? "text/xml; charset=utf-8",
    pagination: { ...defaultPagination(), style: "none", ...pagination },
  };
}

function awsAuth(service: string): MockAuth {
  return {
    mode: "sigv4",
    sigv4: {
      accessKeyId: AWS_DUMMY.accessKeyId,
      secretAccessKey: AWS_DUMMY.secretAccessKey,
      sessionAccessKeyId: AWS_DUMMY.sessionAccessKeyId,
      region: AWS_DUMMY.region,
      service,
      verify: false,
    },
  };
}

function preset(input: {
  id: string;
  name: string;
  pack: string;
  summary: string;
  docUrl: string;
  sourceUrl: string;
  differences: string[];
  operations: MockOperation[];
  auth: MockAuth;
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
    vendor: "Amazon Web Services",
    fidelity: "verified",
    curated: true,
    summary: input.summary,
    notes: input.differences,
    attribution: "Checked against the AWS API reference and the demisto/content client (MIT). See /presets/ATTRIBUTION.md.",
    sourceUrl: input.sourceUrl,
    spec: {
      version: 1,
      source: {
        kind: "preset",
        id: input.id,
        name: input.name,
        fidelity: "verified",
        attribution: "AWS API reference plus demisto/content client (MIT).",
        sourceUrl: input.docUrl,
        notes: input.differences,
        verification: { status: "verified", docUrl: input.docUrl, checkedAt, differences: input.differences },
      },
      operations: input.operations,
      chaos: defaultChaos(input.id),
      totalRecords: 10,
      auth: input.auth,
    },
  };
}

/** STS and SQS query-protocol presets. Signature checks stay off until the Auth tab turns them on. */
export const awsQueryVerifiedPresets = [
  preset({
    id: "aws-sts-aws-sts",
    name: "AWS - STS",
    pack: "AWS",
    summary: "AssumeRole and GetCallerIdentity as STS query-protocol XML.",
    docUrl: "https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/AWS/Integrations/AWS",
    auth: awsAuth("sts"),
    differences: [
      "boto3 AssumeRole and GetCallerIdentity are the STS query protocol. POST / matches Action from the form body or the query string. The namespace is https://sts.amazonaws.com/doc/2011-06-15/.",
      "AssumeRole returns Credentials and AssumedRoleUser. The temporary key is ASIADUMMYEXAMPLE0001, the secret matches the dummy secret, and the session token is dummy-session-token. Expiration is 2030-01-01T00:00:00Z. RoleArn and RoleSessionName are copied into the assumed-role ARN.",
      "GetCallerIdentity returns account 123456789012 and the pan-parrot assumed role. It does not remember an earlier RoleArn. Signature checks are off until Auth, AWS SigV4, Check the signature. A bad signature is 403 SignatureDoesNotMatch XML.",
    ],
    operations: [
      op({
        id: "assume-role",
        method: "POST",
        pathTemplate: "/",
        summary: "Assume a role",
        status: 200,
        list: false,
        envelope: {
          type: "aws-query",
          protocol: "query",
          action: "AssumeRole",
          namespace: "https://sts.amazonaws.com/doc/2011-06-15/",
          result: "structure",
          listElement: "Result",
          itemElement: "member",
          paging: "marker",
        },
        queryMatch: { Action: "AssumeRole" },
        record: object("assumed", [
          object("Credentials", [
            field("AccessKeyId", "const", { constValue: AWS_DUMMY.sessionAccessKeyId }),
            field("SecretAccessKey", "const", { constValue: AWS_DUMMY.secretAccessKey }),
            field("SessionToken", "const", { constValue: AWS_DUMMY.sessionToken }),
            field("Expiration", "const", { constValue: AWS_DUMMY.expiration }),
          ]),
          object("AssumedRoleUser", [
            field("AssumedRoleId", "const", { constValue: "AROAEXAMPLE:pan-parrot" }),
            field("Arn", "const", { constValue: "arn:aws:sts::123456789012:assumed-role/pan-parrot/pan-parrot" }),
          ]),
        ]),
      }),
      op({
        id: "get-caller-identity",
        method: "POST",
        pathTemplate: "/",
        summary: "Get the caller identity",
        status: 200,
        list: false,
        envelope: {
          type: "aws-query",
          protocol: "query",
          action: "GetCallerIdentity",
          namespace: "https://sts.amazonaws.com/doc/2011-06-15/",
          result: "structure",
          listElement: "Result",
          itemElement: "member",
          paging: "marker",
        },
        queryMatch: { Action: "GetCallerIdentity" },
        record: object("identity", [
          field("Account", "const", { constValue: AWS_DUMMY.account }),
          field("Arn", "const", { constValue: "arn:aws:sts::123456789012:assumed-role/pan-parrot/pan-parrot" }),
          field("UserId", "const", { constValue: "AROAEXAMPLE:pan-parrot" }),
        ]),
      }),
    ],
  }),
  preset({
    id: "aws-sqs-fetch",
    name: "AWS - SQS fetch",
    pack: "AWS-SQS",
    summary: "ReceiveMessage and DeleteMessage as SQS query-protocol XML.",
    docUrl: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html",
    sourceUrl: "https://github.com/demisto/content/tree/master/Packs/AWS-SQS/Integrations/AWS-SQS",
    auth: awsAuth("sqs"),
    differences: [
      "The SQS API reference is query XML. POST / with Action=ReceiveMessage returns repeated Message elements in http://queue.amazonaws.com/doc/2012-11-05/. Current boto3 sends JSON instead: X-Amz-Target AmazonSQS.ReceiveMessage and { Messages }.",
      "ReceiveMessage returns MessageId, ReceiptHandle, MD5OfBody, and Body. MaxNumberOfMessages selects how many, up to 10. The next poll returns the same messages. XSOAR fetch skips receipt handles it already stored.",
      "DeleteMessage returns an empty result and ResponseMetadata. The receipt handle is not removed. Attributes are omitted. Signature checks are off until you turn them on. The AssumeRole session key is accepted when checks are on.",
    ],
    operations: [
      op({
        id: "receive-message",
        method: "POST",
        pathTemplate: "/",
        summary: "Receive messages",
        status: 200,
        list: true,
        envelope: {
          type: "aws-query",
          protocol: "query",
          action: "ReceiveMessage",
          namespace: "http://queue.amazonaws.com/doc/2012-11-05/",
          result: "flattened",
          listElement: "Message",
          itemElement: "member",
          paging: "marker",
        },
        queryMatch: { Action: "ReceiveMessage" },
        pagination: { style: "offset", limitParam: "MaxNumberOfMessages", offsetParam: "offset", defaultLimit: 1, maxLimit: 10 },
        record: object("message", [
          field("MessageId", "id"),
          field("ReceiptHandle", "id"),
          field("MD5OfBody", "const", { constValue: AWS_DUMMY.messageMd5 }),
          field("Body", "const", { constValue: AWS_DUMMY.messageBody }),
        ]),
      }),
      op({
        id: "delete-message",
        method: "POST",
        pathTemplate: "/",
        summary: "Delete a message",
        status: 200,
        list: false,
        envelope: {
          type: "aws-query",
          protocol: "query",
          action: "DeleteMessage",
          namespace: "http://queue.amazonaws.com/doc/2012-11-05/",
          result: "empty",
          listElement: "Result",
          itemElement: "member",
          paging: "marker",
        },
        queryMatch: { Action: "DeleteMessage" },
        record: object("deleted", []),
      }),
      op({
        id: "receive-message-json",
        method: "POST",
        pathTemplate: "/",
        summary: "Receive messages as aws-json",
        status: 200,
        list: true,
        contentType: "application/x-amz-json-1.0",
        envelope: { type: "wrapped", arrayKey: "Messages" },
        headerMatch: { "x-amz-target": "AmazonSQS.ReceiveMessage" },
        pagination: { style: "offset", limitParam: "MaxNumberOfMessages", offsetParam: "offset", defaultLimit: 1, maxLimit: 10 },
        record: object("message", [
          field("MessageId", "id"),
          field("ReceiptHandle", "id"),
          field("MD5OfBody", "const", { constValue: AWS_DUMMY.messageMd5 }),
          field("Body", "const", { constValue: AWS_DUMMY.messageBody }),
        ]),
      }),
      op({
        id: "delete-message-json",
        method: "POST",
        pathTemplate: "/",
        summary: "Delete a message as aws-json",
        status: 200,
        list: false,
        contentType: "application/x-amz-json-1.0",
        envelope: { type: "object" },
        headerMatch: { "x-amz-target": "AmazonSQS.DeleteMessage" },
        record: object("deleted", []),
      }),
    ],
  }),
];
