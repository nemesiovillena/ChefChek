import { Test, TestingModule } from "@nestjs/testing";
import { WebSocketGateway } from "./websocket.gateway";
import { SessionService } from "../modules/auth/session.service";
import { Socket, Server } from "socket.io";

// Mock de redis
jest.mock("redis", () => {
  const mockConnect = jest.fn().mockResolvedValue(undefined);
  const mockDuplicate = jest.fn().mockImplementation(() => {
    return {
      connect: mockConnect,
    };
  });
  return {
    createClient: jest.fn().mockImplementation(() => {
      return {
        connect: mockConnect,
        duplicate: mockDuplicate,
      };
    }),
  };
});

// Mock de RedisAdapter
jest.mock("@socket.io/redis-adapter", () => {
  return {
    RedisAdapter: jest.fn(),
  };
});

describe("WebSocketGateway", () => {
  let gateway: WebSocketGateway;
  let sessionService: { validateSession: jest.Mock };
  let mockServer: any;

  beforeEach(async () => {
    sessionService = { validateSession: jest.fn() };

    mockServer = {
      adapter: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketGateway,
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    gateway = module.get<WebSocketGateway>(WebSocketGateway);
    gateway.server = mockServer as unknown as Server;
  });

  it("should be defined", () => {
    expect(gateway).toBeDefined();
  });

  describe("afterInit", () => {
    it("should initialize Redis adapter", async () => {
      const loggerSpy = jest.spyOn((gateway as any).logger, "log");
      await gateway.afterInit(mockServer);
      expect(loggerSpy).toHaveBeenCalledWith(
        "Redis adapter configured for WebSocket",
      );
    });
  });

  describe("handleConnection", () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        handshake: {
          auth: {},
          headers: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        to: jest.fn().mockReturnThis(),
      };
    });

    it("should reject connection if no token is provided", async () => {
      await gateway.handleConnection(mockSocket as unknown as Socket);

      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Authentication required",
        code: "NO_TOKEN",
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should reject connection if session is invalid", async () => {
      mockSocket.handshake.auth.token = "invalid-token";
      sessionService.validateSession.mockResolvedValue({ valid: false });

      await gateway.handleConnection(mockSocket as unknown as Socket);

      expect(sessionService.validateSession).toHaveBeenCalledWith(
        "invalid-token",
      );
      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Invalid session",
        code: "INVALID_SESSION",
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should accept connection, join tenant room, and notify others", async () => {
      mockSocket.handshake.auth.token = "valid-token";
      const mockUser = {
        id: "u-1",
        name: "Chef",
        email: "chef@chefchek.com",
        tenantId: "t-1",
        role: "ADMIN",
      };
      sessionService.validateSession.mockResolvedValue({
        valid: true,
        user: mockUser,
      });

      await gateway.handleConnection(mockSocket as unknown as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith("tenant:t-1");
      expect(mockSocket.to).toHaveBeenCalledWith("tenant:t-1");
      expect(mockSocket.emit).toHaveBeenCalledWith("userJoined", {
        id: "u-1",
        name: "Chef",
        email: "chef@chefchek.com",
        role: "ADMIN",
        tenantId: "t-1",
      });
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe("handleDisconnect", () => {
    it("should notify others in the tenant room when client disconnects", async () => {
      const mockSocket = {
        data: {
          userId: "u-1",
          tenantId: "t-1",
          role: "ADMIN",
        },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as any;

      await gateway.handleDisconnect(mockSocket as unknown as Socket);

      expect(mockSocket.to).toHaveBeenCalledWith("tenant:t-1");
      expect(mockSocket.emit).toHaveBeenCalledWith("userLeft", {
        id: "u-1",
        name: "u-1",
        email: "u-1",
        role: "ADMIN",
        tenantId: "t-1",
      });
    });
  });

  describe("room subscriptions", () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        data: {
          userId: "u-1",
          tenantId: "t-1",
        },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      };
    });

    it("should allow join Tenant room if tenantId matches socket data", async () => {
      await gateway.handleJoinTenant(mockSocket, "t-1");
      expect(mockSocket.join).toHaveBeenCalledWith("tenant:t-1");
      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        "error",
        expect.any(Object),
      );
    });

    it("should refuse join Tenant room if tenantId does not match", async () => {
      await gateway.handleJoinTenant(mockSocket, "t-different");
      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    });

    it("should allow joining kitchen room", async () => {
      await gateway.handleJoinKitchen(mockSocket);
      expect(mockSocket.join).toHaveBeenCalledWith("tenant:t-1:kitchen");
    });

    it("should allow joining dashboard room", async () => {
      await gateway.handleJoinDashboard(mockSocket);
      expect(mockSocket.join).toHaveBeenCalledWith("tenant:t-1:dashboard");
    });

    it("should allow leaving room", async () => {
      await gateway.handleLeaveRoom(mockSocket, "some-room");
      expect(mockSocket.leave).toHaveBeenCalledWith("some-room");
    });
  });

  describe("broadcasting utilities", () => {
    it("should emit to tenant room", () => {
      gateway.broadcastToTenant("t-1", "userJoined", { data: 123 });
      expect(mockServer.to).toHaveBeenCalledWith("tenant:t-1");
      expect(mockServer.emit).toHaveBeenCalledWith("userJoined", { data: 123 });
    });

    it("should emit to kitchen room", () => {
      gateway.broadcastToKitchen("t-1", "orderCreated", { data: 456 });
      expect(mockServer.to).toHaveBeenCalledWith("tenant:t-1:kitchen");
      expect(mockServer.emit).toHaveBeenCalledWith("orderCreated", {
        data: 456,
      });
    });

    it("should emit to dashboard room", () => {
      gateway.broadcastToDashboard("t-1", "stockLow", { data: 789 });
      expect(mockServer.to).toHaveBeenCalledWith("tenant:t-1:dashboard");
      expect(mockServer.emit).toHaveBeenCalledWith("stockLow", { data: 789 });
    });

    it("should emit to user room", () => {
      gateway.sendToUser("u-1", "notification", { data: "hello" });
      expect(mockServer.to).toHaveBeenCalledWith("user:u-1");
      expect(mockServer.emit).toHaveBeenCalledWith("notification", {
        data: "hello",
      });
    });
  });
});
