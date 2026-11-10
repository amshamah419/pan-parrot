import { getIntrospectionQuery, graphqlSync, buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { generateMockResponse, matchOperation } from "./generate";
import { answerGraphql, looksLikeGraphql, mockFromGraphql } from "./graphql-mock";
import { validateMockSpec, type MockSpec } from "./mock-spec";
import { WIZ_EXAMPLE_QUERY, WIZ_SDL } from "./wiz-schema";
import { verifiedPresets } from "./verified-presets";

const relay = `
type Query { items(first: Int, after: String): ItemConnection! item(id: ID!): Item }
type ItemConnection { edges: [ItemEdge!]! pageInfo: PageInfo! totalCount: Int }
type ItemEdge { cursor: String! node: Item! }
type Item { id: ID! name: String }
type PageInfo { hasNextPage: Boolean! endCursor: String hasPreviousPage: Boolean }
`;

function spec(schema: string, totalRecords = 5): MockSpec {
  const draft = mockFromGraphql(schema);
  return validateMockSpec({ ...draft, totalRecords, chaos: { ...draft.chaos, seed: "test" } });
}

describe("graphql mocks", () => {
  it("fills the selection set and echoes an id variable", () => {
    const result = answerGraphql({
      spec: spec(relay),
      operation: spec(relay).operations[0],
      body: JSON.stringify({
        query: "query Get($id: ID!) { item(id: $id) { id name } }",
        variables: { id: "abc" },
        operationName: "Get",
      }),
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ data: { item: { id: "abc", name: "name-0" } } });
  });

  it("pages a relay connection across the catalog", () => {
    const body = {
      query: "query { items(first: 2) { edges { cursor node { id } } pageInfo { hasNextPage endCursor } totalCount } }",
    };
    const mock = spec(relay, 5);
    const first = answerGraphql({ spec: mock, operation: mock.operations[0], body: JSON.stringify(body) });
    const page = JSON.parse(first.body).data.items;
    expect(page.totalCount).toBe(5);
    expect(page.edges).toHaveLength(2);
    expect(page.pageInfo.hasNextPage).toBe(true);
    const second = answerGraphql({
      spec: mock,
      operation: mock.operations[0],
      body: JSON.stringify({
        query: "query Page($after: String) { items(first: 2, after: $after) { edges { node { id } } pageInfo { hasNextPage endCursor } } }",
        variables: { after: page.pageInfo.endCursor },
      }),
    });
    const next = JSON.parse(second.body).data.items;
    const ids = [...page.edges, ...next.edges].map((edge: { node: { id: string } }) => edge.node.id);
    expect(new Set(ids).size).toBe(4);
    expect(next.pageInfo.hasNextPage).toBe(true);
    const last = answerGraphql({
      spec: mock,
      operation: mock.operations[0],
      body: JSON.stringify({
        query: "query Page($after: String) { items(first: 2, after: $after) { edges { node { id } } pageInfo { hasNextPage } } }",
        variables: { after: next.pageInfo.endCursor },
      }),
    });
    const end = JSON.parse(last.body).data.items;
    expect(end.edges).toHaveLength(1);
    expect(end.pageInfo.hasNextPage).toBe(false);
  });

  it("matches operationName and returns a GraphQL error for an unknown field", () => {
    const mock = validateMockSpec({
      ...spec(relay),
      operations: [
        { ...spec(relay).operations[0], id: "items", graphqlOperation: "Items" },
        {
          ...spec(relay).operations[0],
          id: "broken",
          graphqlOperation: "Broken",
          priority: 2,
        },
      ],
      chaos: { ...spec(relay).chaos, enabled: true, mode: "every-nth", everyNth: 1, graphqlErrors: true },
    });
    const items = matchOperation(mock, "POST", "/graphql", {}, {
      body: JSON.stringify({ query: "query Items { items(first: 1) { totalCount } }", operationName: "Items" }),
    });
    const broken = matchOperation(mock, "POST", "/graphql", {}, {
      body: JSON.stringify({ query: "query Broken { items(first: 1) { totalCount } }", operationName: "Broken" }),
    });
    expect(items?.operation.id).toBe("items");
    expect(broken?.operation.id).toBe("broken");
    const bad = answerGraphql({
      spec: mock,
      operation: mock.operations[0],
      body: JSON.stringify({ query: "query { missing }" }),
    });
    expect(JSON.parse(bad.body).errors[0].message).toMatch(/Cannot query field/);
    const forced = generateMockResponse({
      spec: mock,
      operation: broken!.operation,
      pathParams: {},
      query: {},
      requestIndex: 1,
      body: JSON.stringify({ query: "query Broken { items(first: 1) { totalCount } }", operationName: "Broken" }),
    });
    expect(JSON.parse(forced.body)).toEqual({ data: null, errors: [{ message: "GraphQL error", path: ["query"] }] });
  });

  it("accepts introspection JSON and the Wiz issues query", () => {
    const schema = buildSchema(relay);
    const introspection = graphqlSync({ schema, source: getIntrospectionQuery() });
    expect(looksLikeGraphql(JSON.stringify(introspection))).toBe(true);
    const imported = mockFromGraphql(JSON.stringify(introspection));
    const result = answerGraphql({
      spec: validateMockSpec(imported),
      operation: imported.operations[0],
      body: "{ items(first: 1) { totalCount } }",
    });
    expect(JSON.parse(result.body).data.items.totalCount).toBe(20);
    const wiz = verifiedPresets.find((preset) => preset.id === "wiz-wiz");
    expect(wiz?.spec.source.verification?.status).toBe("verified");
    const issues = answerGraphql({
      spec: wiz!.spec,
      operation: wiz!.spec.operations[0],
      body: JSON.stringify({
        query: `query IssuesTable($filterBy: IssueFilters, $first: Int, $after: String) {
          issues: issuesV2(filterBy: $filterBy, first: $first, after: $after) {
            nodes { id status severity sourceRule { __typename ... on Control { name } } entitySnapshot { name region } }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        variables: { first: 2 },
        operationName: "IssuesTable",
      }),
    });
    const data = JSON.parse(issues.body).data;
    expect(data.issues.nodes).toHaveLength(2);
    expect(data.issues.nodes[0].id).not.toBe(data.issues.nodes[1].id);
    expect(data.issues.pageInfo.hasNextPage).toBe(true);
    expect(data.issues.nodes[0].sourceRule.__typename).toBeTruthy();
    expect(WIZ_SDL).toContain("issuesV2");
    expect(WIZ_EXAMPLE_QUERY).toContain("IssuesTable");
  });
});
