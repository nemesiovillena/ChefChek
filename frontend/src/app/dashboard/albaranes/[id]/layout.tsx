'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FileText, Layers } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function AlbaranDetailLayout({ children, params }: LayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { id } = use(params);

  // Conserva ?returnTo= al cambiar de pestaña: sin esto, entrar desde un
  // Pedido y saltar de Resumen a Líneas perdía el origen y "Confirmar"
  // volvía siempre a Albaranes en vez de al Pedido.
  const returnTo = searchParams.get('returnTo');
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';

  const tabs = [
    { label: 'Resumen', href: `/dashboard/albaranes/${id}/resumen${query}`, icon: FileText, active: pathname.includes('/resumen') },
    { label: 'Líneas', href: `/dashboard/albaranes/${id}/lineas${query}`, icon: Layers, active: pathname.includes('/lineas') },
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab.active
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
