import { Controller, Post, Body, Get, Req, HttpCode, HttpStatus, Delete, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Request } from 'express';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.login(
      loginDto.email,
      loginDto.password,
      loginDto.tenantId,
      ipAddress,
      userAgent,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: { sessionId: string }) {
    return this.authService.logout(body.sessionId);
  }

  @Post('refresh')
  async refresh(@Body() body: { sessionId: string }, @Req() req: Request) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.refreshSession(body.sessionId, ipAddress, userAgent);
  }

  @Get('validate')
  async validate(@Req() req: Request) {
    const sessionId = req.headers['authorization']?.replace('Bearer ', '');

    if (!sessionId) {
      return {
        success: false,
        error: {
          code: 'NO_SESSION',
          message: 'No session provided',
        },
      };
    }

    const result = await this.authService.validateSession(sessionId);

    if (!result.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Invalid or expired session',
        },
      };
    }

    return {
      success: true,
      data: {
        user: result.user,
        isValid: true,
      },
      message: 'Session is valid',
    };
  }

  @Get('sessions')
  async getUserSessions(@Req() req: Request) {
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    if (!userId || !tenantId) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      };
    }

    return this.authService.getUserActiveSessions(userId, tenantId);
  }

  @Delete('sessions/:sessionId')
  async invalidateSession(@Param('sessionId') sessionId: string, @Req() req: Request) {
    return this.authService.logout(sessionId);
  }

  @Delete('sessions')
  async invalidateAllSessions(@Req() req: Request) {
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    if (!userId || !tenantId) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      };
    }

    return this.authService.invalidateAllUserSessions(userId, tenantId);
  }
}