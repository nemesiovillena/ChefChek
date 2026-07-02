import { Injectable } from "@nestjs/common";
import { ModulesService } from "../modules/modules.service";
import { TenantsService } from "../tenants/tenants.service";
import { UpdateModuleDto } from "../modules/dto/module.dto";
import { UpdateTenantDto } from "../tenants/dto/create-tenant.dto";

@Injectable()
export class SuperadminService {
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

  private async assertTenantExists(tenantId: string) {
    // TenantsService.findOne already throws NotFoundException if not found
    await this.tenantsService.findOne(tenantId);
  }
}
