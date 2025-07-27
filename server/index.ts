import "dotenv/config";
import express from "express";
import cors from "cors";
import { checkDatabaseConnection } from "./lib/database";
import { handleDemo } from "./routes/demo";
import {
  createEndpoint,
  getUserEndpoints,
  getCapturedRequests,
  configureMockResponse,
  catchRequest,
  deleteEndpoint,
  getRequestDetails,
} from "./routes/parrot";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  authenticateUser,
  getCurrentUser,
  resetUserPassword,
} from "./routes/admin";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check routes
  app.get("/api/ping", async (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    const dbConnected = await checkDatabaseConnection();
    res.json({
      message: ping,
      database: dbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/demo", handleDemo);

  // Authentication routes
  app.post("/api/auth/login", authenticateUser);
  app.get("/api/auth/user", getCurrentUser);

  // Admin routes
  app.get("/api/admin/users", getAllUsers);
  app.post("/api/admin/users", createUser);
  app.put("/api/admin/users/:userId", updateUser);
  app.delete("/api/admin/users/:userId", deleteUser);
  app.post("/api/admin/users/:userId/reset-password", resetUserPassword);

  // PAN Parrot API routes
  app.post("/api/endpoints", createEndpoint);
  app.get("/api/endpoints", getUserEndpoints);
  app.delete("/api/endpoints/:endpointId", deleteEndpoint);
  app.post("/api/endpoints/:endpointId/mock", configureMockResponse);

  app.get("/api/requests", getCapturedRequests);
  app.get("/api/requests/:requestId", getRequestDetails);

  // Dynamic catch-all routes for user endpoints (must be last)
  app.all("/catch/:path", catchRequest);

  return app;
}
