import { Injectable, Logger } from "@nestjs/common";
import { ModulesService } from "../modules/modules.service";
import { TenantsService } from "../tenants/tenants.service";
import { UpdateModuleDto } from "../modules/dto/module.dto";
import { UpdateTenantDto } from "../tenants/dto/create-tenant.dto";

@Injectable()
export class SuperadminService {
  private readonly logger = new Logger(SuperadminService.name);

  constructor(
    private readonly modulesService: ModulesService,
    private readonly tenantsService: TenantsService,
  ) {}

  async listTenants(page: number, limit: number) {
    return this.tenantsService.findAll(page, limit);
  }

  async getTenantModules(tenantId: string) {
    await this.assertTenantExists(tenantId);
    return this.modulesService.getModules(tenantId);
  }

  async toggleTenantModule(
    tenantId: string,
    moduleId: string,
    dto: UpdateModuleDto,
    userId: string,
  ) {
    await this.assertTenantExists(tenantId);
    return this.modulesService.toggleModule(tenantId, moduleId, dto, userId);
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    await this.assertTenantExists(tenantId);
    return this.tenantsService.update(tenantId, dto);
  }

  /** Clientes dados de baja (papelera de clientes del superadmin). */
  async listTrashedTenants() {
    return this.tenantsService.listTrashed();
  }

  async restoreTenant(tenantId: string) {
    return this.tenantsService.restore(tenantId);
  }

  /**
   * Borrado definitivo de un cliente (hard delete + cascade de todos sus
   * datos). Acción irreversible; se loguea con el superadmin que la ejecuta.
   */
  async purgeTenant(tenantId: string, userId: string) {
    this.logger.warn(
      `SUPERADMIN ${userId} purging tenant ${tenantId} (hard delete + cascade)`,
    );
    return this.tenantsService.purge(tenantId);
  }

  private async assertTenantExists(tenantId: string) {
    // TenantsService.findOne already throws NotFoundException if not found
    await this.tenantsService.findOne(tenantId);
  }
}
