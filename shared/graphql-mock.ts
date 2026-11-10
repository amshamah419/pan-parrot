import {
  buildClientSchema,
  buildSchema,
  getNamedType,
  getNullableType,
  getOperationAST,
  graphqlSync,
  isEnumType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  parse,
  validate,
  type DirectiveNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLSchema,
  type SelectionNode,
  type SelectionSetNode,
  type ValueNode,
} from "graphql";
import { MOCK_LIMITS } from "./policy";
import type { ChaosSpec, MockOperation, MockSpec } from "./mock-spec";

export interface GraphqlAnswer {
  status: number;
  body: string;
  recordCount: number;
  effects: string[];
  capped: boolean;
}

const schemaCache = new Map<string, GraphQLSchema>();

export function schemaFromText(text: string): GraphQLSchema {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as { __schema?: unknown; data?: { __schema?: unknown } };
    const introspection = parsed.__schema ? parsed : parsed.data;
    if (!introspection || !introspection.__schema) throw new Error("Introspection JSON needs __schema");
    return buildClientSchema(introspection as Parameters<typeof buildClientSchema>[0]);
  }
  return buildSchema(trimmed);
}

export function mockFromGraphql(text: string): MockSpec {
  const schema = schemaFromText(text);
  const query = schema.getQueryType();
  if (!query) throw new Error("GraphQL schema needs a Query type");
  const example = exampleQuery(query);
  return {
    version: 1,
    source: {
      kind: "graphql",
      name: "GraphQL",
      fidelity: "generated",
      notes: ["Queries are answered from the schema. The selection set decides which fields come back."],
    },
    operations: [
      {
        id: "graphql",
        method: "POST",
        pathTemplate: "/graphql",
        summary: "GraphQL",
        status: 200,
        contentType: "application/json; charset=utf-8",
        headers: {},
        list: false,
        envelope: { type: "graphql" },
        pagination: {
          style: "cursor",
          limitParam: "first",
          offsetParam: "after",
          pageParam: "page",
          cursorParam: "after",
          defaultLimit: 20,
          maxLimit: MOCK_LIMITS.maxRecordsPerResponse,
        },
        record: { name: "data", kind: "object", children: [] },
      },
    ],
    chaos: {
      enabled: false,
      seed: "graphql",
      mode: "probability",
      probability: 0.25,
      everyNth: 5,
      duplicateRecords: false,
      missingFields: false,
      mixedTimestamps: false,
      outOfOrder: false,
      wrongTypes: false,
      truncatedJson: false,
      slowDrip: false,
      partial: false,
      malformedJson: false,
      wrongContentType: false,
      randomErrors: false,
      latency: false,
      paginationGlitch: "none",
      malformedXml: false,
      wrongNamespace: false,
      soapFault: false,
      authExpired: false,
      authDenied: false,
      authTokenFailure: false,
      authClockSkew: false,
      graphqlErrors: false,
    },
    totalRecords: 20,
    auth: { mode: "none" },
    graphql: {
      schema: text.trim().slice(0, MOCK_LIMITS.maxGraphqlSchemaChars),
      exampleQuery: example,
    },
  };
}

export function looksLikeGraphql(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { __schema?: unknown; data?: { __schema?: unknown } };
      return Boolean(parsed.__schema || parsed.data?.__schema);
    } catch {
      return false;
    }
  }
  return /(^|\n)\s*type\s+Query\b/.test(trimmed);
}

/** Operation name from a GraphQL HTTP body, for request rules. */
export function graphqlRequestName(body: string | undefined): string {
  const read = readRequest(body || "");
  if ("error" in read) return "";
  if (read.operationName) return read.operationName.slice(0, 80);
  try {
    const document = parse(read.query);
    const named = document.definitions.filter(
      (item) => item.kind === "OperationDefinition" && item.name?.value,
    );
    if (named.length === 1 && named[0].kind === "OperationDefinition") return named[0].name?.value || "";
  } catch {
    return "";
  }
  return "";
}

