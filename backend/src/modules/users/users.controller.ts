import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import * as fs from "fs";
import * as path from "path";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto } from "./dto/create-user.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { Roles } from "../../decorators/roles.decorator";

@ApiTags("Users")
@Controller("api/v1/users")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "Crear un nuevo usuario (solo ADMIN)" })
  @ApiResponse({ status: 201, description: "Usuario creado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 403, description: "Permiso denegado (solo ADMIN)" })
  async create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    return this.usersService.create(createUserDto, tenantId);
  }

  @Post("upload-avatar")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Subir avatar de usuario" })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Only jpg, png, webp and gif images are allowed",
      );
    }

    const uploadsDir = path.join(process.cwd(), "uploads", "users");
    /* istanbul ignore next */
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), file.buffer);

    return {
      success: true,
      data: { avatarUrl: `/uploads/users/${fileName}` },
      message: "Avatar uploaded successfully",
    };
  }

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar todos los usuarios del tenant" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Número de página (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Resultados por página (default: 20)",
  })
  @ApiResponse({ status: 200, description: "Lista de usuarios" })
  async findAll(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.usersService.findAll(tenantId, pageNum, limitNum);
  }

  @Get(":id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener un usuario por ID" })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Usuario encontrado" })
  @ApiResponse({ status: 404, description: "Usuario no encontrado" })
  async findOne(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    return this.usersService.findOne(id, tenantId);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Actualizar un usuario (solo ADMIN)" })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Usuario actualizado exitosamente" })
  @ApiResponse({ status: 403, description: "Permiso denegado (solo ADMIN)" })
  @ApiResponse({ status: 404, description: "Usuario no encontrado" })
  async update(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    return this.usersService.update(id, updateUserDto, tenantId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Eliminar un usuario (solo ADMIN)" })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 204, description: "Usuario eliminado exitosamente" })
  @ApiResponse({ status: 403, description: "Permiso denegado (solo ADMIN)" })
  @ApiResponse({ status: 404, description: "Usuario no encontrado" })
  async remove(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    return this.usersService.remove(id, tenantId);
  }
}
