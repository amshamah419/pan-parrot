/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

export interface DemoResponse {
  message: string;
}

export interface CapturedRequest {
  id: string;
  method: string;
  endpoint: string;
  timestamp: string;
  status: number;
  ip: string;
  userAgent: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  userId: string;
  truncated?: boolean;
  responsePreview?: string | null;
  chaosEffects?: string[];
  recordCount?: number | null;
}

export interface UserEndpoint {
  id: string;
  name: string;
  path: string;
  url: string;
  description?: string | null;
  userId: string;
  created: string;
  published?: boolean;
  access?: "owner" | "edit" | "view";
  ownerEmail?: string;
  requests?: number;
  mockResponse?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    delay: number;
    enabled?: boolean;
  };
  mockSpec?: unknown;
}

export interface CreateEndpointRequest {
  name: string;
  customPath?: string;
  description?: string;
}

export interface MockResponseConfig {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  delay: number;
  enabled?: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  created: string;
  lastLogin?: string;
  active: boolean;
  permanentAdmin?: boolean;
}

export interface AdminSignals {
  ok: boolean;
  database: "up" | "down";
  email: "configured" | "missing";
  siteUrl: string;
  devCodeExposed: boolean;
  sessionSecret: "ok" | "missing";
  retentionDays: number;
  maxRequestsPerEndpoint: number;
  maxBodyBytes: number;
  users: number;
  inactiveUsers: number;
  endpoints: number;
  capturedRequests: number;
  auditEvents: number;
  newestAudit: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}
