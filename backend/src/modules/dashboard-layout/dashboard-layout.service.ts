import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { RoleAccessService } from "../role-access/role-access.service";
import { type DashboardWidgetSlot, toWidgetSlot } from "./dashboard-widgets";
import { UpdateDashboardLayoutDto } from "./dto/update-dashboard-layout.dto";

/** Una fila de `configurations` por cuenta: `dashboardLayout.{userId}` = JSON. */
const KEY_PREFIX = "dashboardLayout.";
const CONFIG_CATEGORY = "DASHBOARD_LAYOUT";

export interface DashboardLayout {
  title: string;
  /** Cards visibles con su tamaño, en el orden en que se pintan. */
  widgets: DashboardWidgetSlot[];
}

/**
 * Cuentas con inicio configurable una a una: los dispositivos compartidos y la
 * administración (OWNER/ADMIN). Las cuentas personales de rol Usuario
 * comparten una pantalla común (ROLE_USER_SCREEN_ID); el resto ve el inicio
 * completo.
 */
const ADMIN_ROLES: UserRole[] = ["OWNER", "ADMIN"];
const CONFIGURABLE_ACCOUNT = {
  OR: [{ isSharedAccount: true }, { role: { in: ADMIN_ROLES } }],
};

/**
 * Pantalla común de las cuentas personales con rol Usuario. Va en el sitio del
 * userId (rutas, clave de configuración) para reutilizar editor y vista previa.
 */
export const ROLE_USER_SCREEN_ID = "role:USER";
/** USER_CUINER es Usuario + Albaranes: comparte su pantalla. */
const ROLE_USER_ROLES: UserRole[] = ["USER", "USER_CUINER"];

export interface SharedDeviceLayout {
  userId: string;
  name: string;
  /**
   * device = dispositivo compartido; admin = cuenta de administración;
   * role = pantalla común de las cuentas personales con rol Usuario.
   */
  kind: "device" | "admin" | "role";
  /** null = sin configurar: el dispositivo ve el dashboard completo. */
  layout: DashboardLayout | null;
}

/**
 * Qué muestra el dashboard de cada dispositivo compartido. Solo presentación:
 * lo que el dispositivo puede ver lo siguen decidiendo sus permisos; esta
 * configuración únicamente oculta cards de su pantalla de inicio. Las cuentas
 * personales no tienen configuración y ven el dashboard completo.
 */
