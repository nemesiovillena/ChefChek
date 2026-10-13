import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { ModulesService } from "../../modules/modules.service";
import { resolveFallbackLocationIds, splitFullName } from "./employees.service";

/** Lo que la ficha necesita saber de la cuenta de Equipo. */
export interface AccountSnapshot {
  id: string;
  tenantId: string | null;
  name: string;
  isActive: boolean;
  isSharedAccount: boolean;
}

/**
 * Mantiene la ficha de Fichar al día con su cuenta de Equipo, que es la fuente
 * de los datos personales: el nombre y el estado activo de la ficha siguen a
 * los de la cuenta. Las columnas firstName/lastName de una ficha vinculada son
 * una copia que se reescribe aquí; los datos laborales viven solo en la ficha.
 *
 * Solo depende de Prisma y del registro de módulos para poder usarse desde
 * UsersModule sin importar CheckInModule.
 */
@Injectable()
export class EmployeeAccountSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modules: ModulesService,
  ) {}

  /**
   * Alta de una cuenta personal: crea su ficha con el centro por defecto si el
   * restaurante usa Fichar. Una cuenta compartida no es una persona.
   */
  async onAccountCreated(account: AccountSnapshot): Promise<void> {
    if (!account.tenantId || account.isSharedAccount) {
      return;
    }
    if (!(await this.modules.isModuleEnabled(account.tenantId, "check-in"))) {
      return;
    }
    const tenantId = account.tenantId;
    const existing = await this.prisma.employee.findFirst({
      where: { userId: account.id },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    const locationIds = await resolveFallbackLocationIds(this.prisma, tenantId);
    await this.prisma.employee.create({
      data: {
        tenantId,
        userId: account.id,
        ...splitFullName(account.name),
        isActive: account.isActive,
        defaultLocationId: locationIds[0] ?? null,
        locations: {
          create: locationIds.map((locationId) => ({ tenantId, locationId })),
        },
      },
    });
  }

  /**
   * Cambio en la cuenta: la ficha copia nombre y estado. Si la cuenta pasa a
   * ser compartida deja de representar a una persona y se desvincula; la
   * ficha se conserva (con su histórico) como ficha sin cuenta.
   */
  async onAccountUpdated(account: AccountSnapshot): Promise<void> {
    if (account.isSharedAccount) {
      await this.prisma.employee.updateMany({
        where: { userId: account.id },
        data: { userId: null },
      });
      return;
    }
    await this.prisma.employee.updateMany({
      where: { userId: account.id },
      data: { ...splitFullName(account.name), isActive: account.isActive },
    });
  }

  /** Baja de la cuenta: la ficha no se borra, queda inactiva. */
  async onAccountRemoved(accountId: string): Promise<void> {
    await this.prisma.employee.updateMany({
      where: { userId: accountId },
      data: { isActive: false },
    });
  }
}
