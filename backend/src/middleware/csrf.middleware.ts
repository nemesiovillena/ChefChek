import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly csrfTokens = new Map<
    string,
    { token: string; expiresAt: number }
  >();
  private readonly TOKEN_EXPIRY = 30 * 60 * 1000; // 30 minutes

  use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      this.generateCsrfToken(req, res);
      return next();
    }

    // Validate CSRF token for state-changing requests
    const csrfToken = req.headers["x-csrf-token"] as string;
    const sessionToken = req.headers["x-session-token"] as string;

    if (!csrfToken || !sessionToken) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "CSRF token is required for state-changing requests",
      });
    }

    if (!this.validateCsrfToken(sessionToken, csrfToken)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Invalid CSRF token",
      });
    }

    next();
  }

  private generateCsrfToken(req: Request, res: Response): void {
    const sessionToken = req.headers["x-session-token"] as string;

    if (!sessionToken) {
      // Generate a session token for new sessions
      const newSessionToken = this.generateSecureToken();
      res.setHeader("X-Session-Token", newSessionToken);

      const csrfToken = this.generateSecureToken();
      this.csrfTokens.set(newSessionToken, {
        token: csrfToken,
        expiresAt: Date.now() + this.TOKEN_EXPIRY,
      });

      res.setHeader("X-CSRF-Token", csrfToken);
      return;
    }

    // Check if we already have a CSRF token for this session
    const existing = this.csrfTokens.get(sessionToken);

    if (existing && Date.now() < existing.expiresAt) {
      res.setHeader("X-CSRF-Token", existing.token);
    } else {
      // Generate new CSRF token
      const csrfToken = this.generateSecureToken();
      this.csrfTokens.set(sessionToken, {
        token: csrfToken,
        expiresAt: Date.now() + this.TOKEN_EXPIRY,
      });

      res.setHeader("X-CSRF-Token", csrfToken);
    }
  }

  private validateCsrfToken(sessionToken: string, csrfToken: string): boolean {
    const stored = this.csrfTokens.get(sessionToken);

    if (!stored) {
      return false;
    }

    // Check if token expired
    if (Date.now() > stored.expiresAt) {
      this.csrfTokens.delete(sessionToken);
      return false;
    }

    return stored.token === csrfToken;
  }

  private generateSecureToken(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}`;
  }

  // Clean up expired tokens
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.csrfTokens.entries()) {
      if (now > value.expiresAt) {
        this.csrfTokens.delete(key);
      }
    }
  }
}
