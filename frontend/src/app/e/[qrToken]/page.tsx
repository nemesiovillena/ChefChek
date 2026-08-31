/**
 * Ficha pública de trazabilidad de una etiqueta de cocina — SIN login.
 * El QR impreso apunta aquí. Server Component: hace el fetch en el servidor
 * contra el endpoint público del backend (`/v1/etiquetado/public/trace/:token`),
 * que devuelve la ficha completa salvo el nombre del responsable (solo iniciales).
 */

export const dynamic = 'force-dynamic';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface PublicLabel {
  lotNumber: string;
  labelType: 'ELABORATED' | 'HANDLED';
  itemName: string;
  preparedAt: string;
  useByDate: string;
  manufacturerExpiryDate: string | null;
  frozenAt: string | null;
  frozenUseByDate: string | null;
  storageCondition: string;
  storageTempMin: number | null;
  storageTempMax: number | null;
  shelfLifeDaysApplied: number | null;
  quantity: number | null;
  quantityUnit: string | null;
  portions: number | null;
  allergens: number[];
  responsibleInitials: string;
  voidedAt: string | null;
  supplier: string | null;
  sourceLotNumber: string | null;
  ingredientLots: Array<{ productName: string; lotNumber: string }>;
}

const STORAGE_LABEL: Record<string, string> = {
  REFRIGERATED: 'Refrigerado',
  FROZEN: 'Congelado',
  AMBIENT: 'Temperatura ambiente',
};

const fmt = (iso: string | null, withTime = false) =>
  iso
    ? new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      }).format(new Date(iso))
    : '—';

async function fetchLabel(qrToken: string): Promise<PublicLabel | null> {
  try {
    const res = await fetch(
      `${API_BASE}/v1/etiquetado/public/trace/${encodeURIComponent(qrToken)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicLabel;
  } catch {
    return null;
  }
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/10 py-2 text-sm">
      <span className="text-black/60">{k}</span>
      <span className="text-right font-medium text-black">{v}</span>
    </div>
  );
}

export default async function PublicLabelPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const label = await fetchLabel(qrToken);

  if (!label) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-[#faf7f2] p-6 text-center text-black">
        <h1 className="text-lg font-semibold">Etiqueta no encontrada</h1>
        <p className="mt-2 text-sm text-black/60">
          El código no corresponde a ninguna etiqueta registrada.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#faf7f2] p-6 text-black">
      <div className="mb-1 text-xs uppercase tracking-widest text-black/50">
        Trazabilidad · ChefChek
      </div>
      <h1 className="text-xl font-bold">{label.itemName}</h1>
      <div className="mt-1 font-mono text-lg font-semibold">{label.lotNumber}</div>
      {label.voidedAt && (
        <div className="mt-2 inline-block rounded bg-[#b8232c] px-2 py-0.5 text-xs font-bold text-white">
          ANULADA
        </div>
      )}

      <div className="mt-4 rounded-xl border border-black/10 bg-white p-4">
        <Row
          k={label.labelType === 'ELABORATED' ? 'Elaboración' : 'Manipulación'}
          v={fmt(label.preparedAt, true)}
        />
        <Row k="Consumo preferente" v={fmt(label.useByDate)} />
        {label.manufacturerExpiryDate && (
          <Row k="Caducidad fabricante" v={fmt(label.manufacturerExpiryDate)} />
        )}
        {label.frozenUseByDate && (
          <Row
            k="Congelado"
            v={`${fmt(label.frozenAt)} · consumir antes ${fmt(label.frozenUseByDate)}`}
          />
        )}
        <Row
          k="Conservación"
          v={`${STORAGE_LABEL[label.storageCondition] ?? label.storageCondition}${
            label.storageTempMin != null && label.storageTempMax != null
              ? ` · ${label.storageTempMin}–${label.storageTempMax} °C`
              : ''
          }`}
        />
        {label.allergens.length > 0 && (
          <Row k="Alérgenos (cód. UE)" v={label.allergens.join(', ')} />
        )}
        {(label.quantity != null || label.portions != null) && (
          <Row
            k="Cantidad"
            v={[
              label.quantity != null
                ? `${label.quantity} ${label.quantityUnit ?? ''}`.trim()
                : null,
              label.portions != null ? `${label.portions} raciones` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        )}
        {label.supplier && <Row k="Proveedor" v={label.supplier} />}
        <Row k="Responsable" v={label.responsibleInitials} />
      </div>

      {label.ingredientLots.length > 0 && (
        <div className="mt-4 rounded-xl border border-black/10 bg-white p-4">
          <div className="mb-2 text-sm font-semibold">Lotes de ingredientes</div>
          {label.ingredientLots.map((il, i) => (
            <div
              key={i}
              className="flex justify-between border-b border-black/10 py-1.5 text-sm"
            >
              <span>{il.productName}</span>
              <span className="font-mono text-black/60">
                {il.lotNumber || 'Sin especificar'}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
