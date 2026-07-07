import { Injectable } from "@nestjs/common";

export interface JobProgress {
  /** 0..100 */
  progress: number;
  /** Etapa legible (p. ej. "Exportando recipes"). */
  step: string;
  /** Estado actual del job en memoria. */
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  /** Mensaje en caso de fallo. */
  error?: string;
  /** Instante del último heartbeat (ms). Para detectar jobs colgados. */
  updatedAt: number;
}

/**
 * Registro en memoria del progreso en vivo de los jobs de backup/restore.
 *
 * El listado persistente vive en la tabla `backups`; este Map sólo alimenta el
 * polling de progreso mientras el job corre en el mismo proceso. Si el proceso
 * muere, la fila queda RUNNING y se reconcilia al listar (ver BackupService).
 */
@Injectable()
export class BackupProgressRegistry {
  private readonly jobs = new Map<string, JobProgress>();

  set(
    id: string,
    p: Partial<JobProgress> & { status: JobProgress["status"] },
  ): void {
    const prev = this.jobs.get(id);
    this.jobs.set(id, {
      progress: p.progress ?? prev?.progress ?? 0,
      step: p.step ?? prev?.step ?? "",
      status: p.status,
      error: p.error ?? prev?.error,
      updatedAt: Date.now(),
    });
  }

  get(id: string): JobProgress | undefined {
    return this.jobs.get(id);
  }

  /** Elimina el job del registro (corte final tras COMPLETED/FAILED persistido). */
  clear(id: string): void {
    this.jobs.delete(id);
  }
}