export function answerGraphql(input: {
  spec: MockSpec;
  operation: MockOperation;
  body?: string;
  chaos?: ChaosSpec | null;
}): GraphqlAnswer {
  if (input.chaos?.graphqlErrors) {
    return payload(200, { data: null, errors: [{ message: "GraphQL error", path: ["query"] }] }, 0, ["graphql-error"], false);
  }
  const schemaText = input.spec.graphql?.schema || "";
  if (!schemaText.trim()) {
    return payload(200, { errors: [{ message: "Add a GraphQL schema on this mock." }] }, 0, [], false);
  }
  const request = readRequest(input.body?.trim() ? input.body : input.spec.graphql?.exampleQuery || "");
  if ("error" in request) return payload(400, { errors: [{ message: request.error }] }, 0, [], false);
  if (request.query.length > MOCK_LIMITS.maxGraphqlQueryChars) {
    return payload(400, { errors: [{ message: "GraphQL query is too long." }] }, 0, [], false);
  }
  let schema: GraphQLSchema;
  try {
    schema = loadSchema(schemaText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GraphQL schema is invalid";
    return payload(200, { errors: [{ message: message.slice(0, 300) }] }, 0, [], false);
  }
  let document;
  try {
    document = parse(request.query);
  } catch (error) {
    const gql = error as { message?: string; locations?: unknown };
    return payload(200, { errors: [{ message: String(gql.message || "Query is invalid"), locations: gql.locations }] }, 0, [], false);
  }
  const operation = getOperationAST(document, request.operationName || undefined);
  if (!operation) {
    return payload(200, { errors: [{ message: request.operationName ? `Unknown operation ${request.operationName}.` : "Query has no operation." }] }, 0, [], false);
  }
  if (operation.operation !== "query") {
    return payload(200, { errors: [{ message: "This mock answers query operations. Mutation and subscription are not filled in." }] }, 0, [], false);
  }
  const errors = validate(schema, document).slice(0, 20);
  if (errors.length) {
    return payload(200, {
      errors: errors.map((error) => ({ message: error.message, locations: error.locations })),
    }, 0, [], false);
  }
  const rootNames = operation.selectionSet.selections
    .filter((item): item is FieldNode => item.kind === "Field")
    .map((item) => item.name.value);
  if (rootNames.length > 0 && rootNames.every((name) => name.startsWith("__"))) {
    const result = graphqlSync({
      schema,
      source: request.query,
      variableValues: request.variables,
      operationName: request.operationName || undefined,
    });
    return payload(200, { data: result.data ?? null, errors: result.errors?.map((error) => ({ message: error.message, locations: error.locations })) }, 0, [], false);
  }
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const item of document.definitions) {
    if (item.kind === "FragmentDefinition") fragments.set(item.name.value, item);
  }
  const depth = selectionDepth(operation.selectionSet, fragments, new Set());
  if (depth > MOCK_LIMITS.maxGraphqlDepth) {
    return payload(200, { errors: [{ message: `Query is nested deeper than ${MOCK_LIMITS.maxGraphqlDepth}.` }] }, 0, [], false);
  }
  const queryType = schema.getQueryType();
  if (!queryType) return payload(200, { errors: [{ message: "Schema has no Query type." }] }, 0, [], false);
  const ctx: Walk = {
    schema,
    variables: request.variables,
    fragments,
    fields: 0,
    totalRecords: input.spec.totalRecords,
    forcedId: "",
    recordCount: 0,
    capped: false,
  };
  try {
    const data = walkSelection(operation.selectionSet, queryType, 0, 0, ctx);
    return payload(200, { data }, ctx.recordCount, [], ctx.capped);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build the GraphQL response";
    return payload(200, { errors: [{ message }] }, 0, [], false);
  }
}

interface Walk {
  schema: GraphQLSchema;
  variables: Record<string, unknown>;
  fragments: Map<string, FragmentDefinitionNode>;
  fields: number;
  totalRecords: number;
  forcedId: string;
  recordCount: number;
  capped: boolean;
}

function walkSelection(
  selection: SelectionSetNode,
  type: GraphQLObjectType,
  index: number,
  depth: number,
  ctx: Walk,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const item of chosenSelections(selection, type, ctx)) {
    if (item.kind !== "Field") continue;
    if (skipped(item, ctx.variables)) continue;
    ctx.fields += 1;
    if (ctx.fields > MOCK_LIMITS.maxGraphqlFields) throw new Error(`Query selects more than ${MOCK_LIMITS.maxGraphqlFields} fields.`);
    const key = item.alias?.value || item.name.value;
    if (item.name.value === "__typename") {
      data[key] = type.name;
      continue;
    }
    const field = type.getFields()[item.name.value];
    if (!field) continue;
    data[key] = resolveField(field.type, item, index, depth, ctx);
  }
  return data;
}

function resolveField(type: GraphQLNamedType | ReturnType<typeof getNullableType>, field: FieldNode, index: number, depth: number, ctx: Walk): unknown {
  const nullable = getNullableType(type as GraphQLNamedType);
  if (isListType(nullable)) {
    const size = listSize(readArgs(field, ctx.variables));
    return Array.from({ length: size }, (_, offset) => resolveNamed(getNamedType(nullable.ofType), field, index + offset, depth + 1, ctx, ""));
  }
  return resolveNamed(getNamedType(nullable), field, index, depth + 1, ctx, "");
}

