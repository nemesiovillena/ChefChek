import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { RoleAccessService } from "../role-access/role-access.service";
import { DASHBOARD_WIDGET_ID_SET } from "./dashboard-widgets";
import { UpdateDashboardLayoutDto } from "./dto/update-dashboard-layout.dto";

/** Una fila de `configurations` por dispositivo: `dashboardLayout.{userId}` = JSON. */
const KEY_PREFIX = "dashboardLayout.";
const CONFIG_CATEGORY = "DASHBOARD_LAYOUT";

export interface DashboardLayout {
  title: string;
  /** Cards visibles, en el orden en que se pintan. */
  widgets: string[];
}

export interface SharedDeviceLayout {
  userId: string;
  name: string;
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

  /** Pantalla del usuario autenticado; null si no es un dispositivo configurado. */
  async getForUser(
    tenantId: string,
    userId: string,
  ): Promise<DashboardLayout | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isSharedAccount: true },
      select: { id: true },
    });
    if (!user) {
      return null;
    }
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: `${KEY_PREFIX}${userId}` } },
    });
    return row ? parseLayout(row.value) : null;
  }

  /** Dispositivos compartidos activos con su pantalla (para Configuración). */
  async listSharedDevices(tenantId: string): Promise<SharedDeviceLayout[]> {
    const devices = await this.prisma.user.findMany({
      where: { tenantId, isSharedAccount: true, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const rows = await this.prisma.configuration.findMany({
      where: { tenantId, key: { startsWith: KEY_PREFIX } },
    });
    const byUser = new Map(
      rows.map((r) => [r.key.slice(KEY_PREFIX.length), r.value]),
    );
    return devices.map((d) => {
      const value = byUser.get(d.id);
      return {
        userId: d.id,
        name: d.name,
        layout: value ? parseLayout(value) : null,
      };
    });
  }

  async update(
    tenantId: string,
    deviceId: string,
    editorId: string,
    dto: UpdateDashboardLayoutDto,
  ): Promise<DashboardLayout> {
    await this.assertSharedDevice(tenantId, deviceId);
    const unknown = dto.widgets.filter((w) => !DASHBOARD_WIDGET_ID_SET.has(w));
    if (unknown.length > 0) {
      throw new BadRequestException(`Card desconocida: ${unknown.join(", ")}`);
    }
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException("El título no puede estar vacío");
    }
    const layout: DashboardLayout = {
      title,
      widgets: [...new Set(dto.widgets)],
    };
    const key = `${KEY_PREFIX}${deviceId}`;
    const value = JSON.stringify(layout);
    await this.prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        value,
        category: CONFIG_CATEGORY,
        description: `Dashboard layout for shared device ${deviceId}`,
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
    const device = await this.prisma.user.findFirst({
      where: { id: deviceId, tenantId, isSharedAccount: true },
      select: { id: true, role: true },
    });
    if (!device) {
      throw new NotFoundException("Dispositivo compartido no encontrado");
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
    const device = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isSharedAccount: true },
      select: { id: true },
    });
    if (!device) {
      throw new NotFoundException("Dispositivo compartido no encontrado");
    }
  }
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
      widgets: raw.widgets.filter(
        (w): w is string =>
          typeof w === "string" && DASHBOARD_WIDGET_ID_SET.has(w),
      ),
    };
  } catch {
    return null;
  }
}
