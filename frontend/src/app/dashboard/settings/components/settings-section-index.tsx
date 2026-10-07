'use client';

import { useAuth } from '@/contexts/auth.context';
import { useModules } from '@/features/modules/hooks/use-modules';

interface SettingsSectionLink {
  id: string;
  label: string;
  /** Módulo que debe estar activo para que la sección se muestre. */
  moduleId?: string;
  /** Solo visible para OWNER/ADMIN (misma regla que RoleAccessPanel). */
  managerOnly?: boolean;
}

/**
 * Índice de Configuración: una entrada por sección, en el mismo orden que la
 * página. Al añadir una sección nueva, darle un `id` en page.tsx y añadirla
 * aquí; las condiciones replican las de la propia sección para no enlazar a
 * algo oculto.
 */
export const SETTINGS_SECTIONS: SettingsSectionLink[] = [
  { id: 'negocio', label: 'Datos del negocio' },
  { id: 'idioma', label: 'Idioma' },
  { id: 'moneda', label: 'Moneda' },
  { id: 'costeo', label: 'Costeo de recetas' },
  { id: 'etiquetas', label: 'Etiquetas', moduleId: 'etiquetado' },
  { id: 'conservacion', label: 'Conservación' },
  { id: 'sicted', label: 'SICTED', moduleId: 'sicted' },
  { id: 'ocr', label: 'Motor de extracción (OCR)' },
  { id: 'correo', label: 'Correo (SMTP)' },
  { id: 'asistente', label: 'Asistente IA' },
  { id: 'mensaje-proveedor', label: 'Mensaje al proveedor' },
  { id: 'claves-api', label: 'Claves API' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'check-in', label: 'Check-in', moduleId: 'check-in', managerOnly: true },
  { id: 'permisos', label: 'Permisos por rol', managerOnly: true },
];

const MANAGER_ROLES = ['OWNER', 'ADMIN'];

/** Barra fija con enlaces a cada sección de Configuración (la página es larga). */
export function SettingsSectionIndex() {
  const { user } = useAuth();
  const { isEnabled } = useModules();
  const isManager = MANAGER_ROLES.includes(user?.role ?? '');
  const visible = SETTINGS_SECTIONS.filter(
    (s) => (!s.moduleId || isEnabled(s.moduleId)) && (!s.managerOnly || isManager),
  );

  return (
    <div
      role="navigation"
      aria-label="Secciones de Configuración"
      className="sticky top-14 z-10 mb-6 -mx-2 flex gap-2 overflow-x-auto md:flex-wrap rounded-lg bg-gray-50/95 px-2 py-3 backdrop-blur dark:bg-zinc-950/90"
    >
      {visible.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="shrink-0 whitespace-nowrap rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm hover:border-indigo-500 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {s.label}
        </a>
      ))}
    </div>
  );
}
