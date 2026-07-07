import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthGuard } from "../../guards/auth.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { Roles } from "../../decorators/roles.decorator";
import { TrashService } from "./trash.service";

@ApiTags("Trash")
@ApiBearerAuth()
@Controller("api/v1/trash")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Listar elementos en papelera de un tipo" })
  @ApiResponse({
    status: 200,
    description: "Lista de elementos eliminados (soft-delete)",
  })
  findAll(@Query("type") type: string, @Req() req: any) {
    return this.trashService.listTrashed(type, req.tenantId);
  }

  @Patch(":type/:id/restore")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Recuperar un elemento de la papelera" })
  @ApiResponse({
    status: 200,
    description: "Elemento recuperado (deletedAt = null)",
  })
  @ApiResponse({
    status: 400,
    description: "Conflicto de unicidad al recuperar",
  })
  restore(
    @Param("type") type: string,
    @Param("id") id: string,
    @Req() req: any,
  ) {
    return this.trashService.restore(type, id, req.tenantId);
  }

  @Delete(":type/:id")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Borrar definitivamente un elemento de la papelera",
  })
  @ApiResponse({ status: 204, description: "Elemento borrado permanentemente" })
  @ApiResponse({
    status: 409,
    description: "Tiene dependencias y no se puede borrar",
  })
  async purge(
    @Param("type") type: string,
    @Param("id") id: string,
    @Req() req: any,
  ) {
    await this.trashService.purge(type, id, req.tenantId);
  }
}
