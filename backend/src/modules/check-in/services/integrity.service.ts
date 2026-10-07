import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { computePunchHash } from "./punch-hash.util";

export interface IntegrityResult {
  ok: boolean;
  /** Fichajes comprobados. */
  checked: number;
  /** Primer fichaje cuya huella o numeración no cuadra (si lo hay). */
  brokenAtSeq: number | null;
  /** Huella del último fichaje: resume todo el registro hasta ese punto. */
  lastHash: string | null;
  checkedAt: Date;
}

const BATCH = 2000;

/**
 * Verificación de integridad del registro de fichajes: recorre la cadena del
 * tenant recalculando cada huella. Si alguien alterase, quitase o insertase
 * una fila saltándose la aplicación, la cadena se rompe en ese punto.
 */
@Injectable()
export class IntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(tenantId: string): Promise<IntegrityResult> {
    let prevHash: string | null = null;
    let expectedSeq = 1;
    let checked = 0;
    for (;;) {
      const batch = await this.prisma.timePunch.findMany({
        where: { tenantId, seq: { gte: expectedSeq } },
        orderBy: { seq: "asc" },
        take: BATCH,
      });
      if (batch.length === 0) {
        break;
      }
      for (const punch of batch) {
        const valid =
          punch.seq === expectedSeq &&
          punch.prevHash === prevHash &&
          punch.hash === computePunchHash(prevHash, punch);
        if (!valid) {
          return {
            ok: false,
            checked,
            brokenAtSeq: Math.min(punch.seq, expectedSeq),
            lastHash: prevHash,
            checkedAt: new Date(),
          };
        }
        prevHash = punch.hash;
        expectedSeq += 1;
        checked += 1;
      }
    }
    return {
      ok: true,
      checked,
      brokenAtSeq: null,
      lastHash: prevHash,
      checkedAt: new Date(),
    };
  }
}
