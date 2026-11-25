import {
  WebSocketGateway as WSGateway,
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
import { createAdapter } from "@socket.io/redis-adapter";
import {
  AuthenticatedSocket,
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types/events";
import { SessionService } from "../modules/auth/session.service";

@WSGateway({
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

  constructor(private readonly sessionService: SessionService) {}

  async afterInit(server: Server) {
    this.logger.log("WebSocket Gateway initialized");

    // El adaptador de Redis solo hace falta para repartir eventos entre varias
    // instancias del backend. Sin REDIS_URL/REDIS_HOST (producción corre una
    // sola instancia) Socket.IO usa su adaptador en memoria, que es lo correcto.
    const url =
      process.env.REDIS_URL ||
      (process.env.REDIS_HOST
        ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
        : null);
    if (!url) {
      this.logger.log(
        "WebSocket en una sola instancia (adaptador en memoria; sin REDIS_URL ni REDIS_HOST)",
      );
      return;
    }

    const pubClient = createClient({ url, database: 2 });
    const subClient = pubClient.duplicate();
    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log("Redis adapter configured for WebSocket");
    } catch (error) {
      // Sin Redis alcanzable se sigue en memoria; se cierran los clientes para
      // que no queden reintentando en segundo plano.
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
      this.logger.error(
        `No se pudo conectar a Redis (${url}); WebSocket sigue en una sola instancia`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Autenticación en curso de cada socket. El cliente emite joinTenant /
   * joinDashboard nada más conectar, antes de que handleConnection termine de
   * validar la sesión: los manejadores esperan a esta promesa en vez de leer
   * `client.data` vacío (antes entraban en salas `tenant:undefined…`).
   */
  private readonly authentications = new WeakMap<
    Socket,
    Promise<AuthenticatedSocket | null>
  >();

  async handleConnection(client: Socket) {
    const authentication = this.authenticate(client);
    this.authentications.set(client, authentication);
    await authentication;
  }

  private async authenticate(
    client: Socket,
  ): Promise<AuthenticatedSocket | null> {
    try {
      const sessionId =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace("Bearer ", "");

      if (!sessionId) {
        this.logger.warn(`Connection rejected: No session token provided`);
        this.reject(client, "Authentication required", "NO_TOKEN");
        return null;
      }

      const validation = await this.sessionService.validateSession(sessionId);

      if (!validation.valid || !validation.user) {
        this.logger.warn(`Connection rejected: Invalid session`);
        this.reject(client, "Invalid session", "INVALID_SESSION");
        return null;
      }

      const user = validation.user as any;
      const data: AuthenticatedSocket = {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
      };
      (client as any).data = data;

      // Sala del tenant (avisos generales) y del usuario (sendToUser).
      await client.join([`tenant:${data.tenantId}`, `user:${data.userId}`]);

      this.logger.log(
        `Client connected: userId=${data.userId}, tenantId=${data.tenantId}`,
      );

      client
        .to(`tenant:${data.tenantId}`)
        .emit("userJoined" as keyof ServerToClientEvents, {
          id: data.userId,
          name: user.name,
          email: user.email,
          role: data.role,
          tenantId: data.tenantId,
        });
      return data;
    } catch (error) {
      this.logger.error("Connection error:", error);
      this.reject(client, "Connection failed", "CONNECTION_ERROR");
      return null;
    }
  }

  private reject(client: Socket, message: string, code: string) {
    client.emit("error" as keyof ServerToClientEvents, { message, code });
    client.disconnect();
  }

  /** Datos del socket una vez autenticado; null si la sesión no era válida. */
  private async authenticated(
    client: Socket,
  ): Promise<AuthenticatedSocket | null> {
    return (await this.authentications.get(client)) ?? null;
  }

  async handleDisconnect(client: Socket) {
    const data = (client as any).data as AuthenticatedSocket | undefined;

    if (data?.tenantId) {
      this.logger.log(
        `Client disconnected: userId=${data.userId}, tenantId=${data.tenantId}`,
      );

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

  /**
   * La conexión ya mete al socket en la sala de su tenant; esto solo lo
   * confirma y rechaza pedir la sala de otro tenant.
   */
  @SubscribeMessage("joinTenant")
  async handleJoinTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() tenantId: string,
  ) {
    const data = await this.authenticated(client);
    if (!data) {
      return;
    }

    if (data.tenantId !== tenantId) {
      client.emit("error" as keyof ServerToClientEvents, {
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return;
    }

    await client.join(`tenant:${tenantId}`);
  }

  @SubscribeMessage("joinKitchen")
  async handleJoinKitchen(@ConnectedSocket() client: Socket) {
    const data = await this.authenticated(client);
    if (!data) {
      return;
    }
    const room = `tenant:${data.tenantId}:kitchen`;
    await client.join(room);
    this.logger.log(`Client joined kitchen room: ${room}`);
  }

  @SubscribeMessage("joinDashboard")
  async handleJoinDashboard(@ConnectedSocket() client: Socket) {
    const data = await this.authenticated(client);
    if (!data) {
      return;
    }
    const room = `tenant:${data.tenantId}:dashboard`;
    await client.join(room);
    this.logger.log(`Client joined dashboard room: ${room}`);
  }

  /** Solo salas propias del tenant del socket. */
  @SubscribeMessage("leaveRoom")
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ) {
    const data = await this.authenticated(client);
    if (!data || typeof room !== "string") {
      return;
    }
    if (!room.startsWith(`tenant:${data.tenantId}:`)) {
      return;
    }
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
