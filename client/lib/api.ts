import { UserEndpoint, CapturedRequest, CreateEndpointRequest, MockResponseConfig } from '@shared/api';

// Helper to get auth token (in real app, this would be a JWT)
function getAuthToken(): string {
  const user = localStorage.getItem('pan-parrot-user');
  if (user) {
    try {
      const userData = JSON.parse(user);
      return userData.id; // Use user ID as token for demo
    } catch (error) {
      return 'anonymous';
    }
  }
  return 'anonymous';
}

// Helper to make authenticated requests
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

// Endpoint Management
export async function createEndpoint(data: CreateEndpointRequest): Promise<UserEndpoint> {
  return apiRequest<UserEndpoint>('/api/endpoints', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getUserEndpoints(): Promise<UserEndpoint[]> {
  return apiRequest<UserEndpoint[]>('/api/endpoints');
}

export async function deleteEndpoint(endpointId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/endpoints/${endpointId}`, {
    method: 'DELETE',
  });
}

export async function configureMockResponse(
  endpointId: string, 
  config: MockResponseConfig
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/endpoints/${endpointId}/mock`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// Request Management
export async function getCapturedRequests(): Promise<CapturedRequest[]> {
  return apiRequest<CapturedRequest[]>('/api/requests');
}

export async function getRequestDetails(requestId: string): Promise<CapturedRequest> {
  return apiRequest<CapturedRequest>(`/api/requests/${requestId}`);
}

// Helper to make a request to a user endpoint (for testing/replay)
export async function makeRequestToEndpoint(
  url: string,
  method: string = 'GET',
  headers: Record<string, string> = {},
  body?: any
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return fetch(url, options);
}
