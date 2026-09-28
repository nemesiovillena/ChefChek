import type { SictedAxis, SictedPractice } from '@/lib/sicted-direccion-types';

/**
 * Presentación del catálogo SICTED 2026, compartida por la pestaña Catálogo y
 * la Autoevaluación: nombres de eje, agrupación eje → módulo y enlaces a la
 * evidencia que Chefchek ya genera en otros módulos.
 */

export const AXIS_LABELS: Record<SictedAxis, string> = {
  ECONOMICO: 'Sostenibilidad económica',
  SOCIAL: 'Sostenibilidad social',
  AMBIENTAL: 'Sostenibilidad ambiental',
};

const AXIS_ORDER: SictedAxis[] = ['ECONOMICO', 'SOCIAL', 'AMBIENTAL'];

export const NOT_APPLICABLE_LABELS: Record<string, string> = {
  UNIPERSONAL: 'si es unipersonal',
  SIN_INSTALACIONES: 'si no tiene instalaciones',
  ONLINE: 'si opera solo online',
};

export interface PracticeModuleGroup<T> {
  moduleCode: string;
  moduleName: string;
  complementary: boolean;
  items: T[];
}

export interface PracticeAxisGroup<T> {
  axis: SictedAxis;
  label: string;
  modules: PracticeModuleGroup<T>[];
}

/** Agrupa por eje y módulo, conservando el orden por código que ya trae la API. */
export function groupPracticesByAxisAndModule<T>(
  items: T[],
  getPractice: (item: T) => SictedPractice,
): PracticeAxisGroup<T>[] {
  const byAxis = new Map<SictedAxis, Map<string, PracticeModuleGroup<T>>>();
  for (const item of items) {
    const p = getPractice(item);
    if (!p.axis || !p.moduleCode) continue; // legado v4 archivado: no se agrupa aquí
    const modules = byAxis.get(p.axis) ?? new Map<string, PracticeModuleGroup<T>>();
    byAxis.set(p.axis, modules);
    const group = modules.get(p.moduleCode) ?? {
      moduleCode: p.moduleCode,
      moduleName: p.moduleName ?? p.moduleCode,
      complementary: p.chapter === 'COMPLEMENTARIO',
      items: [],
    };
    modules.set(p.moduleCode, group);
    group.items.push(item);
  }
  return AXIS_ORDER.filter((axis) => byAxis.has(axis)).map((axis) => ({
    axis,
    label: AXIS_LABELS[axis],
    modules: [...byAxis.get(axis)!.values()].sort((a, b) => a.moduleCode.localeCompare(b.moduleCode)),
  }));
}

export interface PracticeEvidenceLink {
  label: string;
  href: string;
}

// Destinos reutilizados. Las pantallas SICTED con pestañas aceptan `?tab=` y el
// Plan acepta `?buscar=` (filtra plantillas por nombre o zona, sin tildes).
const L = {
  plan: (buscar?: string): PracticeEvidenceLink => ({
    label: buscar ? `Plan: plantillas de «${buscar}»` : 'Plan de limpieza y controles',
    href: buscar ? `/dashboard/sicted/plan?buscar=${encodeURIComponent(buscar)}` : '/dashboard/sicted/plan',
  }),
  registros: { label: 'Registros (matriz mensual)', href: '/dashboard/sicted/registros' },
  mantCalendario: { label: 'Mantenimiento preventivo', href: '/dashboard/sicted/mantenimiento?tab=calendario' },
  mantEquipos: { label: 'Equipos', href: '/dashboard/sicted/mantenimiento?tab=equipos' },
  mantAverias: { label: 'Parte de averías', href: '/dashboard/sicted/mantenimiento?tab=averias' },
  quejas: { label: 'Quejas y sugerencias', href: '/dashboard/sicted/clientes?tab=quejas' },
  satisfaccion: { label: 'Satisfacción de clientes', href: '/dashboard/sicted/clientes?tab=satisfaccion' },
  objetos: { label: 'Objetos perdidos', href: '/dashboard/sicted/clientes?tab=objetos' },
  provCumplimiento: { label: 'Perfil de cumplimiento de proveedores', href: '/dashboard/sicted/proveedores?tab=cumplimiento' },
  provIncidencias: { label: 'Incidencias con proveedores', href: '/dashboard/sicted/proveedores?tab=incidencias' },
  provInventario: { label: 'Inventario semestral', href: '/dashboard/sicted/proveedores?tab=inventario' },
  provEvidencia: { label: 'Evidencia de aprovisionamiento', href: '/dashboard/sicted/proveedores?tab=evidencia' },
  proveedores: { label: 'Proveedores', href: '/dashboard/proveedores' },
  albaranes: { label: 'Albaranes (recepción)', href: '/dashboard/albaranes' },
  almacen: { label: 'Almacén y stock', href: '/dashboard/warehouse' },
  puestos: { label: 'Puestos y funciones', href: '/dashboard/sicted/personas?tab=puestos' },
  formacion: { label: 'Plan de formación', href: '/dashboard/sicted/personas?tab=formacion' },
  protocolos: { label: 'Protocolos', href: '/dashboard/sicted/personas?tab=protocolos' },
  usuarios: { label: 'Gestión de usuarios', href: '/dashboard/users' },
  produccion: { label: 'Producción y tareas', href: '/dashboard/production' },
  objetivos: { label: 'Objetivos anuales', href: '/dashboard/sicted/direccion?tab=objetivos' },
  mejora: { label: 'Plan de mejora', href: '/dashboard/sicted/direccion?tab=mejora' },
  eventos: { label: 'Eventos y grupos de mejora', href: '/dashboard/sicted/direccion?tab=eventos' },
  legal: { label: 'Documentos legales', href: '/dashboard/sicted/direccion?tab=legal' },
  informe: { label: 'Informe anual', href: '/dashboard/sicted/direccion?tab=informe' },
  recetas: { label: 'Recetas y escandallos', href: '/dashboard/recipes' },
  fichas: { label: 'Fichas técnicas', href: '/dashboard/technical-sheets' },
  etiquetado: { label: 'Etiquetado', href: '/dashboard/etiquetado' },
  caducidades: { label: 'Caducidades', href: '/dashboard/appcc/caducidades' },
  alergenos: { label: 'Alérgenos', href: '/dashboard/allergens' },
  menus: { label: 'Menús y cartas', href: '/dashboard/menus' },
  menuDigital: { label: 'Menú digital', href: '/dashboard/digital-menu' },
} satisfies Record<string, PracticeEvidenceLink | ((q?: string) => PracticeEvidenceLink)>;

