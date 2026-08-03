import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabecera única de página (título + subtítulo + acciones), tipografía
 * headline-lg de docs/design.md. Sustituye a los <h1>/<h2> ad-hoc de cada
 * página para que el tamaño/peso del título sea idéntico en toda la app.
 */
export default function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <h1 className="text-headline-lg font-semibold text-[var(--on-surface)]">{title}</h1>
        {subtitle && <p className="mt-2 text-[var(--on-surface-variant)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
