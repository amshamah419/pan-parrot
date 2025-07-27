/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * PAN Parrot API Types
 */
export interface CapturedRequest {
  id: string;
  method: string;
  endpoint: string;
  timestamp: string;
  status: number;
  ip: string;
  userAgent: string;
  headers: Record<string, any>;
  body: any;
  query: Record<string, any>;
  userId: string;
}

export interface UserEndpoint {
  id: string;
  name: string;
  path: string;
  url: string;
  userId: string;
  created: string;
  requests?: number; // Request count, added by API
  mockResponse?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    delay: number;
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
}
