import type { MockSpec } from "./mock-spec";
import { buildIntegrationMock } from "./xsoar-workflow";

export function isXsoarIntegration(document: unknown): boolean {
  if (!document || typeof document !== "object" || Array.isArray(document)) return false;
  const commands = (document as { script?: { commands?: unknown } }).script?.commands;
  return Array.isArray(commands);
}

export function isOpenApiDocument(document: unknown): boolean {
  if (!document || typeof document !== "object" || Array.isArray(document)) return false;
  const doc = document as { openapi?: unknown; swagger?: unknown };
  return typeof doc.openapi === "string" || typeof doc.swagger === "string";
}

/** One operation per command. Paths are /command-name unless the description contains METHOD /path. */
export function mockFromIntegrationYaml(text: string): MockSpec {
  return buildIntegrationMock({ yaml: text }).spec;
}
