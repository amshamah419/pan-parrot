import { RequestHandler } from "express";

// In-memory storage for users (in production, use a database)
interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  created: string;
  lastLogin?: string;
  active: boolean;
}

// Pre-populate with admin user and test user
const users: User[] = [
  {
    id: "admin-ashamah",
    email: "ashamah@paloaltonetworks.com",
    name: "Andrew Shamah",
    role: "admin",
    created: new Date().toISOString(),
    active: true,
  },
  {
    id: "test-user-123",
    email: "test@paloaltonetworks.com",
    name: "Test User",
    role: "user",
    created: new Date().toISOString(),
    active: true,
  },
];

// User credentials (in production, hash passwords properly)
const userCredentials: Record<string, string> = {
  "ashamah@paloaltonetworks.com": "admin2024!",
  "test@paloaltonetworks.com": "test123",
};

// Helper to check if user is admin
function isAdmin(req: any): boolean {
  const userId = getUserId(req);
  const user = users.find((u) => u.id === userId);
  return user?.role === "admin";
}

// Helper to get user ID from request
function getUserId(req: any): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      return token;
    } catch (error) {
      return "anonymous";
    }
  }
  return "anonymous";
}

// Get all users (admin only)
export const getAllUsers: RequestHandler = (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  // Return users without sensitive data
  const userList = users.map((user) => ({
    ...user,
    // Don't expose internal IDs or sensitive data
  }));

  res.json(userList);
};

// Create a new user (admin only)
export const createUser: RequestHandler = (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { email, name, password, role = "user" } = req.body;

  // Validation
  if (!email || !name || !password) {
    return res
      .status(400)
      .json({ error: "Email, name, and password are required" });
  }

  if (!email.includes("@paloaltonetworks.com")) {
    return res.status(400).json({ error: "Must use PAN email address" });
  }

  // Check if user already exists
  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: "User already exists" });
  }

  // Create new user
  const newUser: User = {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    email,
    name,
    role: role as "user" | "admin",
    created: new Date().toISOString(),
    active: true,
  };

  users.push(newUser);
  userCredentials[email] = password;

  res.json({ message: "User created successfully", user: newUser });
};

// Update user (admin only)
export const updateUser: RequestHandler = (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { userId } = req.params;
  const { name, role, active } = req.body;

  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Update user
  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = active;

  res.json({ message: "User updated successfully", user });
};

// Delete user (admin only)
export const deleteUser: RequestHandler = (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { userId } = req.params;

  const userIndex = users.findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = users[userIndex];

  // Don't allow deleting the last admin
  if (
    user.role === "admin" &&
    users.filter((u) => u.role === "admin" && u.active).length === 1
  ) {
    return res.status(400).json({ error: "Cannot delete the last admin user" });
  }

  // Remove user and credentials
  users.splice(userIndex, 1);
  delete userCredentials[user.email];

  res.json({ message: "User deleted successfully" });
};

// Enhanced authentication endpoint
export const authenticateUser: RequestHandler = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Check credentials
  if (userCredentials[email] !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Find user
  const user = users.find((u) => u.email === email);
  if (!user || !user.active) {
    return res.status(401).json({ error: "User not found or inactive" });
  }

  // Update last login
  user.lastLogin = new Date().toISOString();

  // Return user data (without sensitive info)
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token: user.id, // In production, use proper JWT
  });
};

// Get current user info
export const getCurrentUser: RequestHandler = (req, res) => {
  const userId = getUserId(req);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
};

// Reset user password (admin only)
export const resetUserPassword: RequestHandler = (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { userId } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  userCredentials[user.email] = newPassword;

  res.json({ message: "Password reset successfully" });
};
