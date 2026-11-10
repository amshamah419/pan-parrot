/** Subset of the Wiz Issues query. Field names follow the public IssuesTable query. */
export const WIZ_SDL = `
scalar DateTime
scalar JSON

type Query {
  issuesV2(filterBy: IssueFilters, first: Int, after: String, orderBy: IssueOrder): IssueConnection!
}

input IssueFilters {
  status: [String!]
  severity: [String!]
  type: [String!]
}

input IssueOrder {
  field: String
  direction: String
}

type IssueConnection {
  nodes: [Issue!]
  pageInfo: PageInfo!
  totalCount: Int
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

type Issue {
  id: ID!
  type: String
  createdAt: DateTime
  updatedAt: DateTime
  dueAt: DateTime
  resolvedAt: DateTime
  statusChangedAt: DateTime
  status: IssueStatus
  severity: Severity
  sourceRule: SourceRule
  sourceRules: [SourceRule!]
  projects: [Project!]
  entitySnapshot: EntitySnapshot
  serviceTickets: [ServiceTicket!]
  notes: [IssueNote!]
  evidenceQuery: String
}

enum IssueStatus { OPEN IN_PROGRESS REJECTED RESOLVED }
enum Severity { INFORMATIONAL LOW MEDIUM HIGH CRITICAL }

union SourceRule = Control | CloudEventRule | CloudConfigurationRule

type Control {
  id: ID!
  name: String
  description: String
  resolutionRecommendation: String
  risks: [String!]
  securitySubCategories: [SecuritySubCategory!]
}

type CloudEventRule {
  id: ID!
  name: String
  description: String
  risks: [String!]
  sourceType: String
  type: String
  securitySubCategories: [SecuritySubCategory!]
}

type CloudConfigurationRule {
  id: ID!
  name: String
  description: String
  remediationInstructions: String
  risks: [String!]
  serviceType: String
  securitySubCategories: [SecuritySubCategory!]
}

type SecuritySubCategory {
  title: String
  category: SecurityCategory
}

type SecurityCategory {
  name: String
  framework: Framework
}

type Framework { name: String }

type Project {
  id: ID!
  name: String
  slug: String
  businessUnit: String
  projectOwners: [ProjectPerson!]
  securityChampions: [ProjectPerson!]
  riskProfile: RiskProfile
}

type ProjectPerson { name: String }
type RiskProfile { businessImpact: String }

type EntitySnapshot {
  id: ID!
  type: String
  nativeType: String
  name: String
  status: String
  cloudPlatform: String
  cloudProviderURL: String
  providerId: String
  region: String
  resourceGroupExternalId: String
  subscriptionExternalId: String
  subscriptionName: String
  subscriptionTags: JSON
  tags: JSON
  externalId: String
}

type ServiceTicket {
  externalId: String
  name: String
  url: String
}

type IssueNote {
  createdAt: DateTime
  updatedAt: DateTime
  text: String
  user: IssueUser
  serviceAccount: IssueUser
}

type IssueUser { name: String email: String }
`;

export const WIZ_EXAMPLE_QUERY = `query IssuesTable($first: Int, $after: String) {
  issues: issuesV2(first: $first, after: $after) {
    nodes { id status severity entitySnapshot { id name region } }
    pageInfo { hasNextPage endCursor }
  }
}`;
