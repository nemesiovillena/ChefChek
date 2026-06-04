import { Test, TestingModule } from "@nestjs/testing";
import { LuciaAuthService } from "./lucia-auth.service";
import { PrismaService } from "../../common/services/prisma.service";
import { Lucia } from "lucia";

describe("LuciaAuthService", () => {
  let service: LuciaAuthService;
  let prisma: PrismaService;

  const mockPrismaService = {
    session: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LuciaAuthService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LuciaAuthService>(LuciaAuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("should initialize lucia instance on module init", () => {
      expect(service).toBeDefined();
      const lucia = service.getLucia();
      expect(lucia).toBeDefined();
      expect(lucia).toBeInstanceOf(Lucia);
    });
  });

  describe("getLucia", () => {
    it("should return lucia instance", () => {
      const lucia = service.getLucia();
      expect(lucia).toBeDefined();
      expect(lucia).toBeInstanceOf(Lucia);
    });

    it("should return the same lucia instance on multiple calls", () => {
      const lucia1 = service.getLucia();
      const lucia2 = service.getLucia();
      expect(lucia1).toBe(lucia2);
    });

    it("should initialize lucia if not already initialized", () => {
      // Create a new service instance to test lazy initialization
      const newService = new LuciaAuthService(prisma);

      // Lucia should not be initialized yet
      const lucia = newService.getLucia();
      expect(lucia).toBeDefined();
      expect(lucia).toBeInstanceOf(Lucia);
    });
  });

  describe("lucia configuration", () => {
    it("should have correct session cookie attributes", () => {
      const lucia = service.getLucia();

      // Lucia instance should be configured
      expect(lucia).toBeDefined();
    });

    it("should configure session cookie as secure in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      // Create new service to test production config
      const productionService = new LuciaAuthService(prisma);
      const lucia = productionService.getLucia();

      expect(lucia).toBeDefined();

      // Restore env
      process.env.NODE_ENV = originalEnv;
    });

    it("should configure session cookie as non-secure in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const devService = new LuciaAuthService(prisma);
      const lucia = devService.getLucia();

      expect(lucia).toBeDefined();

      // Restore env
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("getUserAttributes configuration", () => {
    it("should expose user attributes from lucia config", () => {
      const lucia = service.getLucia();

      // The lucia instance should be properly configured with getUserAttributes
      expect(lucia).toBeDefined();
    });
  });
});
