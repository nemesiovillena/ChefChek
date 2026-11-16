import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { cents } from "./gestion-sql.util";

export const EXPENSE_CATEGORIES = [
  "alquiler",
  "suministros",
  "seguros",
  "gestoria",
  "marketing",
  "mantenimiento",
  "otros",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseRow {
  id: string;
  /** «2026-10». */
  month: string;
  category: ExpenseCategory;
  concept: string;
  amount: number;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** «2026-10» → 2026-10-01 a medianoche UTC (columna DATE). */
function monthDate(month: string): Date {
  if (!MONTH.test(month)) {
    throw new BadRequestException("Mes no válido (AAAA-MM)");
  }
  const year = Number(month.slice(0, 4));
  if (year < 2000 || year > 2100) {
    throw new BadRequestException("Mes no válido (AAAA-MM)");
  }
  return new Date(`${month}-01T00:00:00Z`);
}

const toRow = (r: {
  id: string;
  month: Date;
  category: string;
  concept: string;
  amount: number;
}): ExpenseRow => ({
  id: r.id,
  month: r.month.toISOString().slice(0, 7),
  category: r.category as ExpenseCategory,
  concept: r.concept,
  amount: cents(r.amount),
});

/** Gastos generales del local por mes (sin IVA), introducidos a mano. */
@Injectable()
export class GestionExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, year: number): Promise<ExpenseRow[]> {
    const rows = await this.prisma.gestionExpense.findMany({
      where: {
        tenantId,
        month: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lte: new Date(`${year}-12-01T00:00:00Z`),
        },
      },
      orderBy: [{ month: "asc" }, { category: "asc" }, { concept: "asc" }],
    });
    return rows.map(toRow);
  }

  async create(
    tenantId: string,
    input: { month: string; category: string; concept: string; amount: number },
  ): Promise<ExpenseRow> {
    if (!EXPENSE_CATEGORIES.includes(input.category as ExpenseCategory)) {
      throw new BadRequestException("Categoría no válida");
    }
    const concept = input.concept.trim();
    if (!concept) {
      throw new BadRequestException("Escribe el concepto del gasto");
    }
    if (!Number.isFinite(input.amount)) {
      throw new BadRequestException("Importe no válido");
    }
    const row = await this.prisma.gestionExpense.create({
      data: {
        tenantId,
        month: monthDate(input.month),
        category: input.category,
        concept,
        amount: cents(input.amount),
      },
    });
    return toRow(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: { amount?: number; concept?: string },
  ): Promise<{ updated: number }> {
    const data: { amount?: number; concept?: string } = {};
    if (input.amount !== undefined) {
      if (!Number.isFinite(input.amount)) {
        throw new BadRequestException("Importe no válido");
      }
      data.amount = cents(input.amount);
    }
    if (input.concept !== undefined) {
      if (!input.concept.trim()) {
        throw new BadRequestException("Escribe el concepto del gasto");
      }
      data.concept = input.concept.trim();
    }
    const { count } = await this.prisma.gestionExpense.updateMany({
      where: { id, tenantId },
      data,
    });
    if (count === 0) {
      throw new NotFoundException("Gasto no encontrado");
    }
    return { updated: count };
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: number }> {
    const { count } = await this.prisma.gestionExpense.deleteMany({
      where: { id, tenantId },
    });
    if (count === 0) {
      throw new NotFoundException("Gasto no encontrado");
    }
    return { deleted: count };
  }

  /**
   * Copia los gastos de un mes a otro (alquiler, seguros… se repiten). Solo
   * si el mes de destino está vacío, para no duplicar.
   */
  async copyMonth(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<{ copied: number }> {
    const source = monthDate(from);
    const target = monthDate(to);
    const existing = await this.prisma.gestionExpense.count({
      where: { tenantId, month: target },
    });
    if (existing > 0) {
      throw new BadRequestException(
        "Ese mes ya tiene gastos: edítalos o bórralos antes de copiar",
      );
    }
    const rows = await this.prisma.gestionExpense.findMany({
      where: { tenantId, month: source },
    });
    if (rows.length === 0) {
      return { copied: 0 };
    }
    const { count } = await this.prisma.gestionExpense.createMany({
      data: rows.map((r) => ({
        tenantId,
        month: target,
        category: r.category,
        concept: r.concept,
        amount: r.amount,
      })),
    });
    return { copied: count };
  }
}
