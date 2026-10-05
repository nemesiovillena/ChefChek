'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, LocateFixed, MapPin, Plus, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateWorkCenter, useUpdateWorkCenterGeofence, useWorkCenters } from '@/hooks/use-check-in';
import type { GeofenceMode, WorkCenter } from '@/lib/check-in-types';
import { cardCls, errorMessage, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

const MODE_LABELS: Record<GeofenceMode, string> = {
  OFF: 'No comprobar la ubicación',
  WARN: 'Avisar: se ficha y se marca "fuera de zona"',
  BLOCK: 'Bloquear: no deja fichar fuera de zona',
};

function GeofenceForm({ center }: { center: WorkCenter }) {
  const notify = useNotification();
  const update = useUpdateWorkCenterGeofence();
  const [latitude, setLatitude] = useState(center.latitude != null ? String(center.latitude) : '');
  const [longitude, setLongitude] = useState(center.longitude != null ? String(center.longitude) : '');
  const [radius, setRadius] = useState(center.geofenceRadiusM);
  const [mode, setMode] = useState<GeofenceMode>(center.geofenceMode);
  const [locating, setLocating] = useState(false);

  function fillFromCurrentPosition() {
    if (!('geolocation' in navigator)) {
      notify({ type: 'error', title: 'Ubicación no disponible', message: 'Este dispositivo no la ofrece.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
        notify({
          type: 'success',
          title: 'Ubicación obtenida',
          message: `Precisión aproximada: ${Math.round(pos.coords.accuracy)} m. Pulsa Guardar.`,
        });
      },
      () => {
        setLocating(false);
        notify({ type: 'error', title: 'No se pudo obtener la ubicación', message: 'Revisa el permiso del navegador.' });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const hasLat = latitude.trim() !== '';
    const hasLng = longitude.trim() !== '';
    if (hasLat !== hasLng) {
      notify({ type: 'error', title: 'Coordenadas incompletas', message: 'Indica latitud y longitud, o ninguna.' });
      return;
    }
    try {
      await update.mutateAsync({
        id: center.id,
        data: {
          latitude: hasLat ? Number(latitude) : null,
          longitude: hasLng ? Number(longitude) : null,
          geofenceRadiusM: radius,
          geofenceMode: mode,
        },
      });
      notify({ type: 'success', title: 'Centro guardado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-3`}>
      <p className="flex items-center gap-2 font-semibold">
        <MapPin className="h-4 w-4" /> {center.name}
        {center.isDefault && <span className="text-xs font-normal text-[var(--on-surface-variant)]">(principal)</span>}
      </p>
      {center.address && <p className="text-sm text-[var(--on-surface-variant)]">{center.address}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Latitud</span>
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} inputMode="decimal" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Longitud</span>
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} inputMode="decimal" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Radio (metros)</span>
          <input
            type="number"
            min={20}
            max={5000}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className={inputCls}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelCls}>Al fichar fuera de la zona</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as GeofenceMode)} className={inputCls}>
          {(Object.keys(MODE_LABELS) as GeofenceMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      {latitude.trim() === '' && (
        <p className="text-sm text-[var(--on-surface-variant)]">
          Sin coordenadas no se comprueba la ubicación en este centro.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={fillFromCurrentPosition} disabled={locating} className={secondaryBtnCls}>
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          Usar mi ubicación actual
        </button>
        <button type="submit" disabled={update.isPending} className={primaryBtnCls}>
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
      </div>
    </form>
  );
}

function NewCenterForm({ onDone }: { onDone: () => void }) {
  const notify = useNotification();
  const create = useCreateWorkCenter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      notify({ type: 'error', title: 'Falta el nombre', message: '' });
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), address: address.trim() || undefined });
      notify({ type: 'success', title: 'Centro creado', message: 'Configura ahora su ubicación.' });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-3`}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del centro" className={inputCls} />
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección (opcional)" className={inputCls} />
      <div className="flex gap-2">
        <button type="submit" disabled={create.isPending} className={`${primaryBtnCls} flex-1`}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear centro
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Centros de trabajo: ubicación, radio y comportamiento de la geovalla. */
export function CheckInWorkCentersTab() {
  const { data: centers, isLoading } = useWorkCenters();
  const [adding, setAdding] = useState(false);

  if (isLoading || !centers) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--on-surface-variant)]">
        La ubicación solo se registra en el instante de fichar. Los centros son los mismos locales que usa Compras.
      </p>
      {centers
        .filter((c) => c.isActive)
        .map((c) => (
          <GeofenceForm key={`${c.id}-${c.latitude}-${c.longitude}-${c.geofenceRadiusM}-${c.geofenceMode}`} center={c} />
        ))}
      {adding ? (
        <NewCenterForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={secondaryBtnCls}>
          <Plus className="h-4 w-4" /> Añadir centro
        </button>
      )}
    </div>
  );
}
