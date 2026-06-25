import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";

/** Generates auto-incrementing internal albaran numbers per tenant */
@Injectable()
export class AlbaranNumberService {
  private readonly logger = new Logger(AlbaranNumberService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Generate next internal number for a tenant: ALB-0001, ALB-0002, etc. */
  async generateInternalNumber(tenantId: string): Promise<string> {
    const lastAlbaran = await this.prisma.albaran.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { internalNumber: true },
    });

    let nextSeq = 1;
    if (lastAlbaran?.internalNumber) {
      const match = lastAlbaran.internalNumber.match(/ALB-(\d+)/);
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }

    const internalNumber = `ALB-${String(nextSeq).padStart(4, "0")}`;
    this.logger.debug(
      `Generated internal number: ${internalNumber} for tenant ${tenantId}`,
    );
    return internalNumber;
  }
}
