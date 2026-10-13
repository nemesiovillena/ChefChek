import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Employee,
  EmployeeDocument,
  EmployeeDocumentAck,
  EmployeeDocumentCategory,
} from "@prisma/client";
import { BunnyStorageService } from "../../../common/bunny/bunny-storage.service";
import { PrismaService } from "../../../common/services/prisma.service";
import { assertAllowedAttachmentType } from "../../../common/utils/attachment-upload.util";
import {
  readPrivateAttachment,
  storePrivateAttachment,
} from "../../../common/utils/store-private-attachment.util";
import { UploadEmployeeDocumentDto } from "../dto/employee-document.dto";

export interface Actor {
  id: string;
  name: string;
}

const STORAGE_CATEGORY = "rrhh-documentos";
const DAY_MS = 86_400_000;
/** Con cuántos días de antelación se avisa de que un documento caduca. */
export const EXPIRY_WARNING_DAYS = 30;

/** VALID, EXPIRING (caduca en 30 días o menos) o EXPIRED. */
export function expiryStatus(expiresAt: Date | null, now: Date) {
  if (!expiresAt) {
    return null;
  }
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const days = Math.round((expiresAt.getTime() - today) / DAY_MS);
  if (days < 0) {
    return "EXPIRED" as const;
  }
  return days <= EXPIRY_WARNING_DAYS
    ? ("EXPIRING" as const)
    : ("VALID" as const);
}

/**
 * Documentación laboral por persona. El fichero es privado: nunca hay una URL
 * pública, solo la descarga autenticada, que comprueba que quien la pide es
 * gerencia o el titular.
 */
@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyStorageService,
  ) {}

  /**
   * Gerencia sube un documento para una o varias personas: un registro por
   * persona con el mismo fichero (p. ej. un protocolo interno).
   */
  async upload(
    tenantId: string,
    dto: UploadEmployeeDocumentDto,
    file: Express.Multer.File,
    by: Actor,
  ) {
    assertAllowedAttachmentType(file);
    const employeeIds = [
      ...new Set(
        dto.employeeIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, id: { in: employeeIds } },
      select: { id: true },
    });
    if (employeeIds.length === 0 || employees.length !== employeeIds.length) {
      throw new BadRequestException("Alguna de las personas no existe.");
    }
    const stored = await storePrivateAttachment(
      this.bunny,
      STORAGE_CATEGORY,
      tenantId,
      file,
    );
    const documents = await this.prisma.$transaction(
      employeeIds.map((employeeId) =>
        this.prisma.employeeDocument.create({
          data: {
            tenantId,
            employeeId,
            category: dto.category,
            title: dto.title.trim(),
            fileKey: stored.storageKey,
            fileName: stored.name,
            mimeType: stored.mime,
            sizeBytes: stored.size,
            uploadedByUserId: by.id,
            uploadedByName: by.name,
            requiresAck: dto.requiresAck === "true",
            expiresAt: dto.expiresAt
              ? new Date(`${dto.expiresAt}T00:00:00.000Z`)
              : null,
          },
        }),
      ),
    );
    return documents.map((document) => toView(document, null));
  }

  /** El empleado sube un justificante propio. */
  async uploadOwn(
    tenantId: string,
    employee: Employee,
    title: string,
    file: Express.Multer.File,
    by: Actor,
  ) {
    assertAllowedAttachmentType(file);
    const stored = await storePrivateAttachment(
      this.bunny,
      STORAGE_CATEGORY,
      tenantId,
      file,
    );
    const document = await this.prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId: employee.id,
        category: EmployeeDocumentCategory.JUSTIFICANTE,
        title: title.trim(),
        fileKey: stored.storageKey,
        fileName: stored.name,
        mimeType: stored.mime,
        sizeBytes: stored.size,
        uploadedByUserId: by.id,
        uploadedByName: by.name,
        uploadedByEmployee: true,
      },
    });
    return toView(document, null);
  }

  /** Documentos vigentes del tenant, o de una sola persona. */
  async list(tenantId: string, employeeId?: string) {
    const documents = await this.prisma.employeeDocument.findMany({
      where: { tenantId, employeeId, deletedAt: null },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const acks = await this.prisma.employeeDocumentAck.findMany({
      where: { tenantId, documentId: { in: documents.map((d) => d.id) } },
    });
    const byDocument = new Map(acks.map((ack) => [ack.documentId, ack]));
    return documents.map((document) => ({
      ...toView(document, byDocument.get(document.id) ?? null),
      employeeName:
        `${document.employee.firstName} ${document.employee.lastName}`.trim(),
    }));
  }

  /**
   * Fichero de un documento. Con `ownEmployeeId` solo se sirve si es de esa
   * persona: para cualquier otro, el documento no existe.
   */
  async getFile(tenantId: string, id: string, ownEmployeeId?: string) {
    const document = await this.findOwned(tenantId, id, ownEmployeeId);
    return {
      name: document.fileName,
      mime: document.mimeType,
      buffer: await readPrivateAttachment(this.bunny, document.fileKey),
    };
  }

  /** Acuse de lectura del titular. Queda registrado y no se puede deshacer. */
  async acknowledge(
    tenantId: string,
    employee: Employee,
    id: string,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const document = await this.findOwned(tenantId, id, employee.id);
    if (!document.requiresAck) {
      throw new BadRequestException("Este documento no pide acuse.");
    }
    try {
      const ack = await this.prisma.employeeDocumentAck.create({
        data: {
          tenantId,
          documentId: document.id,
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          documentTitle: document.title,
          ipAddress: meta.ipAddress?.slice(0, 64),
          userAgent: meta.userAgent?.slice(0, 300),
        },
      });
      return toView(document, ack);
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("Ya habías dado acuse de este documento.");
      }
      throw error;
    }
  }

  /**
   * Retira un documento (queda en la base de datos, deja de mostrarse). Un
   * documento con acuse no se retira: es la constancia de lo que se leyó.
   */
  async remove(tenantId: string, id: string) {
    const document = await this.findOwned(tenantId, id);
    const ack = await this.prisma.employeeDocumentAck.findUnique({
      where: { documentId: document.id },
    });
    if (ack) {
      throw new ForbiddenException(
        "Este documento tiene acuse de lectura y no se puede retirar.",
      );
    }
    await this.prisma.employeeDocument.update({
      where: { id: document.id },
      data: { deletedAt: new Date() },
    });
  }

  private async findOwned(
    tenantId: string,
    id: string,
    ownEmployeeId?: string,
  ) {
    const document = await this.prisma.employeeDocument.findFirst({
      where: { id, tenantId, employeeId: ownEmployeeId, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException("Documento no encontrado");
    }
    return document;
  }
}

function toView(document: EmployeeDocument, ack: EmployeeDocumentAck | null) {
  return {
    id: document.id,
    employeeId: document.employeeId,
    category: document.category,
    title: document.title,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedByName: document.uploadedByName,
    uploadedByEmployee: document.uploadedByEmployee,
    requiresAck: document.requiresAck,
    ackAt: ack?.ackAt ?? null,
    expiresAt: document.expiresAt
      ? document.expiresAt.toISOString().slice(0, 10)
      : null,
    expiryStatus: expiryStatus(document.expiresAt, new Date()),
    createdAt: document.createdAt,
  };
}
