import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./dto/create-user.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, requestTenantId: string) {
    const {
      tenantId,
      email,
      password,
      name,
      role = "USER",
      isActive = true,
    } = createUserDto;

    if ((role as string) === "SUPERADMIN") {
      throw new BadRequestException(
        "No se puede crear un SUPERADMIN desde esta API",
      );
    }

    // Validar que el tenant ID coincida con el tenant de la request
    if (tenantId !== requestTenantId) {
      throw new ForbiddenException("Cannot create user for different tenant");
    }

    // Verificar que el tenant existe y está activo
    const tenantExists = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenantExists) {
      throw new NotFoundException("Tenant not found");
    }

    if (!tenantExists.isActive) {
      throw new ForbiddenException("Tenant is not active");
    }

    // Verificar que el email no exista en el mismo tenant
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId,
        },
      },
    });

    if (existingUser) {
      throw new ConflictException("User already exists in this tenant");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash: hashedPassword,
        name,
        role,
        isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: user,
      message: "User created successfully",
    };
  }

  async findAll(requestTenantId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId: requestTenantId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({
        where: { tenantId: requestTenantId },
      }),
    ]);

    return {
      success: true,
      data: users,
      meta: {
        total,
        page,
        limit,
      },
      message: "Users retrieved successfully",
    };
  }

  async findOne(id: string, requestTenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId: requestTenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      success: true,
      data: user,
      message: "User retrieved successfully",
    };
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    requestTenantId: string,
  ) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId: requestTenantId,
      },
    });

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    const updateData: any = { ...updateUserDto };

    // Hash password if provided
    if (updateUserDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      delete updateData.password;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: user,
      message: "User updated successfully",
    };
  }

  async remove(id: string, requestTenantId: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId: requestTenantId,
      },
    });

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return {
      success: true,
      data: null,
      message: "User deleted successfully",
    };
  }

  async findSuperadminByEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, role: "SUPERADMIN" },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive,
    };
  }

  async findByEmail(email: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId,
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive,
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive,
    };
  }

  async validateUserPermissions(
    userId: string,
    requiredRoles: string[],
  ): Promise<boolean> {
    const user = await this.findById(userId);

    if (!user || !user.isActive) {
      return false;
    }

    // Roles con mayor jerarquía: SUPERADMIN > OWNER > ADMIN > USER > VIEWER
    const roleHierarchy: { [key: string]: number } = {
      SUPERADMIN: 5,
      OWNER: 4,
      ADMIN: 3,
      USER: 2,
      VIEWER: 1,
    };

    const userRoleLevel = roleHierarchy[user.role] || 0;

    // Verificar si el usuario tiene al menos uno de los roles requeridos
    return requiredRoles.some((role) => {
      const requiredRoleLevel = roleHierarchy[role] || 0;
      return userRoleLevel >= requiredRoleLevel;
    });
  }
}
