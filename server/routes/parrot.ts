import { RequestHandler } from "express";
import { EndpointService, RequestService, UserService } from "../lib/database";

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
export const createEndpoint: RequestHandler = async (req, res) => {
  try {
    const { name, customPath, description } = req.body;
    const userId = getUserId(req);

    const path = customPath || Math.random().toString(36).substr(2, 8);
    const url = `${req.protocol}://${req.get('host')}/catch/${path}`;

    // Check if path already exists
    const existingEndpoint = await EndpointService.findEndpointByPath(path);
    if (existingEndpoint) {
      return res.status(400).json({ error: 'Path already exists' });
    }

    const endpoint = await EndpointService.createEndpoint({
      name: name || 'Untitled Endpoint',
      path,
      url,
      description,
      userId
    });

    res.json(endpoint);
  } catch (error) {
    console.error('Error creating endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's endpoints
export const getUserEndpoints: RequestHandler = async (req, res) => {
  try {
    const userId = getUserId(req);
    const endpoints = await EndpointService.getUserEndpoints(userId);

    // Transform the data to match frontend expectations
    const endpointsWithCounts = endpoints.map(endpoint => ({
      ...endpoint,
      requests: endpoint._count.requests,
      created: endpoint.createdAt.toISOString()
    }));

    res.json(endpointsWithCounts);
  } catch (error) {
    console.error('Error getting user endpoints:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get captured requests for user
export const getCapturedRequests: RequestHandler = async (req, res) => {
  try {
    const userId = getUserId(req);
    const requests = await RequestService.getUserRequests(userId);

    // Transform the data to match frontend expectations
    const transformedRequests = requests.map(request => ({
      ...request,
      endpoint: `/catch/${request.endpoint?.path || request.path}`,
      timestamp: request.createdAt.toISOString()
    }));

    res.json(transformedRequests);
  } catch (error) {
    console.error('Error getting captured requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Configure mock response for an endpoint
export const configureMockResponse: RequestHandler = async (req, res) => {
  try {
    const { endpointId } = req.params;
    const { statusCode, headers, body, delay } = req.body;
    const userId = getUserId(req);

    const endpoint = await EndpointService.findEndpointById(endpointId);
    if (!endpoint || endpoint.userId !== userId) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    await EndpointService.configureMockResponse(endpointId, {
      mockEnabled: true,
      mockStatusCode: statusCode || 200,
      mockHeaders: headers || { 'Content-Type': 'application/json' },
      mockBody: body || '{"status": "success"}',
      mockDelay: delay || 0
    });

    res.json({ message: 'Mock response configured' });
  } catch (error) {
    console.error('Error configuring mock response:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// The main catch-all handler for user endpoints
export const catchRequest: RequestHandler = async (req, res) => {
  try {
    const { path } = req.params;

    // Find the endpoint
    const endpoint = await EndpointService.findEndpointByPath(path);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    let responseStatus = 200;

    // Check if there's a mock response configured
    if (endpoint.mockEnabled && endpoint.mockStatusCode) {
      responseStatus = endpoint.mockStatusCode;

      // Apply delay if configured
      if (endpoint.mockDelay && endpoint.mockDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, endpoint.mockDelay));
      }

      // Set custom headers
      if (endpoint.mockHeaders) {
        const headers = endpoint.mockHeaders as Record<string, string>;
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
    }

    // Capture the request
    await RequestService.captureRequest({
      method: req.method,
      path: `/catch/${path}`,
      status: responseStatus,
      ip: req.ip || (req.connection as any)?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      headers: req.headers,
      body: req.body,
      query: req.query,
      userId: endpoint.userId,
      endpointId: endpoint.id
    });

    // Return mock response if configured
    if (endpoint.mockEnabled && endpoint.mockBody) {
      return res.status(responseStatus).send(endpoint.mockBody);
    }

    // Default response
    res.status(responseStatus).json({
      message: `Hello from PAN Parrot! 🦜`,
      timestamp: new Date().toISOString(),
      method: req.method,
      endpoint: path,
      captured: true
    });
  } catch (error) {
    console.error('Error handling catch request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete an endpoint
export const deleteEndpoint: RequestHandler = async (req, res) => {
  try {
    const { endpointId } = req.params;
    const userId = getUserId(req);

    const endpoint = await EndpointService.findEndpointById(endpointId);
    if (!endpoint || endpoint.userId !== userId) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    await EndpointService.deleteEndpoint(endpointId);

    res.json({ message: 'Endpoint deleted' });
  } catch (error) {
    console.error('Error deleting endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a specific request details
export const getRequestDetails: RequestHandler = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = getUserId(req);

    const request = await RequestService.getRequestById(requestId);
    if (!request || request.userId !== userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Transform the data to match frontend expectations
    const transformedRequest = {
      ...request,
      endpoint: `/catch/${request.endpoint?.path || request.path}`,
      timestamp: request.createdAt.toISOString()
    };

    res.json(transformedRequest);
  } catch (error) {
    console.error('Error getting request details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
