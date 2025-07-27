import { RequestHandler } from "express";
import { UserService } from "../lib/database";
import { Role } from "@prisma/client";

// User credentials (in production, hash passwords properly)
// This should be moved to a proper auth service like Auth0, Okta, etc.
export const userCredentials: Record<string, string> = {
  "ashamah@paloaltonetworks.com": "admin2024!",
  "test@paloaltonetworks.com": "test123",
};

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

// Helper to check if user is admin
async function isAdmin(req: any): Promise<boolean> {
  const userId = getUserId(req);
  try {
    const user = await UserService.findUserById(userId);
    return user?.role === Role.ADMIN;
  } catch (error) {
    return false;
  }
}

// Get all users (admin only)
export const getAllUsers: RequestHandler = async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const users = await UserService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a new user (admin only)
export const createUser: RequestHandler = async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { email, name, password, role = "USER" } = req.body;

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
    const existingUser = await UserService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Create new user
    const newUser = await UserService.createUser({
      email,
      name,
      role: role === "ADMIN" ? Role.ADMIN : Role.USER,
      password,
    });

    // Store credentials
    userCredentials[email] = password;

    res.json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update user (admin only)
export const updateUser: RequestHandler = async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userId } = req.params;
    const { name, role, active } = req.body;

    const user = await UserService.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined)
      updateData.role = role === "ADMIN" ? Role.ADMIN : Role.USER;
    if (active !== undefined) updateData.active = active;

    const updatedUser = await UserService.updateUser(userId, updateData);

    res.json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete user (admin only)
export const deleteUser: RequestHandler = async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userId } = req.params;

    const user = await UserService.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't allow deleting the last admin
    if (user.role === Role.ADMIN) {
      const allUsers = await UserService.getAllUsers();
      const activeAdmins = allUsers.filter(
        (u) => u.role === Role.ADMIN && u.active,
      );
      if (activeAdmins.length === 1) {
        return res
          .status(400)
          .json({ error: "Cannot delete the last admin user" });
      }
    }

    // Remove user and credentials
    await UserService.deleteUser(userId);
    delete userCredentials[user.email];

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Enhanced authentication endpoint
export const authenticateUser: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check credentials
    if (userCredentials[email] !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Find user in database
    const user = await UserService.findUserByEmail(email);
    if (!user || !user.active) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // Update last login
    await UserService.updateLastLogin(user.id);

    // Return user data (without sensitive info)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase(),
      },
      token: user.id, // In production, use proper JWT
    });
  } catch (error) {
    console.error("Error authenticating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get current user info
export const getCurrentUser: RequestHandler = async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await UserService.findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase(),
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Reset user password (admin only)
export const resetUserPassword: RequestHandler = async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const user = await UserService.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    userCredentials[user.email] = newPassword;

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
