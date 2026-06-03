import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { AuthenticatedRequest } from "../../types/auth.types";

@ApiTags("Auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Iniciar sesión con email y contraseña" })
  @ApiResponse({ status: 200, description: "Login exitoso, retorna JWT token" })
  @ApiResponse({ status: 401, description: "Credenciales inválidas" })
  @ApiResponse({ status: 404, description: "Usuario no encontrado" })
  async login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const tenantSlug = req.tenantSlug || req.headers["x-tenant-slug"] as string;

    if (!tenantSlug) {
      return {
        success: false,
        error: {
          code: "TENANT_REQUIRED",
          message: "X-Tenant-Slug header is required",
        },
      };
    }

    return this.authService.login(
      loginDto.email,
      loginDto.password,
      tenantSlug,
      ipAddress,
      userAgent,
    );
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cerrar sesión" })
  @ApiBody({
    schema: { type: "object", properties: { sessionId: { type: "string" } } },
  })
  @ApiResponse({ status: 204, description: "Logout exitoso" })
  async logout(@Body() body: { sessionId: string }) {
    return this.authService.logout(body.sessionId);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refrescar token JWT" })
  @ApiBody({
    schema: { type: "object", properties: { sessionId: { type: "string" } } },
  })
  @ApiResponse({ status: 200, description: "Token refrescado exitosamente" })
  @ApiResponse({ status: 401, description: "Sesión inválida o expirada" })
  async refresh(
    @Body() body: { sessionId: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    return this.authService.refreshSession(
      body.sessionId,
      ipAddress,
      userAgent,
    );
  }

  @Get("validate")
  @ApiOperation({ summary: "Validar sesión actual" })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({ status: 200, description: "Sesión válida" })
  @ApiResponse({ status: 401, description: "Sesión inválida o expirada" })
  async validate(@Req() req: AuthenticatedRequest) {
    const sessionId = req.headers["authorization"]?.replace("Bearer ", "");

    if (!sessionId) {
      return {
        success: false,
        error: {
          code: "NO_SESSION",
          message: "No session provided",
        },
      };
    }

    const result = await this.authService.validateSession(sessionId);

    if (!result.valid) {
      return {
        success: false,
        error: {
          code: "INVALID_SESSION",
          message: "Invalid or expired session",
        },
      };
    }

    return {
      success: true,
      data: {
        user: result.user,
        isValid: true,
      },
      message: "Session is valid",
    };
  }

  @Get("sessions")
  @ApiOperation({ summary: "Obtener sesiones activas del usuario" })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({ status: 200, description: "Lista de sesiones activas" })
  @ApiResponse({ status: 401, description: "No autenticado" })
  async getUserSessions(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    if (!userId || !tenantId) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
      };
    }

    return this.authService.getUserActiveSessions(userId, tenantId);
  }

  @Delete("sessions/:sessionId")
  @ApiOperation({ summary: "Invalidar sesión específica" })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "sessionId", description: "ID de la sesión a invalidar" })
  @ApiResponse({ status: 200, description: "Sesión invalidada exitosamente" })
  async invalidateSession(
    @Param("sessionId") sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.logout(sessionId);
  }

  @Delete("sessions")
  @ApiOperation({ summary: "Invalidar todas las sesiones del usuario" })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: 200,
    description: "Todas las sesiones invalidadas exitosamente",
  })
  @ApiResponse({ status: 401, description: "No autenticado" })
  async invalidateAllSessions(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    if (!userId || !tenantId) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
      };
    }

    return this.authService.invalidateAllUserSessions(userId, tenantId);
  }
}