@Injectable()
export class DashboardLayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleAccess: RoleAccessService,
  ) {}

  /**
   * Pantalla del usuario autenticado: la suya si es configurable una a una; la
   * común si es una cuenta personal de rol Usuario; null = dashboard completo.
   */
  async getForUser(
    tenantId: string,
    userId: string,
  ): Promise<DashboardLayout | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true, isSharedAccount: true },
    });
    if (!user) {
      return null;
    }
    const screenId = isOwnScreen(user)
      ? userId
      : ROLE_USER_ROLES.includes(user.role)
        ? ROLE_USER_SCREEN_ID
        : null;
    if (!screenId) {
      return null;
    }
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: `${KEY_PREFIX}${screenId}` } },
    });
    return row ? parseLayout(row.value) : null;
  }

  /** Dispositivos compartidos activos con su pantalla (para Configuración). */
  async listSharedDevices(tenantId: string): Promise<SharedDeviceLayout[]> {
    const devices = await this.prisma.user.findMany({
      where: { tenantId, isActive: true, ...CONFIGURABLE_ACCOUNT },
      select: { id: true, name: true, isSharedAccount: true },
      orderBy: { name: "asc" },
    });
    const rows = await this.prisma.configuration.findMany({
      where: { tenantId, key: { startsWith: KEY_PREFIX } },
    });
    const byUser = new Map(
      rows.map((r) => [r.key.slice(KEY_PREFIX.length), r.value]),
    );
    const roleValue = byUser.get(ROLE_USER_SCREEN_ID);
    return [
      ...devices.map((d) => {
        const value = byUser.get(d.id);
        return {
          userId: d.id,
          name: d.name,
          kind: d.isSharedAccount ? ("device" as const) : ("admin" as const),
          layout: value ? parseLayout(value) : null,
        };
      }),
      {
        userId: ROLE_USER_SCREEN_ID,
        name: "Usuario",
        kind: "role" as const,
        layout: roleValue ? parseLayout(roleValue) : null,
      },
    ];
  }

  async update(
    tenantId: string,
    deviceId: string,
    editorId: string,
    dto: UpdateDashboardLayoutDto,
  ): Promise<DashboardLayout> {
    await this.assertSharedDevice(tenantId, deviceId);
    const widgets: DashboardWidgetSlot[] = [];
    for (const raw of dto.widgets) {
      const slot = toWidgetSlot(raw);
      if (!slot) {
        throw new BadRequestException(`Card no válida: ${JSON.stringify(raw)}`);
      }
      if (!widgets.some((w) => w.id === slot.id)) {
        widgets.push(slot);
      }
    }
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException("El título no puede estar vacío");
    }
    const layout: DashboardLayout = { title, widgets };
    const key = `${KEY_PREFIX}${deviceId}`;
    const value = JSON.stringify(layout);
    await this.prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        value,
        category: CONFIG_CATEGORY,
        description: `Dashboard layout for ${deviceId}`,
        updatedBy: editorId,
      },
      update: { value, updatedBy: editorId },
    });
    return layout;
  }

  /**
   * Secciones que ve el dispositivo (rol + puesto + persona), para que la
   * vista previa del administrador enseñe las mismas cards que el dispositivo.
   * Vacío = lo ve todo.
   */
  async getDeviceSections(
    tenantId: string,
    deviceId: string,
  ): Promise<Record<string, boolean>> {
    // Pantalla común: permisos del rol Usuario, sin puesto ni persona.
    if (deviceId === ROLE_USER_SCREEN_ID) {
      return (
        (await this.roleAccess.getSectionMapForUserRole(tenantId, "USER")) ?? {}
      );
    }
    const device = await this.prisma.user.findFirst({
      where: { id: deviceId, tenantId, ...CONFIGURABLE_ACCOUNT },
      select: { id: true, role: true },
    });
    if (!device) {
      throw new NotFoundException("Cuenta sin pantalla configurable");
    }
    return (
      (await this.roleAccess.getSectionMapForUserRole(
        tenantId,
        device.role,
        device.id,
      )) ?? {}
    );
  }

  /** Quita la configuración: el dispositivo vuelve al dashboard completo. */
  async reset(tenantId: string, deviceId: string): Promise<void> {
    await this.assertSharedDevice(tenantId, deviceId);
    await this.prisma.configuration.deleteMany({
      where: { tenantId, key: `${KEY_PREFIX}${deviceId}` },
    });
  }

  private async assertSharedDevice(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    if (userId === ROLE_USER_SCREEN_ID) {
      return;
    }
    const device = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ...CONFIGURABLE_ACCOUNT },
      select: { id: true },
    });
    if (!device) {
      throw new NotFoundException("Cuenta sin pantalla configurable");
    }
  }
}

/** Mismo criterio que CONFIGURABLE_ACCOUNT, sobre un usuario ya leído. */
function isOwnScreen(user: {
  role: UserRole;
  isSharedAccount: boolean;
}): boolean {
  return user.isSharedAccount || ADMIN_ROLES.includes(user.role);
}

/** Valor guardado → layout; descarta cards que ya no existen. Corrupto → null. */
function parseLayout(value: string): DashboardLayout | null {
  try {
    const raw = JSON.parse(value) as Partial<DashboardLayout>;
    if (typeof raw.title !== "string" || !Array.isArray(raw.widgets)) {
      return null;
    }
    return {
      title: raw.title,
      widgets: (raw.widgets as unknown[])
        .map(toWidgetSlot)
        .filter((w): w is DashboardWidgetSlot => w !== null),
    };
  } catch {
    return null;
  }
}
