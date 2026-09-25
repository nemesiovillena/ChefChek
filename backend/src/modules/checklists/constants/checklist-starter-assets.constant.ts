import type { ChecklistStarterAsset } from "../services/checklist-asset.service";

/**
 * Equipos de ejemplo, digitalizados de documentos reales de Warynessy — ver
 * plans/260921-2256-sicted-calidad-turistica/plan.md. Control de extintores
 * (BP5.10.1) ya confirmado: trimestral, compartido sicted/appcc.
 */
export const CHECKLIST_STARTER_ASSETS: ChecklistStarterAsset[] = [
  {
    asset: {
      name: "Extintores",
      externalCode: "BP5.10.1",
      category: "EXTINTORES",
    },
    plan: {
      title: "Revisión trimestral de extintores",
      periodicityMonths: 3,
      externalProvider: true,
    },
  },
];
