import {
  UserEndpoint,
  CapturedRequest,
  CreateEndpointRequest,
  MockResponseConfig,
} from "@shared/api";
import type { RecordedFixture } from "@shared/recording";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // The body was not JSON.
    }
    if (response.status === 401) {
      window.dispatchEvent(new Event("pan-parrot-unauthorized"));
    }
    throw new Error(message);
  }

  return response.json();
}

export async function createEndpoint(
  data: CreateEndpointRequest & { mockSpec?: unknown },
): Promise<UserEndpoint> {
  return apiRequest<UserEndpoint>("/api/endpoints", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getEndpoint(endpointId: string): Promise<UserEndpoint> {
  return apiRequest<UserEndpoint>(`/api/endpoints/${endpointId}`);
}

export async function resetRuntime(endpointId: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/endpoints/${endpointId}/runtime/reset`, { method: "POST" });
}

export async function saveMockSpec(
  endpointId: string,
  mockSpec: unknown,
): Promise<UserEndpoint> {
  return apiRequest<UserEndpoint>(`/api/endpoints/${endpointId}/spec`, {
    method: "PUT",
    body: JSON.stringify({ mockSpec }),
  });
}

export async function importSpec(body: {
  text?: string;
  url?: string;
  kind?: "sample" | "spec";
  zipBase64?: string;
}): Promise<{ mockSpec: unknown; warnings: string[]; unsupported: string[] }> {
  return apiRequest(`/api/specs/import`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getUserEndpoints(): Promise<UserEndpoint[]> {
  return apiRequest<UserEndpoint[]>("/api/endpoints");
}

export async function deleteEndpoint(
  endpointId: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/endpoints/${endpointId}`, {
    method: "DELETE",
  });
}

export async function configureMockResponse(
  endpointId: string,
  config: MockResponseConfig,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/endpoints/${endpointId}/mock`, {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function recordUpstreamCall(input: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<RecordedFixture> {
  return apiRequest<RecordedFixture>("/api/record", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listApiTokens(): Promise<
  Array<{ id: string; name: string; prefix: string; created: string; lastUsed: string | null }>
> {
  return apiRequest("/api/tokens");
}

export async function createApiToken(name: string): Promise<{ id: string; name: string; prefix: string; token: string }> {
  return apiRequest("/api/tokens", { method: "POST", body: JSON.stringify({ name }) });
}

export async function revokeApiToken(tokenId: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/tokens/${tokenId}`, { method: "DELETE" });
}

export async function getCapturedRequests(): Promise<CapturedRequest[]> {
  return apiRequest<CapturedRequest[]>("/api/requests");
}

export async function getRequestDetails(
  requestId: string,
): Promise<CapturedRequest> {
  return apiRequest<CapturedRequest>(`/api/requests/${requestId}`);
}

export async function makeRequestToEndpoint(
  url: string,
  method: string = "GET",
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<Response> {
  const options: RequestInit = {
    method,
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    options.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  return fetch(url, options);
}
