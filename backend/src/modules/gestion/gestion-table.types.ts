/**
 * Forma común de los informes de Gestión: la pantalla pinta la tabla y la
 * exportación (CSV, Excel, PDF) sale de la misma estructura, así lo que se
 * descarga es exactamente lo que se ve.
 */
export type GestionColumnKind = "text" | "int" | "qty" | "euros" | "percent";

export interface GestionColumn {
  key: string;
  label: string;
  kind: GestionColumnKind;
}

export type GestionCell = string | number | null;

export interface GestionTable {
  /** Clave del informe (ranking, interanual…). */
  key: string;
  title: string;
  /** Rango o parámetros en texto, para la cabecera y el nombre del archivo. */
  subtitle: string;
  columns: GestionColumn[];
  rows: Record<string, GestionCell>[];
  /** Fila de totales (opcional), con las mismas claves que las columnas. */
  totals?: Record<string, GestionCell>;
  /** Avisos para mostrar bajo la tabla (p. ej. líneas sin importe). */
  notes: string[];
}

export const GESTION_EXPORT_FORMATS = ["xlsx", "csv", "pdf"] as const;
export type GestionExportFormat = (typeof GESTION_EXPORT_FORMATS)[number];

export const GESTION_CONTENT_TYPES: Record<GestionExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
};
