import {
  PrismaClient,
  User,
  Endpoint,
  CapturedRequest,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

// Database connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

// User operations
export class UserService {
  static async createUser(data: {
    email: string;
    name: string;
    role?: Role;
    password: string;
  }): Promise<User> {
    const { password, ...userData } = data;

    // Store password in separate credentials table or external auth service
    // For now, we'll still use in-memory credentials store
    const user = await prisma.user.create({
      data: userData,
    });

    return user;
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  static async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async getAllUsers(): Promise<User[]> {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async updateUser(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  static async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  static async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }
}

// Endpoint operations
export class EndpointService {
  static async createEndpoint(data: {
    name: string;
    path: string;
    url: string;
    description?: string;
    userId: string;
  }): Promise<Endpoint> {
    return prisma.endpoint.create({
      data,
    });
  }

  static async getUserEndpoints(
    userId: string,
  ): Promise<(Endpoint & { _count: { requests: number } })[]> {
    return prisma.endpoint.findMany({
      where: { userId },
      include: {
        _count: {
          select: { requests: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async findEndpointByPath(path: string): Promise<Endpoint | null> {
    return prisma.endpoint.findUnique({
      where: { path },
    });
  }

  static async findEndpointById(id: string): Promise<Endpoint | null> {
    return prisma.endpoint.findUnique({
      where: { id },
    });
  }

  static async updateEndpoint(
    id: string,
    data: Partial<Endpoint>,
  ): Promise<Endpoint> {
    return prisma.endpoint.update({
      where: { id },
      data,
    });
  }

  static async deleteEndpoint(id: string): Promise<void> {
    await prisma.endpoint.delete({
      where: { id },
    });
  }

  static async configureMockResponse(
    id: string,
    config: {
      mockEnabled: boolean;
      mockStatusCode?: number;
      mockHeaders?: any;
      mockBody?: string;
      mockDelay?: number;
    },
  ): Promise<Endpoint> {
    return prisma.endpoint.update({
      where: { id },
      data: config,
    });
  }
}

// Request operations
export class RequestService {
  static async captureRequest(data: {
    method: string;
    path: string;
    status: number;
    ip?: string;
    userAgent?: string;
    headers: any;
    body?: any;
    query?: any;
    userId: string;
    endpointId: string;
  }): Promise<CapturedRequest> {
    return prisma.capturedRequest.create({
      data,
    });
  }

  static async getUserRequests(
    userId: string,
    limit = 100,
  ): Promise<CapturedRequest[]> {
    return prisma.capturedRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        endpoint: {
          select: {
            name: true,
            path: true,
          },
        },
      },
    });
  }

  static async getRequestById(id: string): Promise<CapturedRequest | null> {
    return prisma.capturedRequest.findUnique({
      where: { id },
      include: {
        endpoint: {
          select: {
            name: true,
            path: true,
          },
        },
      },
    });
  }

  static async deleteOldRequests(daysOld = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.capturedRequest.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  static async getRequestStats(userId: string): Promise<{
    totalRequests: number;
    requestsToday: number;
    topMethods: { method: string; count: number }[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalRequests, requestsToday, methodStats] = await Promise.all([
      prisma.capturedRequest.count({
        where: { userId },
      }),
      prisma.capturedRequest.count({
        where: {
          userId,
          createdAt: { gte: today },
        },
      }),
      prisma.capturedRequest.groupBy({
        by: ["method"],
        where: { userId },
        _count: {
          method: true,
        },
        orderBy: {
          _count: {
            method: "desc",
          },
        },
        take: 5,
      }),
    ]);

    const topMethods = methodStats.map((stat) => ({
      method: stat.method,
      count: stat._count.method,
    }));

    return {
      totalRequests,
      requestsToday,
      topMethods,
    };
  }
}

// Database cleanup and maintenance
export class MaintenanceService {
  static async cleanup(): Promise<{
    deletedRequests: number;
    totalUsers: number;
    totalEndpoints: number;
    totalRequests: number;
  }> {
    const deletedRequests = await RequestService.deleteOldRequests(30);

    const [totalUsers, totalEndpoints, totalRequests] = await Promise.all([
      prisma.user.count(),
      prisma.endpoint.count(),
      prisma.capturedRequest.count(),
    ]);

    return {
      deletedRequests,
      totalUsers,
      totalEndpoints,
      totalRequests,
    };
  }

  static async getDatabaseStats(): Promise<{
    users: number;
    endpoints: number;
    requests: number;
    activeUsers: number;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [users, endpoints, requests, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.endpoint.count(),
      prisma.capturedRequest.count(),
      prisma.user.count({
        where: {
          lastLogin: {
            gte: sevenDaysAgo,
          },
        },
      }),
    ]);

    return {
      users,
      endpoints,
      requests,
      activeUsers,
    };
  }
}

export { prisma };
