import type { PrismaService } from "../../common/services/prisma.service";

/**
 * Nombre del puesto vigente (Empleados → Puestos) de cada cuenta. Es la única
 * fuente del puesto: fichas, informes de jornada y Mi espacio lo leen de aquí.
 * Las cuentas sin puesto no aparecen en el mapa.
 */
export async function currentPositionTitles(
  prisma: Pick<PrismaService, "sictedJobAssignment">,
  tenantId: string,
  userIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) {
    return new Map();
  }
  const assignments = await prisma.sictedJobAssignment.findMany({
    where: {
      tenantId,
      userId: { in: ids },
      until: null,
      profile: { archivedAt: null },
    },
    select: { userId: true, profile: { select: { title: true } } },
    orderBy: { since: "desc" },
  });
  const titles = new Map<string, string>();
  for (const a of assignments) {
    if (!titles.has(a.userId)) {
      titles.set(a.userId, a.profile.title);
    }
  }
  return titles;
}
