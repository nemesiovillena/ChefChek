import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { createClient } from "redis";
import { RedisAdapter } from "@socket.io/redis-adapter";
import {
  AuthenticatedSocket,
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types/events";
import { SessionService } from "../modules/auth/session.service";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  namespace: "/api/v1/ws",
})
export class WebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(WebSocketGateway.name);
  private redisClient: ReturnType<typeof createClient>;
  private pubClient: ReturnType<typeof createClient>;
  private subClient: ReturnType<typeof createClient>;

  constructor(private readonly sessionService: SessionService) {}

  async afterInit(server: Server) {
    this.logger.log("WebSocket Gateway initialized");

    // Configure Redis adapter for multi-instance support
    try {
      this.redisClient = createClient({
        url:
          process.env.REDIS_URL ||
          `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
        database: 2, // Separate DB for WebSocket
      });

      this.pubClient = this.redisClient.duplicate();
      this.subClient = this.redisClient.duplicate();

      await Promise.all([
        this.redisClient.connect(),
        this.pubClient.connect(),
        this.subClient.connect(),
      ]);

      const redisAdapter = new RedisAdapter({
        pubClient: this.pubClient as any,
        subClient: this.subClient as any,
      });

      server.adapter(redisAdapter);
      this.logger.log("Redis adapter configured for WebSocket");
    } catch (error) {
      this.logger.error("Failed to configure Redis adapter:", error);
      this.logger.warn("WebSocket will work in single-instance mode");
    }
  }

  async handleConnection(client: Socket) {
    try {
      // Authenticate session
      const sessionId =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace("Bearer ", "");

      if (!sessionId) {
        this.logger.warn(`Connection rejected: No session token provided`);
        client.emit("error" as keyof ServerToClientEvents, {
          message: "Authentication required",
          code: "NO_TOKEN",
        });
        client.disconnect();
        return;
      }

      const validation = await this.sessionService.validateSession(sessionId);

      if (!validation.valid || !validation.user) {
        this.logger.warn(`Connection rejected: Invalid session`);
        client.emit("error" as keyof ServerToClientEvents, {
          message: "Invalid session",
          code: "INVALID_SESSION",
        });
        client.disconnect();
        return;
      }

      // Attach user data to socket
      (client as any).data = {
        userId: validation.user.id,
        tenantId: validation.user.tenantId,
        role: (validation.user as any).role,
        sessionId,
      } as AuthenticatedSocket;

      // Join tenant room
      const tenantId = validation.user.tenantId;
      await client.join(`tenant:${tenantId}`);

      this.logger.log(
        `Client connected: userId=${validation.user.id}, tenantId=${tenantId}`,
      );

      // Notify others
      client
        .to(`tenant:${tenantId}`)
        .emit("userJoined" as keyof ServerToClientEvents, {
          id: validation.user.id,
          name: (validation.user as any).name,
          email: (validation.user as any).email,
          role: (validation.user as any).role,
          tenantId,
        });
    } catch (error) {
      this.logger.error("Connection error:", error);
      client.emit("error" as keyof ServerToClientEvents, {
        message: "Connection failed",
        code: "CONNECTION_ERROR",
      });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const data = (client as any).data as AuthenticatedSocket;

    if (data) {
      this.logger.log(
        `Client disconnected: userId=${data.userId}, tenantId=${data.tenantId}`,
      );

      // Notify others
      client
        .to(`tenant:${data.tenantId}`)
        .emit("userLeft" as keyof ServerToClientEvents, {
          id: data.userId,
          name: data.userId, // We don't have name in socket data
          email: data.userId,
          role: data.role,
          tenantId: data.tenantId,
        });
    }
  }

  @SubscribeMessage("joinTenant")
  async handleJoinTenant(@ConnectedSocket() client: Socket, tenantId: string) {
    const data = (client as any).data as AuthenticatedSocket;

    if (data.tenantId !== tenantId) {
      client.emit("error" as keyof ServerToClientEvents, {
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return;
    }

    await client.join(`tenant:${tenantId}`);
    this.logger.log(`Client joined tenant room: ${tenantId}`);
  }

  @SubscribeMessage("joinKitchen")
  async handleJoinKitchen(@ConnectedSocket() client: Socket) {
    const data = (client as any).data as AuthenticatedSocket;
    const room = `tenant:${data.tenantId}:kitchen`;
    await client.join(room);
    this.logger.log(`Client joined kitchen room: ${room}`);
  }

  @SubscribeMessage("joinDashboard")
  async handleJoinDashboard(@ConnectedSocket() client: Socket) {
    const data = (client as any).data as AuthenticatedSocket;
    const room = `tenant:${data.tenantId}:dashboard`;
    await client.join(room);
    this.logger.log(`Client joined dashboard room: ${room}`);
  }

  @SubscribeMessage("leaveRoom")
  async handleLeaveRoom(@ConnectedSocket() client: Socket, room: string) {
    await client.leave(room);
    this.logger.log(`Client left room: ${room}`);
  }

  // Utility methods to broadcast events
  broadcastToTenant(
    tenantId: string,
    event: keyof ServerToClientEvents,
    data: any,
  ) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
    this.logger.debug(`Broadcast to tenant ${tenantId}: ${event}`);
  }

  broadcastToKitchen(
    tenantId: string,
    event: keyof ServerToClientEvents,
    data: any,
  ) {
    this.server.to(`tenant:${tenantId}:kitchen`).emit(event, data);
    this.logger.debug(`Broadcast to kitchen ${tenantId}: ${event}`);
  }

  broadcastToDashboard(
    tenantId: string,
    event: keyof ServerToClientEvents,
    data: any,
  ) {
    this.server.to(`tenant:${tenantId}:dashboard`).emit(event, data);
    this.logger.debug(`Broadcast to dashboard ${tenantId}: ${event}`);
  }

  sendToUser(userId: string, event: keyof ServerToClientEvents, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
    this.logger.debug(`Send to user ${userId}: ${event}`);
  }
}
