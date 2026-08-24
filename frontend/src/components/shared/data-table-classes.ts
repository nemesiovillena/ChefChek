/**
 * Clases compartidas para tablas de listado (Artículos, Recetas, Usuarios, ...).
 * Unifica padding/tipografía/tokens de color para que ninguna tabla necesite
 * scroll horizontal en portátil por exceso de padding (docs/code-standards.md §5).
 * Los colores semánticos por fila (badges de estado, botones de acción por
 * color) quedan fuera de este set: son decisiones de cada página.
 */
export const tableCardClass =
  'bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] shadow rounded-lg overflow-hidden';
export const tableScrollClass = 'overflow-x-auto';
export const tableClass = 'min-w-full divide-y divide-[var(--outline-variant)]';
export const theadClass = 'bg-[var(--surface-container-low)]';
export const thBaseClass =
  'px-3 py-3 text-left text-xs font-medium text-[var(--on-surface-variant)] uppercase tracking-wider';
export const thSortableClass = `group ${thBaseClass} cursor-pointer select-none hover:bg-[var(--surface-container-high)] transition-colors duration-150`;
export const thActionsClass = `px-3 py-3 text-right text-xs font-medium text-[var(--on-surface-variant)] uppercase tracking-wider select-none`;
export const tbodyClass = 'bg-[var(--surface-container-lowest)] divide-y divide-[var(--outline-variant)]';
export const trHoverClass = 'hover:bg-[var(--surface-container-low)]';
export const tdBaseClass = 'px-3 py-3 whitespace-nowrap text-sm text-[var(--on-surface-variant)]';
export const tdActionsClass = 'px-3 py-3 whitespace-nowrap text-right text-sm font-medium space-x-1';
export const actionButtonClass = 'inline-flex items-center justify-center p-1.5 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer';