function resolveNamed(
  named: GraphQLNamedType,
  field: FieldNode,
  index: number,
  depth: number,
  ctx: Walk,
  forcedId: string,
): unknown {
  const args = readArgs(field, ctx.variables);
  const idArg = typeof args.id === "string" || typeof args.id === "number" ? String(args.id) : forcedId;
  if (isScalarType(named) || named.name === "JSON") {
    const echoed = field.name.value === "id" && ctx.forcedId ? ctx.forcedId : idArg;
    return scalarValue(named.name, field.name.value, index, echoed);
  }
  if (isEnumType(named)) {
    const values = named.getValues();
    return values[index % Math.max(1, values.length)]?.name || "";
  }
  if (isObjectType(named) && isConnection(named)) return resolveConnection(named, field, ctx);
  if (isObjectType(named)) {
    if (!field.selectionSet) return {};
    const previous = ctx.forcedId;
    ctx.forcedId = idArg;
    const value = walkSelection(field.selectionSet, named, index, depth, ctx);
    ctx.forcedId = previous;
    return value;
  }
  if (isInterfaceType(named) || isUnionType(named)) {
    const concrete = pickConcrete(named, field, index, ctx.schema);
    if (!concrete || !field.selectionSet) return {};
    return walkSelection(field.selectionSet, concrete, index, depth, ctx);
  }
  return null;
}

function resolveConnection(type: GraphQLObjectType, field: FieldNode, ctx: Walk): Record<string, unknown> {
  const args = readArgs(field, ctx.variables);
  const asked = Number(args.first ?? args.last ?? 20);
  const size = clamp(Number.isFinite(asked) ? asked : 20, 1, MOCK_LIMITS.maxRecordsPerResponse);
  if (Number.isFinite(asked) && asked > size) ctx.capped = true;
  const start = decodeToken(typeof args.after === "string" ? args.after : undefined);
  const count = start >= ctx.totalRecords ? 0 : Math.min(size, ctx.totalRecords - start);
  const next = start + count >= ctx.totalRecords ? null : start + count;
  ctx.recordCount += count;
  const nodeType = connectionNodeType(type);
  const body: Record<string, unknown> = {};
  if (!field.selectionSet) return body;
  for (const item of chosenSelections(field.selectionSet, type, ctx)) {
    if (item.kind !== "Field" || skipped(item, ctx.variables)) continue;
    const key = item.alias?.value || item.name.value;
    if (item.name.value === "nodes" && nodeType) {
      body[key] = Array.from({ length: count }, (_, offset) =>
        resolveNamed(nodeType, syntheticField(item, nodeType.name), start + offset, 1, ctx, ""),
      );
    } else if (item.name.value === "edges") {
      body[key] = Array.from({ length: count }, (_, offset) => {
        const at = start + offset;
        const edge: Record<string, unknown> = {};
        const edgeType = getNamedType(type.getFields().edges?.type);
        if (!isObjectType(edgeType) || !item.selectionSet) return { cursor: encodeToken(at + 1) };
        for (const edgeField of chosenSelections(item.selectionSet, edgeType, ctx)) {
          if (edgeField.kind !== "Field") continue;
          const edgeKey = edgeField.alias?.value || edgeField.name.value;
          if (edgeField.name.value === "cursor") edge[edgeKey] = encodeToken(at + 1);
          else if (edgeField.name.value === "node" && nodeType) {
            edge[edgeKey] = resolveNamed(nodeType, syntheticField(edgeField, nodeType.name), at, 1, ctx, "");
          } else if (edgeField.name.value === "__typename") edge[edgeKey] = edgeType.name;
        }
        return edge;
      });
    } else if (item.name.value === "pageInfo") {
      const info: Record<string, unknown> = {};
      const infoType = getNamedType(type.getFields().pageInfo?.type);
      if (isObjectType(infoType) && item.selectionSet) {
        for (const infoField of chosenSelections(item.selectionSet, infoType, ctx)) {
          if (infoField.kind !== "Field") continue;
          const infoKey = infoField.alias?.value || infoField.name.value;
          if (infoField.name.value === "hasNextPage") info[infoKey] = next != null;
          else if (infoField.name.value === "hasPreviousPage") info[infoKey] = start > 0;
          else if (infoField.name.value === "endCursor") info[infoKey] = next == null ? null : encodeToken(next);
          else if (infoField.name.value === "startCursor") info[infoKey] = count === 0 ? null : encodeToken(start + 1);
          else if (infoField.name.value === "__typename") info[infoKey] = infoType.name;
        }
      }
      body[key] = info;
    } else if (item.name.value === "totalCount") {
      body[key] = ctx.totalRecords;
    } else if (item.name.value === "__typename") {
      body[key] = type.name;
    }
  }
  return body;
}

