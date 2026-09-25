import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";

/** CSV de marcas de un periodo — para volúmenes que no caben en un PDF de un mes. */
@Injectable()
export class SictedAuditCsvService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(tenantId: string, from: Date, to: Date): Promise<string> {
    const entries = await this.prisma.checklistEntry.findMany({
      where: {
        tenantId,
        recordedAt: { gte: from, lt: to },
        run: { template: { usedByModules: { has: "sicted" } } },
      },
      include: {
        run: {
          select: {
            periodKey: true,
            template: { select: { name: true, area: true } },
          },
        },
        item: { select: { label: true } },
      },
      orderBy: { recordedAt: "asc" },
    });

    const header = [
      "fecha",
      "area",
      "plantilla",
      "periodo",
      "item",
      "resultado",
      "valor",
      "motivo_observacion",
      "quien",
      "es_correccion",
    ];
    const rows = entries.map((e) =>
      [
        e.recordedAt.toISOString(),
        e.run.template.area,
        e.run.template.name,
        e.run.periodKey,
        e.item.label,
        e.outcome ?? "",
        e.value ?? "",
        e.reason ?? e.observation ?? "",
        e.performedByName,
        e.correctsEntryId ? "si" : "no",
      ]
        .map(this.csvEscape)
        .join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }

  private csvEscape(value: string | number): string {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
}
