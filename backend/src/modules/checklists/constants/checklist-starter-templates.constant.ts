import { CreateChecklistTemplateDto } from "../dto/checklist-template.dto";

/**
 * Plantillas de ejemplo, digitalizadas de documentos reales de Warynessy
 * (no inventadas) — ver plans/260921-2256-sicted-calidad-turistica/plan.md,
 * sección "Artefactos reales". Conjunto representativo, no exhaustivo: el
 * resto de ítems de cada documento y las hojas del "Plan de limpieza y
 * desinfección" completo se añaden cuando el usuario los comparta (fase 3,
 * editor de Plan). Todas marcadas `usedByModules: ["sicted","appcc"]` salvo
 * que se indique lo contrario — son los mismos documentos que usa APPCC en
 * papel hoy.
 */
export const CHECKLIST_STARTER_TEMPLATES: CreateChecklistTemplateDto[] = [
  {
    name: "Comprobación de Temperaturas",
    externalCode: "RE 4-2",
    kind: "MAINTENANCE",
    mode: "MEASUREMENT",
    area: "Almacén y cámaras",
    frequency: "DAILY",
    practiceRef: "Res-Hig.3",
    requiresSupervisor: false,
    items: [
      {
        label: "Verduras",
        expectedRangeMin: 0,
        expectedRangeMax: 4,
        isRequired: true,
      },
      {
        label: "Materias primas",
        expectedRangeMin: 0,
        expectedRangeMax: 4,
        isRequired: true,
      },
      {
        label: "Licores",
        expectedRangeMin: 0,
        expectedRangeMax: 8,
        isRequired: true,
      },
      {
        label: "Congelador grande",
        expectedRangeMin: -22,
        expectedRangeMax: -18,
        isRequired: true,
      },
      {
        label: "Bebida 6 puertas",
        expectedRangeMin: 0,
        expectedRangeMax: 8,
        isRequired: true,
      },
      {
        label: "Bebida 4 puertas",
        expectedRangeMin: 0,
        expectedRangeMax: 8,
        isRequired: true,
      },
      {
        label: "Cámara contrabarra",
        expectedRangeMin: 0,
        expectedRangeMax: 8,
        isRequired: true,
      },
      {
        label: "Vitrina barra",
        expectedRangeMin: 0,
        expectedRangeMax: 8,
        isRequired: true,
      },
      {
        label: "Botellero barra",
        expectedRangeMin: 0,
        expectedRangeMax: 8,
        isRequired: false,
      },
      {
        label: "Cámara postres",
        expectedRangeMin: 0,
        expectedRangeMax: 4,
        isRequired: true,
      },
      {
        label: "Congelador helados",
        expectedRangeMin: -22,
        expectedRangeMax: -18,
        isRequired: true,
      },
      {
        label: "Cámara carnes",
        expectedRangeMin: 0,
        expectedRangeMax: 4,
        isRequired: true,
      },
      {
        label: "Cámara banco-ensaladas",
        expectedRangeMin: 0,
        expectedRangeMax: 4,
        isRequired: true,
      },
      {
        label: "Cámara pescado",
        expectedRangeMin: 0,
        expectedRangeMax: 4,
        isRequired: true,
      },
    ],
  },
  {
    name: "Limpieza de cocina",
    kind: "CLEANING",
    mode: "EXECUTION",
    area: "Cocina",
    frequency: "DAILY",
    practiceRef: "Res-Coc.6",
    responsiblePosition: "Personal de cocina",
    requiresSupervisor: false,
    items: [
      { label: "Entrada cocina-basura", isRequired: true },
      { label: "Estanterías postres", isRequired: true },
      { label: "Estanterías ensaladas", isRequired: true },
      { label: "Estanterías pescado", isRequired: true },
      { label: "Estanterías plancha", isRequired: true },
      {
        label: "Campana extractora",
        isRequired: true,
        itemFrequency: "WEEKLY",
      },
      { label: "Azulejos cocina", isRequired: false, itemFrequency: "WEEKLY" },
      { label: "Cámara licores", isRequired: false, itemFrequency: "WEEKLY" },
      { label: "Pase platos sucios", isRequired: true },
    ],
  },
  {
    name: "Revisión semanal de limpieza",
    externalCode: "RE 2-1",
    kind: "CLEANING",
    mode: "INSPECTION",
    area: "Almacén y cámaras",
    frequency: "WEEKLY",
    practiceRef: "Ins-Bas.11",
    requiresSupervisor: true,
    items: [
      { label: "Suelos, paredes y techo (Almacén)", isRequired: true },
      { label: "Luminarias y los interruptores", isRequired: true },
      { label: "Orden y limpieza en las instalaciones", isRequired: true },
      { label: "Cámara de verduras", isRequired: true },
      { label: "Arcón congelador", isRequired: true },
      { label: "Cámara de bebidas", isRequired: true },
      { label: "Lavamanos y dosificador de jabón", isRequired: true },
      { label: "Suelos, paredes y techo (Cocina)", isRequired: true },
      { label: "Campana y filtros", isRequired: true },
      { label: "Basurero", isRequired: true },
    ],
  },
];
