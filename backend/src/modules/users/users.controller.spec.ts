import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto } from "./dto/create-user.dto";
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("UsersController", () => {
  let controller: UsersController;

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: {
      id: "user-1",
      role: "ADMIN",
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a user successfully", async () => {
      const createUserDto: CreateUserDto = {
        tenantId: "tenant-1",
        email: "newuser@test.com",
        password: "password123",
        name: "New User",
        role: "USER",
      };

      const expectedResult = {
        success: true,
        data: {
          id: "user-2",
          email: "newuser@test.com",
          name: "New User",
          role: "USER",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: "User created successfully",
      };

      mockUsersService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createUserDto, mockReq);

      expect(mockUsersService.create).toHaveBeenCalledWith(
        createUserDto,
        "tenant-1",
      );
      expect(result.success).toBe(true);
      expect(result.data.email).toBe("newuser@test.com");
    });

    it("should throw ForbiddenException when creating user for different tenant", async () => {
      const createUserDto: CreateUserDto = {
        tenantId: "different-tenant",
        email: "user@test.com",
        password: "password123",
        name: "User",
      };

      mockUsersService.create.mockRejectedValue(
        new ForbiddenException("Cannot create user for different tenant"),
      );

      await expect(controller.create(createUserDto, mockReq)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ConflictException if user already exists", async () => {
      const createUserDto: CreateUserDto = {
        tenantId: "tenant-1",
        email: "existing@test.com",
        password: "password123",
        name: "Existing User",
      };

      mockUsersService.create.mockRejectedValue(
        new ConflictException("User already exists in this tenant"),
      );

      await expect(controller.create(createUserDto, mockReq)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw NotFoundException if tenant not found", async () => {
      const createUserDto: CreateUserDto = {
        tenantId: "tenant-1",
        email: "user@test.com",
        password: "password123",
        name: "User",
      };

      mockUsersService.create.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(controller.create(createUserDto, mockReq)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated list of users with default pagination", async () => {
      const expectedResult = {
        success: true,
        data: [
          {
            id: "user-1",
            email: "user1@test.com",
            name: "User 1",
            role: "ADMIN",
            isActive: true,
            createdAt: new Date(),
          },
          {
            id: "user-2",
            email: "user2@test.com",
            name: "User 2",
            role: "USER",
            isActive: true,
            createdAt: new Date(),
          },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 20,
        },
        message: "Users retrieved successfully",
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(mockReq);

      expect(mockUsersService.findAll).toHaveBeenCalledWith("tenant-1", 1, 20);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("should return paginated list with custom pagination", async () => {
      const expectedResult = {
        success: true,
        data: [],
        meta: {
          total: 50,
          page: 2,
          limit: 10,
        },
        message: "Users retrieved successfully",
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(mockReq, "2", "10");

      expect(mockUsersService.findAll).toHaveBeenCalledWith("tenant-1", 2, 10);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
    });

    it("should handle string to number conversion for page and limit", async () => {
      const expectedResult = {
        success: true,
        data: [],
        meta: { total: 0, page: 3, limit: 5 },
        message: "Users retrieved successfully",
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll(mockReq, "3", "5");

      expect(mockUsersService.findAll).toHaveBeenCalledWith("tenant-1", 3, 5);
    });

    it("should use default values when page and limit are undefined", async () => {
      const expectedResult = {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20 },
        message: "Users retrieved successfully",
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll(mockReq, undefined, undefined);

      expect(mockUsersService.findAll).toHaveBeenCalledWith("tenant-1", 1, 20);
    });

    it("should extract tenantId from request object", async () => {
      const customReq = { tenantId: "custom-tenant", user: { id: "user-1" } };
      const expectedResult = {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20 },
        message: "Users retrieved successfully",
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll(customReq as any);

      expect(mockUsersService.findAll).toHaveBeenCalledWith(
        "custom-tenant",
        1,
        20,
      );
    });
  });

  describe("findOne", () => {
    it("should return a user by ID", async () => {
      const userId = "user-1";
      const expectedResult = {
        success: true,
        data: {
          id: userId,
          email: "user@test.com",
          name: "Test User",
          role: "ADMIN",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: "User retrieved successfully",
      };

      mockUsersService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(userId, mockReq);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(userId, "tenant-1");
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(userId);
    });

    it("should throw NotFoundException if user not found", async () => {
      const userId = "non-existent";

      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException("User not found"),
      );

      await expect(controller.findOne(userId, mockReq)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUsersService.findOne).toHaveBeenCalledWith(userId, "tenant-1");
    });

    it("should not return user from different tenant", async () => {
      const userId = "user-from-other-tenant";

      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException("User not found"),
      );

      await expect(controller.findOne(userId, mockReq)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("should update a user successfully", async () => {
      const userId = "user-1";
      const updateUserDto: UpdateUserDto = {
        name: "Updated Name",
        isActive: false,
      };

      const expectedResult = {
        success: true,
        data: {
          id: userId,
          email: "user@test.com",
          name: "Updated Name",
          role: "USER",
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: "User updated successfully",
      };

      mockUsersService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(userId, updateUserDto, mockReq);

      expect(mockUsersService.update).toHaveBeenCalledWith(
        userId,
        updateUserDto,
        "tenant-1",
      );
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated Name");
    });

    it("should update user password", async () => {
      const userId = "user-1";
      const updateUserDto: UpdateUserDto = {
        password: "newpassword123",
      };

      const expectedResult = {
        success: true,
        data: {
          id: userId,
          email: "user@test.com",
          name: "User",
          role: "USER",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: "User updated successfully",
      };

      mockUsersService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(userId, updateUserDto, mockReq);

      expect(mockUsersService.update).toHaveBeenCalledWith(
        userId,
        updateUserDto,
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });

    it("should throw NotFoundException when updating non-existent user", async () => {
      const userId = "non-existent";
      const updateUserDto: UpdateUserDto = { name: "Updated Name" };

      mockUsersService.update.mockRejectedValue(
        new NotFoundException("User not found"),
      );

      await expect(
        controller.update(userId, updateUserDto, mockReq),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update user role", async () => {
      const userId = "user-1";
      const updateUserDto: UpdateUserDto = {
        role: "ADMIN",
      };

      const expectedResult = {
        success: true,
        data: {
          id: userId,
          email: "user@test.com",
          name: "User",
          role: "ADMIN",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: "User updated successfully",
      };

      mockUsersService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(userId, updateUserDto, mockReq);

      expect(result.data.role).toBe("ADMIN");
    });
  });

  describe("remove", () => {
    it("should delete a user successfully", async () => {
      const userId = "user-1";
      const expectedResult = {
        success: true,
        data: null,
        message: "User deleted successfully",
      };

      mockUsersService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(userId, mockReq);

      expect(mockUsersService.remove).toHaveBeenCalledWith(userId, "tenant-1");
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should throw NotFoundException when deleting non-existent user", async () => {
      const userId = "non-existent";

      mockUsersService.remove.mockRejectedValue(
        new NotFoundException("User not found"),
      );

      await expect(controller.remove(userId, mockReq)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUsersService.remove).toHaveBeenCalledWith(userId, "tenant-1");
    });

    it("should not delete user from different tenant", async () => {
      const userId = "user-from-other-tenant";

      mockUsersService.remove.mockRejectedValue(
        new NotFoundException("User not found"),
      );

      await expect(controller.remove(userId, mockReq)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