function syntheticField(field: FieldNode, _typeName: string): FieldNode {
  return field;
}

function isConnection(type: GraphQLObjectType): boolean {
  const fields = type.getFields();
  return Boolean(fields.pageInfo && (fields.edges || fields.nodes));
}

function connectionNodeType(type: GraphQLObjectType): GraphQLNamedType | null {
  const nodes = type.getFields().nodes;
  if (nodes) return getNamedType(nodes.type);
  const edges = type.getFields().edges;
  if (!edges) return null;
  const edgeType = getNamedType(edges.type);
  if (!isObjectType(edgeType)) return null;
  const node = edgeType.getFields().node;
  return node ? getNamedType(node.type) : null;
}

function pickConcrete(type: GraphQLNamedType, field: FieldNode, index: number, schema: GraphQLSchema): GraphQLObjectType | null {
  const possible = isUnionType(type) || isInterfaceType(type) ? schema.getPossibleTypes(type) : [];
  const wanted = new Set<string>();
  for (const item of field.selectionSet?.selections || []) {
    if (item.kind === "InlineFragment" && item.typeCondition) wanted.add(item.typeCondition.name.value);
  }
  const preferred = possible.filter((item) => wanted.has(item.name));
  const pool = preferred.length ? preferred : possible;
  return pool[index % Math.max(1, pool.length)] || null;
}

function chosenSelections(selection: SelectionSetNode, type: GraphQLObjectType, ctx: Walk): SelectionNode[] {
  const out: SelectionNode[] = [];
  const stack = [...selection.selections];
  const seen = new Set<string>();
  while (stack.length) {
    const item = stack.shift();
    if (!item) break;
    if (item.kind === "Field") {
      out.push(item);
      continue;
    }
    if (item.kind === "InlineFragment") {
      if (fragmentApplies(item.typeCondition?.name.value, type) && item.selectionSet) stack.unshift(...item.selectionSet.selections);
      continue;
    }
    if (seen.has(item.name.value)) continue;
    seen.add(item.name.value);
    const fragment = ctx.fragments.get(item.name.value);
    if (fragment && fragmentApplies(fragment.typeCondition.name.value, type)) stack.unshift(...fragment.selectionSet.selections);
  }
  return out;
}

function fragmentApplies(typeName: string | undefined, type: GraphQLObjectType): boolean {
  if (!typeName) return true;
  if (type.name === typeName) return true;
  return type.getInterfaces().some((item) => item.name === typeName);
}

function skipped(field: FieldNode, variables: Record<string, unknown>): boolean {
  for (const directive of field.directives || []) {
    if (directive.name.value === "skip" && directiveFlag(directive, variables) === true) return true;
    if (directive.name.value === "include" && directiveFlag(directive, variables) === false) return true;
  }
  return false;
}

function directiveFlag(directive: DirectiveNode, variables: Record<string, unknown>): boolean | undefined {
  const arg = directive.arguments?.find((item) => item.name.value === "if");
  if (!arg) return undefined;
  return Boolean(valueFromAst(arg.value, variables));
}

function readArgs(field: FieldNode, variables: Record<string, unknown>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const arg of field.arguments || []) args[arg.name.value] = valueFromAst(arg.value, variables);
  return args;
}

function valueFromAst(value: ValueNode, variables: Record<string, unknown>): unknown {
  if (value.kind === "Variable") return variables[value.name.value];
  if (value.kind === "IntValue") return Number(value.value);
  if (value.kind === "FloatValue") return Number(value.value);
  if (value.kind === "StringValue") return value.value;
  if (value.kind === "BooleanValue") return value.value;
  if (value.kind === "EnumValue") return value.value;
  if (value.kind === "NullValue") return null;
  if (value.kind === "ListValue") return value.values.map((item) => valueFromAst(item, variables));
  if (value.kind === "ObjectValue") {
    const out: Record<string, unknown> = {};
    for (const field of value.fields) out[field.name.value] = valueFromAst(field.value, variables);
    return out;
  }
  return null;
}

