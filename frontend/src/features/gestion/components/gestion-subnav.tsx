'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard/gestion', label: 'Panel' },
  { href: '/dashboard/gestion/rentabilidad', label: 'Rentabilidad' },
  { href: '/dashboard/gestion/menu-engineering', label: 'Menú engineering' },
  { href: '/dashboard/gestion/calendario', label: 'Calendario' },
  { href: '/dashboard/gestion/resultados', label: 'Resultados' },
  { href: '/dashboard/gestion/informes', label: 'Informes' },
  { href: '/dashboard/gestion/tickets', label: 'Tickets' },
];

/**
 * Pestañas de Gestión como rutas propias. Va en <div role="tablist">: globals.css
 * oculta los <nav> que no son fijos.
 */
export function GestionSubnav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/dashboard/gestion' ? pathname === href : pathname.startsWith(href);
  return (
    <div role="tablist" aria-label="Secciones de Gestión" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-[var(--surface-container)] p-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          role="tab"
          aria-selected={isActive(l.href)}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
            isActive(l.href)
              ? 'bg-[var(--primary)] text-primary-foreground'
              : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
