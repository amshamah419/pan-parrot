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
}

export interface UserEndpoint {
  id: string;
  name: string;
  path: string;
  url: string;
  description?: string | null;
  userId: string;
  created: string;
  requests?: number;
  mockResponse?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    delay: number;
    enabled?: boolean;
  };
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
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}
