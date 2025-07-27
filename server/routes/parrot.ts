import { RequestHandler } from "express";

// In-memory storage for development (in production, use a database)
interface CapturedRequest {
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

interface UserEndpoint {
  id: string;
  name: string;
  path: string;
  url: string;
  userId: string;
  created: string;
  mockResponse?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    delay: number;
  };
}

// In-memory stores
const capturedRequests: CapturedRequest[] = [];
const userEndpoints: UserEndpoint[] = [];

// Helper to get user ID from request (in real app, extract from JWT/session)
function getUserId(req: any): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // In real app, decode JWT token here
      const token = authHeader.substring(7);
      return token; // For demo, use the token as user ID
    } catch (error) {
      return 'anonymous';
    }
  }
  return 'anonymous';
}

// Create a new endpoint
export const createEndpoint: RequestHandler = (req, res) => {
  const { name, customPath, description } = req.body;
  const userId = getUserId(req);
  
  const endpointId = Math.random().toString(36).substr(2, 9);
  const path = customPath || Math.random().toString(36).substr(2, 8);
  
  const endpoint: UserEndpoint = {
    id: endpointId,
    name: name || 'Untitled Endpoint',
    path,
    url: `${req.protocol}://${req.get('host')}/catch/${path}`,
    userId,
    created: new Date().toISOString()
  };
  
  userEndpoints.push(endpoint);
  
  res.json(endpoint);
};

// Get user's endpoints
export const getUserEndpoints: RequestHandler = (req, res) => {
  const userId = getUserId(req);
  const endpoints = userEndpoints.filter(e => e.userId === userId);
  
  // Add request counts
  const endpointsWithCounts = endpoints.map(endpoint => ({
    ...endpoint,
    requests: capturedRequests.filter(r => r.endpoint === `/catch/${endpoint.path}` && r.userId === userId).length
  }));
  
  res.json(endpointsWithCounts);
};

// Get captured requests for user
export const getCapturedRequests: RequestHandler = (req, res) => {
  const userId = getUserId(req);
  const requests = capturedRequests.filter(r => r.userId === userId);
  
  // Sort by timestamp, newest first
  requests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  res.json(requests);
};

// Configure mock response for an endpoint
export const configureMockResponse: RequestHandler = (req, res) => {
  const { endpointId } = req.params;
  const { statusCode, headers, body, delay } = req.body;
  const userId = getUserId(req);
  
  const endpoint = userEndpoints.find(e => e.id === endpointId && e.userId === userId);
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  endpoint.mockResponse = {
    statusCode: statusCode || 200,
    headers: headers || { 'Content-Type': 'application/json' },
    body: body || '{"status": "success"}',
    delay: delay || 0
  };
  
  res.json({ message: 'Mock response configured' });
};

// The main catch-all handler for user endpoints
export const catchRequest: RequestHandler = async (req, res) => {
  const { path } = req.params;
  
  // Find the endpoint
  const endpoint = userEndpoints.find(e => e.path === path);
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  // Capture the request
  const capturedRequest: CapturedRequest = {
    id: Math.random().toString(36).substr(2, 9),
    method: req.method,
    endpoint: `/catch/${path}`,
    timestamp: new Date().toISOString(),
    status: 200,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    headers: req.headers,
    body: req.body,
    query: req.query,
    userId: endpoint.userId
  };
  
  capturedRequests.push(capturedRequest);
  
  // Emit to connected clients (we'll implement WebSocket later)
  // For now, just store it
  
  // Check if there's a mock response configured
  if (endpoint.mockResponse) {
    const { statusCode, headers, body, delay } = endpoint.mockResponse;
    
    // Apply delay if configured
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Set custom headers
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    capturedRequest.status = statusCode;
    
    return res.status(statusCode).send(body);
  }
  
  // Default response
  res.json({
    message: `Hello from PAN Parrot! 🦜`,
    timestamp: new Date().toISOString(),
    method: req.method,
    endpoint: path,
    captured: true
  });
};

// Delete an endpoint
export const deleteEndpoint: RequestHandler = (req, res) => {
  const { endpointId } = req.params;
  const userId = getUserId(req);
  
  const index = userEndpoints.findIndex(e => e.id === endpointId && e.userId === userId);
  if (index === -1) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  const endpoint = userEndpoints[index];
  userEndpoints.splice(index, 1);
  
  // Also remove associated requests
  const requestIndicesToRemove = [];
  for (let i = capturedRequests.length - 1; i >= 0; i--) {
    if (capturedRequests[i].endpoint === `/catch/${endpoint.path}` && capturedRequests[i].userId === userId) {
      requestIndicesToRemove.push(i);
    }
  }
  
  requestIndicesToRemove.forEach(index => capturedRequests.splice(index, 1));
  
  res.json({ message: 'Endpoint deleted' });
};

// Get a specific request details
export const getRequestDetails: RequestHandler = (req, res) => {
  const { requestId } = req.params;
  const userId = getUserId(req);
  
  const request = capturedRequests.find(r => r.id === requestId && r.userId === userId);
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  res.json(request);
};
