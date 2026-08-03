import { cn } from '@/lib/utils';

/**
 * Contenedor raíz único para páginas de /dashboard. Fija el mismo ancho
 * máximo (--spacing-container-max-width, docs/design.md) en toda la app
 * en vez de que cada página defina su propio max-w-Nxl (docs/code-standards.md §4).
 */
export default function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('content-container px-4 py-8 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}