/**
 * Dónde está en Chefchek la evidencia de cada buena práctica (solo
 * navegación: el enlace lleva al registro, no marca la práctica como
 * cumplida). Ampliable: añadir aquí el código de la práctica.
 */
export const PRACTICE_EVIDENCE_LINKS: Record<string, PracticeEvidenceLink[]> = {
  // Planificación y dirección
  '0003': [L.objetivos],
  '0004': [L.mejora],
  '0007': [L.informe],
  '0029': [L.mejora],
  '0047': [L.objetivos],
  '0048': [L.mejora],
  '0050': [L.informe],
  '0077': [L.objetivos],
  '0080': [L.mejora],
  '0082': [L.informe],
  '0070': [L.eventos],
  '0071': [L.eventos],
  '0411': [L.legal],
  // Personas
  '0008': [L.formacion],
  '0009': [L.puestos],
  '0010': [L.produccion],
  '0012': [L.protocolos],
  '0015': [L.usuarios],
  '0051': [L.formacion],
  '0083': [L.formacion],
  '0533': [L.protocolos],
  '0655': [L.protocolos],
  '0658': [L.formacion],
  '0687': [L.formacion],
  // Clientes
  '0018': [L.quejas],
  '0019': [L.satisfaccion],
  '0057': [L.quejas],
  '0058': [L.satisfaccion],
  '0419': [L.objetos],
  // Proveedores y aprovisionamiento
  '0024': [L.proveedores, L.provCumplimiento],
  '0025': [L.provIncidencias, L.albaranes],
  '0026': [L.albaranes, L.provEvidencia],
  '0027': [L.provInventario, L.almacen],
  '0028': [L.almacen],
  '0084': [L.provCumplimiento],
  '0085': [L.plan('producto local')],
  // Instalaciones, limpieza y mantenimiento
  '0413': [L.plan('aseos'), L.registros],
  '0414': [L.plan(), L.registros],
  '0415': [L.plan()],
  '0417': [L.mantCalendario],
  '0418': [L.mantAverias],
  '0512': [L.mantEquipos],
  '0519': [L.mantEquipos],
  '0656': [L.mantEquipos],
  '0796': [L.plan()],
  '0797': [L.plan()],
  '0798': [L.plan()],
  '0799': [L.mantCalendario, L.mantEquipos],
  // Cocina e higiene alimentaria
  '0515': [L.recetas],
  '0516': [L.fichas, L.recetas],
  '0517': [L.plan('cocina')],
  '0518': [L.plan('cocina'), L.registros],
  '0532': [L.plan('temperatura'), L.registros],
  '0534': [L.etiquetado, L.caducidades],
  '0535': [L.etiquetado, L.caducidades],
  // Carta y restauración
  '0536': [L.menus],
  '0537': [L.menus, L.menuDigital],
  '0740': [L.menuDigital],
  '0741': [L.alergenos],
  '0743': [L.plan('producto local')],
  '0791': [L.menus],
  // Medio ambiente
  '0765': [L.plan('agua y energía')],
  '0770': [L.plan('agua y energía')],
  '0777': [L.plan('agua y energía')],
  '0779': [L.plan('agua y energía')],
  '0782': [L.plan('residuos')],
  '0783': [L.plan('residuos')],
  '0784': [L.plan('residuos')],
  '0785': [L.plan('residuos')],
  '0786': [L.plan('residuos')],
};
