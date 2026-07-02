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
import { LoginDto, SuperadminLoginDto } from "./dto/login.dto";
import { AuthenticatedRequest } from "../../types/auth.types";

@ApiTags("Auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Iniciar sesión con email y contraseña" })
  @ApiResponse({
    status: 200,
    description: "Login exitoso, retorna sesión Lucía",
  })
  @ApiResponse({ status: 401, description: "Credenciales inválidas" })
  @ApiResponse({ status: 404, description: "Usuario no encontrado" })
  async login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const tenantSlug =
      req.tenantSlug || (req.headers["x-tenant-slug"] as string);

    if (!tenantSlug) {
      return {
        success: false,
        error: {
          code: "TENANT_REQUIRED",
          message: "X-Tenant-Slug header is required",
        },
      };
    }

    // Validar formato de tenantSlug: alfanumérico con guiones bajos, minúsculas
    // Previne SQL injection y valores inválidos
    const tenantSlugRegex = /^[a-z0-9_-]+$/;
    if (!tenantSlugRegex.test(tenantSlug)) {
      return {
        success: false,
        error: {
          code: "INVALID_TENANT_SLUG",
          message:
            "Tenant slug must contain only lowercase letters, numbers, hyphens and underscores",
        },
      };
    }

    // Validar longitud (mínimo 3, máximo 50 caracteres)
    if (tenantSlug.length < 3 || tenantSlug.length > 50) {
      return {
        success: false,
        error: {
          code: "INVALID_TENANT_SLUG_LENGTH",
          message: "Tenant slug must be between 3 and 50 characters",
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

  @Post("superadmin/login")
  @ApiOperation({ summary: "Login exclusivo para SUPERADMIN (sin tenant)" })
  @ApiResponse({ status: 200, description: "Login exitoso" })
  @ApiResponse({ status: 401, description: "Credenciales inválidas" })
  async superadminLogin(
    @Body() dto: SuperadminLoginDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    return this.authService.superadminLogin(
      dto.email,
      dto.password,
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
  @ApiOperation({ summary: "Refrescar sesión Lucía" })
  @ApiBody({
    schema: { type: "object", properties: { sessionId: { type: "string" } } },
  })
  @ApiResponse({ status: 200, description: "Sesión refrescada exitosamente" })
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
