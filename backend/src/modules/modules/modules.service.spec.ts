import { Test, TestingModule } from '@nestjs/testing';
import { ModulesService } from './modules.service';
import { PrismaService } from '../../common/services/prisma.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { MODULE_REGISTRY } from './constants/registry';

describe('ModulesService', () => {
  let service: ModulesService;
  let mockPrismaService: any;

  const tenantId = 'test-tenant-id';
  const userId = 'test-user-id';

  beforeEach(async () => {
    mockPrismaService = {
      configuration: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModulesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ModulesService>(ModulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getModules', () => {
    it('should return all registry modules with default values when no configurations exist', async () => {
      mockPrismaService.configuration.findMany.mockResolvedValue([]);

      const result = await service.getModules(tenantId);

      expect(result).toHaveLength(MODULE_REGISTRY.length);
      expect(mockPrismaService.configuration.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          key: { startsWith: 'modules.' },
        },
      });

      const coreModule = result.find((m) => m.id === 'core');
      expect(coreModule).toBeDefined();
      expect(coreModule?.enabled).toBe(true);

      const almacenesModule = result.find((m) => m.id === 'almacenes');
      expect(almacenesModule).toBeDefined();
      expect(almacenesModule?.enabled).toBe(true);
    });

    it('should overwrite defaults with values from database configurations', async () => {
      mockPrismaService.configuration.findMany.mockResolvedValue([
        {
          key: 'modules.almacenes.enabled',
          value: 'false',
        },
      ]);

      const result = await service.getModules(tenantId);
      const almacenesModule = result.find((m) => m.id === 'almacenes');
      expect(almacenesModule?.enabled).toBe(false);
    });
  });

  describe('toggleModule', () => {
    it('should throw NotFoundException if module does not exist in registry', async () => {
      await expect(
        service.toggleModule(tenantId, 'non-existent', { enabled: true }, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when trying to disable core module', async () => {
      await expect(
        service.toggleModule(tenantId, 'core', { enabled: false }, userId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when disabling a module that has active dependents', async () => {
      // production depends on almacenes.
      // So if we try to disable almacenes, and production is active (enabled: true), it should throw.
      mockPrismaService.configuration.findFirst.mockImplementation(async ({ where }) => {
        if (where.key === 'modules.production.enabled') {
          return { key: 'modules.production.enabled', value: 'true' };
        }
        return null;
      });

      await expect(
        service.toggleModule(tenantId, 'almacenes', { enabled: false }, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow disabling a module if its dependents are inactive', async () => {
      // production depends on almacenes.
      // If we disable almacenes and production is inactive (enabled: false or null/default false), it should work.
      mockPrismaService.configuration.findFirst.mockImplementation(async ({ where }) => {
        if (where.key === 'modules.production.enabled') {
          return null; // production is inactive
        }
        if (where.key === 'modules.almacenes.enabled') {
          return { key: 'modules.almacenes.enabled', value: 'false' };
        }
        return null;
      });
      mockPrismaService.configuration.upsert.mockResolvedValue({});

      const result = await service.toggleModule(tenantId, 'almacenes', { enabled: false }, userId);

      expect(mockPrismaService.configuration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_key: {
              tenantId,
              key: 'modules.almacenes.enabled',
            },
          },
          create: expect.objectContaining({
            value: 'false',
            updatedBy: userId,
          }),
        }),
      );
      expect(result.enabled).toBe(false);
    });

    it('should allow enabling any non-core module', async () => {
      mockPrismaService.configuration.upsert.mockResolvedValue({});
      mockPrismaService.configuration.findFirst.mockImplementation(async ({ where }) => {
        if (where.key === 'modules.almacenes.enabled') {
          return { key: 'modules.almacenes.enabled', value: 'true' };
        }
        return null;
      });

      const result = await service.toggleModule(tenantId, 'almacenes', { enabled: true }, userId);

      expect(mockPrismaService.configuration.upsert).toHaveBeenCalled();
      expect(result.enabled).toBe(true);
    });
  });
});
