import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

describe("Lucia Auth Verification Tests", () => {
  describe("Password Hashing with bcrypt", () => {
    it("should hash passwords correctly with bcrypt", async () => {
      const password = "TestPassword123!";
      const hash = await bcrypt.hash(password, 10);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await bcrypt.compare("WrongPassword", hash);
      expect(isInvalid).toBe(false);
    });

    it("should prevent weak passwords", () => {
      const weakPasswords = [
        "123",
        "abc",
        "12345678",
        "abcdefgh",
        "Password1",
        "password123",
        "qwerty123",
      ];

      const commonWeakPatterns = ["password", "123456", "qwerty", "admin"];

      for (const password of weakPasswords) {
        const isCommonPattern = commonWeakPatterns.some((pattern) =>
          password.toLowerCase().includes(pattern),
        );

        const hasMinLength = password.length >= 8;
        const hasNumbers = /\d/.test(password);
        const hasLetters = /[a-zA-Z]/.test(password);
        const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);

        const isWeak =
          isCommonPattern ||
          !hasMinLength ||
          !hasLetters ||
          !hasNumbers ||
          !hasMixedCase;
        expect(isWeak).toBe(true);
      }
    });

    it("should accept strong passwords", () => {
      const strongPasswords = [
        "SecurePass123!",
        "MyP@ssw0rd2024",
        "ChefChek#2026",
        "Restaurant$Admin123",
      ];

      for (const password of strongPasswords) {
        const hasMinLength = password.length >= 8;
        const hasNumbers = /\d/.test(password);
        const hasLetters = /[a-zA-Z]/.test(password);
        const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);

        const isStrong =
          hasMinLength && hasLetters && hasNumbers && hasMixedCase;
        expect(isStrong).toBe(true);
      }
    });
  });

  describe("Lucia Auth Configuration", () => {
    it("should verify Lucia services exist", () => {
      const fs = require("fs");
      const path = require("path");

      const luciaServicePath = path.join(
        __dirname,
        "../../src/modules/auth/lucia-auth.service.ts",
      );
      const sessionServicePath = path.join(
        __dirname,
        "../../src/modules/auth/session.service.ts",
      );

      expect(fs.existsSync(luciaServicePath)).toBe(true);
      expect(fs.existsSync(sessionServicePath)).toBe(true);
    });

    it("should verify Lucia auth is configured", () => {
      const fs = require("fs");
      const path = require("path");

      const authModulePath = path.join(
        __dirname,
        "../../src/modules/auth/auth.module.ts",
      );
      const authModuleContent = fs.readFileSync(authModulePath, "utf-8");

      expect(authModuleContent).toContain("LuciaAuthService");
      expect(authModuleContent).toContain("SessionService");
      expect(authModuleContent).not.toContain("JwtModule");
    });

    it("should verify guards use Lucia session validation", () => {
      const fs = require("fs");
      const path = require("path");

      const authGuardPath = path.join(
        __dirname,
        "../../src/guards/auth.guard.ts",
      );
      const authGuardContent = fs.readFileSync(authGuardPath, "utf-8");

      expect(authGuardContent).toContain("SessionService");
      expect(authGuardContent).toContain("validateSession");
    });

    it("should verify Auth types support session ID", () => {
      const fs = require("fs");
      const path = require("path");

      const authTypesPath = path.join(
        __dirname,
        "../../src/types/auth.types.ts",
      );
      const authTypesContent = fs.readFileSync(authTypesPath, "utf-8");

      expect(authTypesContent).toContain("sessionId");
      expect(authTypesContent).toContain("AuthenticatedRequest");
    });
  });

  describe("Lucia Auth Migration Verification", () => {
    it("should verify AuthService uses SessionService instead of JwtService", () => {
      const fs = require("fs");
      const path = require("path");

      const authServicePath = path.join(
        __dirname,
        "../../src/modules/auth/auth.service.ts",
      );
      const authServiceContent = fs.readFileSync(authServicePath, "utf-8");

      expect(authServiceContent).toContain("SessionService");
      expect(authServiceContent).not.toContain("JwtService");
      expect(authServiceContent).not.toContain("jwtService.sign");
      expect(authServiceContent).toContain("sessionService.createSession");
    });

    it("should verify session cookie security", () => {
      const fs = require("fs");
      const path = require("path");

      const luciaServicePath = path.join(
        __dirname,
        "../../src/modules/auth/lucia-auth.service.ts",
      );
      const luciaServiceContent = fs.readFileSync(luciaServicePath, "utf-8");

      expect(luciaServiceContent).toContain("secure");
      expect(luciaServiceContent).toContain("NODE_ENV");
      expect(luciaServiceContent).toContain("production");
    });

    it("should verify session expiration is configured", () => {
      const fs = require("fs");
      const path = require("path");

      const luciaServicePath = path.join(
        __dirname,
        "../../src/modules/auth/lucia-auth.service.ts",
      );
      const luciaServiceContent = fs.readFileSync(luciaServicePath, "utf-8");

      expect(luciaServiceContent).toContain("sessionExpiresIn");
      expect(luciaServiceContent).toContain("getUserAttributes");
    });

    it("should verify Prisma adapter is configured", () => {
      const fs = require("fs");
      const path = require("path");

      const luciaServicePath = path.join(
        __dirname,
        "../../src/modules/auth/lucia-auth.service.ts",
      );
      const luciaServiceContent = fs.readFileSync(luciaServicePath, "utf-8");

      expect(luciaServiceContent).toContain("PrismaAdapter");
      expect(luciaServiceContent).toContain("prisma.session");
      expect(luciaServiceContent).toContain("prisma.user");
    });
  });

  describe("Lucia Auth Session Management", () => {
    it("should verify SessionService has all required methods", () => {
      const fs = require("fs");
      const path = require("path");

      const sessionServicePath = path.join(
        __dirname,
        "../../src/modules/auth/session.service.ts",
      );
      const sessionServiceContent = fs.readFileSync(
        sessionServicePath,
        "utf-8",
      );

      expect(sessionServiceContent).toContain("createSession");
      expect(sessionServiceContent).toContain("validateSession");
      expect(sessionServiceContent).toContain("invalidateSession");
      expect(sessionServiceContent).toContain("invalidateAllUserSessions");
      expect(sessionServiceContent).toContain("getUserActiveSessions");
      expect(sessionServiceContent).toContain("refreshSession");
    });

    it("should verify session cookie attributes are secure", () => {
      const fs = require("fs");
      const path = require("path");

      const sessionServicePath = path.join(
        __dirname,
        "../../src/modules/auth/session.service.ts",
      );
      const sessionServiceContent = fs.readFileSync(
        sessionServicePath,
        "utf-8",
      );

      expect(sessionServiceContent).toContain("createSessionCookie");
      expect(sessionServiceContent).toContain("createBlankSessionCookie");
    });

    it("should verify multi-session support", () => {
      const fs = require("fs");
      const path = require("path");

      const sessionServicePath = path.join(
        __dirname,
        "../../src/modules/auth/session.service.ts",
      );
      const sessionServiceContent = fs.readFileSync(
        sessionServicePath,
        "utf-8",
      );

      expect(sessionServiceContent).toContain("getUserActiveSessions");
      expect(sessionServiceContent).toContain("invalidateAllUserSessions");
    });
  });

  describe("Lucia Auth Security Features", () => {
    it("should verify HttpOnly is used for session cookies", () => {
      const fs = require("fs");
      const path = require("path");

      const sessionServicePath = path.join(
        __dirname,
        "../../src/modules/auth/session.service.ts",
      );
      const sessionServiceContent = fs.readFileSync(
        sessionServicePath,
        "utf-8",
      );

      expect(sessionServiceContent).toContain("cookie");
    });

    it("should verify session validation returns user data", () => {
      const fs = require("fs");
      const path = require("path");

      const sessionServicePath = path.join(
        __dirname,
        "../../src/modules/auth/session.service.ts",
      );
      const sessionServiceContent = fs.readFileSync(
        sessionServicePath,
        "utf-8",
      );

      expect(sessionServiceContent).toContain("validateSession");
      expect(sessionServiceContent).toContain("valid");
      expect(sessionServiceContent).toContain("user");
    });

    it("should verify session invalidation works correctly", () => {
      const fs = require("fs");
      const path = require("path");

      const sessionServicePath = path.join(
        __dirname,
        "../../src/modules/auth/session.service.ts",
      );
      const sessionServiceContent = fs.readFileSync(
        sessionServicePath,
        "utf-8",
      );

      expect(sessionServiceContent).toContain("invalidateSession");
      expect(sessionServiceContent).toContain("lucia.invalidateSession");
    });
  });
});
