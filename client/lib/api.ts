import {
  UserEndpoint,
  CapturedRequest,
  CreateEndpointRequest,
  MockResponseConfig,
} from "@shared/api";

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
  data: CreateEndpointRequest,
): Promise<UserEndpoint> {
  return apiRequest<UserEndpoint>("/api/endpoints", {
    method: "POST",
    body: JSON.stringify(data),
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
