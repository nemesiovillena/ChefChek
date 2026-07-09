import { IsOptional, IsString, MaxLength } from "class-validator";

export type BackupScope = "TENANT" | "GLOBAL";
export type BackupActorScope = "TENANT" | "GLOBAL";

export class CreateBackupDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Body para restaurar desde una copia existente (el id viene en la URL `:id`). */
export class RestoreExistingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Estructura del archivo .json de copia. */
export interface BackupPayload {
  meta: {
    schemaVersion: number;
    app: string;
    exportedAt: string; // ISO
    scope: BackupScope;
    tenantId: string | null;
    tenantSlug?: string | null;
    counts: Record<string, number>;
    /** Tablas presentes en la BD que NO se respaldaron (brecha de cobertura). */
    coverageGap?: string[];
  };
  data: Record<string, Record<string, unknown>[]>;
}

export interface BackupFileMeta {
  id: string;
  scope: BackupScope;
  status: string;
  kind: string;
  type: string;
  format: string;
  filename: string | null;
  fileSizeBytes: string | null; // BigInt -> string para JSON
  rowCount: number | null;
  checksum: string | null;
  schemaVersion: number;
  sourceBackupId: string | null;
  notes: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}