function scalarValue(scalar: string, field: string, index: number, forcedId: string): unknown {
  const lower = field.toLowerCase();
  if ((lower === "id" || scalar === "ID") && forcedId && lower === "id") return forcedId;
  if (scalar === "Int") return index + 1;
  if (scalar === "Float") return index + 0.5;
  if (scalar === "Boolean") return index % 2 === 0;
  if (scalar === "ID" || lower === "id" || lower.endsWith("id")) return `${field}_${index.toString(16).padStart(4, "0")}`;
  if (lower.endsWith("at") || scalar === "DateTime" || scalar === "Date" || scalar === "Time") {
    return new Date((1_700_000_000 + index * 3600) * 1000).toISOString().replace(".000Z", "Z");
  }
  if (lower.includes("email")) return `user${index}@example.com`;
  if (lower.includes("url")) return `https://example.com/${field}/${index}`;
  if (scalar === "JSON") return { example: index };
  return `${field}-${index}`;
}

function listSize(args: Record<string, unknown>): number {
  const asked = Number(args.first ?? args.limit ?? 1);
  return clamp(Number.isFinite(asked) ? asked : 1, 1, 5);
}

function selectionDepth(selection: SelectionSetNode, fragments: Map<string, FragmentDefinitionNode>, seen: Set<string>): number {
  let deepest = 1;
  for (const item of selection.selections) {
    if (item.kind === "Field" && item.selectionSet) deepest = Math.max(deepest, 1 + selectionDepth(item.selectionSet, fragments, seen));
    if (item.kind === "InlineFragment" && item.selectionSet) deepest = Math.max(deepest, selectionDepth(item.selectionSet, fragments, seen));
    if (item.kind === "FragmentSpread" && !seen.has(item.name.value)) {
      const fragment = fragments.get(item.name.value);
      if (fragment) {
        seen.add(item.name.value);
        deepest = Math.max(deepest, selectionDepth(fragment.selectionSet, fragments, seen));
      }
    }
  }
  return deepest;
}

function readRequest(body: string): { query: string; variables: Record<string, unknown>; operationName: string } | { error: string } {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Must provide a query." };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as { query?: unknown; variables?: unknown; operationName?: unknown };
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && (typeof parsed.query === "string" || "variables" in parsed || "operationName" in parsed)) {
        if (typeof parsed.query !== "string" || !parsed.query.trim()) return { error: "Must provide a query string." };
        const variables = parsed.variables && typeof parsed.variables === "object" && !Array.isArray(parsed.variables)
          ? parsed.variables as Record<string, unknown>
          : {};
        return {
          query: parsed.query,
          variables,
          operationName: typeof parsed.operationName === "string" ? parsed.operationName : "",
        };
      }
    } catch {
      // A query document can start with `{` and is not JSON.
    }
  }
  return { query: trimmed, variables: {}, operationName: "" };
}

function loadSchema(text: string): GraphQLSchema {
  const hit = schemaCache.get(text);
  if (hit) return hit;
  const schema = schemaFromText(text);
  if (schemaCache.size > 20) schemaCache.clear();
  schemaCache.set(text, schema);
  return schema;
}

function exampleQuery(query: GraphQLObjectType): string {
  const field = Object.values(query.getFields()).find((item) => !item.name.startsWith("__"));
  if (!field) return "query { __typename }";
  const named = getNamedType(field.type);
  if (isScalarType(named) || isEnumType(named)) return `query { ${field.name} }`;
  if (isObjectType(named) && isConnection(named)) {
    const node = connectionNodeType(named);
    const inner = node && (isObjectType(node) || isInterfaceType(node)) ? "id" in (isObjectType(node) ? node.getFields() : {}) ? "id" : "__typename" : "__typename";
    const listField = named.getFields().nodes ? "nodes" : "edges";
    if (listField === "edges") {
      return `query { ${field.name}(first: 2) { edges { cursor node { ${inner} } } pageInfo { hasNextPage endCursor } } }`;
    }
    return `query { ${field.name}(first: 2) { nodes { ${inner} } pageInfo { hasNextPage endCursor } } }`;
  }
  return `query { ${field.name} { __typename } }`;
}

function payload(status: number, body: unknown, recordCount: number, effects: string[], capped: boolean): GraphqlAnswer {
  const json: Record<string, unknown> = body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : { data: body };
  if (Array.isArray(json.errors) && json.errors.length === 0) delete json.errors;
  if (json.errors == null) delete json.errors;
  return { status, body: JSON.stringify(json), recordCount, effects, capped };
}

function encodeToken(index: number): string {
  return `pp_${index.toString(36)}`;
}

function decodeToken(value: string | undefined): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = /^pp_([0-9a-z]+)$/i.exec(value);
  if (!match) return 0;
  return Number.parseInt(match[1], 36) || 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}
