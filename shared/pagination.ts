import type { Envelope, MockOperation, PaginationSpec } from "./mock-spec";

export type VendorPageStyle = "none" | "offset" | "page" | "cursor" | "link" | "akamai";

/** Switch an operation to the paging shape a vendor client already knows how to follow. */
export function applyVendorPagination(operation: MockOperation, style: VendorPageStyle): MockOperation {
  const pagination: PaginationSpec = { ...operation.pagination, style: style === "akamai" ? "akamai" : style };
  if (style === "none") {
    return { ...operation, pagination: { ...pagination, style: "none" } };
  }
  if (style === "page") {
    return {
      ...operation,
      list: true,
      envelope: arrayEnvelope(operation.envelope),
      pagination: { ...pagination, style: "page", limitParam: "limit", pageParam: "page" },
    };
  }
  if (style === "cursor") {
    return {
      ...operation,
      list: true,
      envelope: { type: "token-page", arrayKey: "items", tokenKey: "nextToken" },
      pagination: { ...pagination, style: "cursor", limitParam: "limit", cursorParam: "cursor" },
    };
  }
  if (style === "link") {
    return {
      ...operation,
      list: true,
      envelope: arrayEnvelope(operation.envelope),
      pagination: { ...pagination, style: "link", limitParam: "limit", cursorParam: "cursor" },
    };
  }
  if (style === "akamai") {
    return {
      ...operation,
      list: true,
      stream: false,
      contentType: "application/x-ndjson; charset=utf-8",
      envelope: { type: "ndjson", trailer: "akamai-offset" },
      pagination: {
        ...pagination,
        style: "akamai",
        limitParam: "limit",
        offsetParam: "offset",
        timeParam: "from",
        timeOverridesOffset: true,
      },
    };
  }
  return {
    ...operation,
    list: true,
    envelope: arrayEnvelope(operation.envelope),
    pagination: { ...pagination, style: "offset", limitParam: "limit", offsetParam: "offset" },
  };
}

function arrayEnvelope(envelope: Envelope): Envelope {
  return envelope.type === "array" ? envelope : { type: "array" };
}
