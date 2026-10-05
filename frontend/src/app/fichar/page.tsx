'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Delete, FileText, Loader2, MapPin, X } from 'lucide-react';
import ProtectedRoute from '@/components/protected-route';
import { useKioskState, useRecordPunch } from '@/hooks/use-check-in';
import {
  PUNCH_ACTION_LABELS,
  PUNCH_LABELS,
  STATUS_LABELS,
  formatTime,
  getDevicePosition,
  newPunchId,
} from '@/lib/check-in-punch';
import type { KioskEmployee, KioskState, PunchType, WorkStatus } from '@/lib/check-in-types';

export const dynamic = 'force-dynamic';

const CENTER_KEY = 'chefchek.kiosk.centerId';
const CENTER_EVENT = 'chefchek-kiosk-center';
/** Tras fichar o por inactividad, el kiosco vuelve solo a la lista. */
const DONE_SCREEN_MS = 4000;

// ── Centro del dispositivo, recordado en este navegador ─────────────────────
// useSyncExternalStore: leer localStorage durante el render rompe la
// hidratación (el servidor no lo tiene); así el primer render es siempre null.
function subscribeCenter(callback: () => void) {
  window.addEventListener(CENTER_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CENTER_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
function readStoredCenter(): string | null {
  try {
    return window.localStorage.getItem(CENTER_KEY);
  } catch {
    return null;
  }
}
function storeCenter(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CENTER_KEY, id);
    else window.localStorage.removeItem(CENTER_KEY);
  } catch {
    // Sin almacenamiento (modo privado): se elegirá el centro en cada visita.
  }
  window.dispatchEvent(new Event(CENTER_EVENT));
}

// ── Reloj ───────────────────────────────────────────────────────────────────
let clockValue = '';
const clockText = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
function subscribeClock(callback: () => void) {
  clockValue = clockText();
  const timer = window.setInterval(() => {
    const next = clockText();
    if (next !== clockValue) {
      clockValue = next;
      callback();
    }
  }, 1000);
  return () => window.clearInterval(timer);
}

const DOT: Record<WorkStatus, string> = {
  IN: 'bg-[var(--primary)]',
  ON_BREAK: 'bg-amber-500',
  OUT: 'bg-[var(--outline-variant)]',
};
const bigBtn =
  'flex min-h-[72px] items-center justify-center gap-2 rounded-2xl px-4 text-xl font-semibold disabled:opacity-40';

interface DoneInfo {
  name: string;
  type: PunchType;
  time: string;
}

/** Elegir acción + PIN de una persona. Se monta con `key` por empleado. */
function PunchPad({
  employee,
  centerId,
  pinLength,
  onCancel,
  onDone,
}: {
  employee: KioskEmployee;
  centerId: string;
  pinLength: number;
  onCancel: () => void;
  onDone: (info: DoneInfo) => void;
}) {
  const record = useRecordPunch();
  const [chosenType, setType] = useState<PunchType>(employee.allowedTypes[0]);
  // Si la lista se refresca y la acción elegida ya no vale (alguien fichó por
  // otra vía), se cae a la primera permitida.
  const type = employee.allowedTypes.includes(chosenType) ? chosenType : employee.allowedTypes[0];
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(fullPin: string) {
    setSending(true);
    setError(null);
    const id = newPunchId();
    try {
      // El kiosco es fijo: no merece la pena esperar mucho por la ubicación.
      const position = await getDevicePosition(3000);
      const saved = await record.mutateAsync({
        id,
        type,
        employeeId: employee.id,
        pin: fullPin,
        locationId: centerId,
        deviceTime: new Date().toISOString(),
        ...(position ?? {}),
      });
      onDone({ name: employee.name, type, time: formatTime(saved.occurredAt) });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo fichar.');
      setPin('');
      setSending(false);
    }
  }

  function press(digit: string) {
    if (sending || pin.length >= pinLength) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === pinLength) void submit(next);
  }

  if (!employee.hasPin) {
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <p className="text-2xl font-semibold">{employee.name}</p>
        <p className="text-lg text-[var(--on-surface-variant)]">
          Todavía no tienes PIN. Pídeselo a un responsable para poder fichar aquí.
        </p>
        <button type="button" onClick={onCancel} className={`${bigBtn} w-full border border-[var(--outline-variant)]`}>
          <ArrowLeft className="h-6 w-6" /> Volver
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="text-center">
        <p className="text-2xl font-semibold">{employee.name}</p>
        <p className="text-[var(--on-surface-variant)]">{STATUS_LABELS[employee.status]}</p>
      </div>

      <div className="flex gap-2">
        {employee.allowedTypes.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            disabled={sending}
            aria-pressed={type === option}
            className={`${bigBtn} min-h-[60px] flex-1 text-lg ${
              type === option
                ? 'bg-[var(--primary)] text-primary-foreground'
                : 'border border-[var(--outline-variant)]'
            }`}
          >
            {PUNCH_ACTION_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-3" aria-label={`PIN: ${pin.length} de ${pinLength} dígitos`}>
        {Array.from({ length: pinLength }, (_, i) => (
          <span
            key={i}
            className={`h-5 w-5 rounded-full border-2 border-[var(--primary)] ${i < pin.length ? 'bg-[var(--primary)]' : ''}`}
          />
        ))}
      </div>
      <p className="min-h-[28px] text-center text-lg text-[var(--error)]" role="alert">
        {error}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => press(digit)}
            disabled={sending}
            className={`${bigBtn} bg-[var(--surface-container-high)] text-3xl`}
          >
            {digit}
          </button>
        ))}
        <button type="button" onClick={onCancel} disabled={sending} className={`${bigBtn} border border-[var(--outline-variant)]`} aria-label="Cancelar">
          <X className="h-7 w-7" />
        </button>
        <button type="button" onClick={() => press('0')} disabled={sending} className={`${bigBtn} bg-[var(--surface-container-high)] text-3xl`}>
          0
        </button>
        <button
          type="button"
          onClick={() => setPin((prev) => prev.slice(0, -1))}
          disabled={sending}
          className={`${bigBtn} border border-[var(--outline-variant)]`}
          aria-label="Borrar"
        >
          {sending ? <Loader2 className="h-7 w-7 animate-spin" /> : <Delete className="h-7 w-7" />}
        </button>
      </div>
    </div>
  );
}

function LegalTexts({ state, onClose }: { state: KioskState; onClose: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button type="button" onClick={onClose} className={`${bigBtn} min-h-[56px] border border-[var(--outline-variant)] text-lg`}>
        <ArrowLeft className="h-5 w-5" /> Volver
      </button>
      {state.legalTexts.map((text) => (
        <section key={text.id} className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <h2 className="mb-2 text-lg font-semibold">{text.title}</h2>
          <p className="whitespace-pre-line text-sm">{text.content}</p>
        </section>
      ))}
    </div>
  );
}

function Kiosk() {
  const storedCenter = useSyncExternalStore(subscribeCenter, readStoredCenter, () => null);
  const clock = useSyncExternalStore(subscribeClock, () => clockValue, () => '');
  const { data: base, error: baseError } = useKioskState(null);
  // Con un solo centro no hay nada que elegir.
  const centerId =
    base?.centers.find((c) => c.id === storedCenter)?.id ?? (base?.centers.length === 1 ? base.centers[0].id : null);
  const { data: state } = useKioskState(centerId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [showLegal, setShowLegal] = useState(false);

  function handleDone(info: DoneInfo) {
    setSelectedId(null);
    setDone(info);
    window.setTimeout(() => setDone((current) => (current === info ? null : current)), DONE_SCREEN_MS);
  }

  const selected = state?.employees.find((e) => e.id === selectedId) ?? null;

  let content: React.ReactNode;
  if (baseError) {
    content = (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="text-xl font-semibold">No se puede abrir el kiosco</p>
        <p className="text-[var(--on-surface-variant)]">{baseError.message}</p>
        <Link href="/dashboard" className={`${bigBtn} border border-[var(--outline-variant)]`}>
          Volver a ChefChek
        </Link>
      </div>
    );
  } else if (!base) {
    content = <p className="text-center text-[var(--on-surface-variant)]">Cargando…</p>;
  } else if (!base.readiness.ready) {
    content = (
      <div className="mx-auto max-w-md space-y-2 text-center">
        <p className="text-xl font-semibold">El fichaje todavía no está disponible</p>
        <p className="text-[var(--on-surface-variant)]">
          Un administrador tiene que validar los textos legales en Ajustes de fichaje.
        </p>
      </div>
    );
  } else if (!centerId) {
    content = (
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-center text-xl font-semibold">¿En qué centro está este dispositivo?</p>
        {base.centers.map((center) => (
          <button
            key={center.id}
            type="button"
            onClick={() => storeCenter(center.id)}
            className={`${bigBtn} w-full bg-[var(--surface-container-high)]`}
          >
            <MapPin className="h-6 w-6" /> {center.name}
          </button>
        ))}
      </div>
    );
  } else if (!state) {
    content = <p className="text-center text-[var(--on-surface-variant)]">Cargando…</p>;
  } else if (showLegal) {
    content = <LegalTexts state={state} onClose={() => setShowLegal(false)} />;
  } else if (done) {
    content = (
      <button type="button" onClick={() => setDone(null)} className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)] text-primary-foreground">
          <Check className="h-14 w-14" />
        </span>
        <span className="text-3xl font-semibold">{PUNCH_LABELS[done.type]} registrada</span>
        <span className="text-2xl">{done.name}</span>
        <span className="text-2xl text-[var(--on-surface-variant)]">{done.time}</span>
      </button>
    );
  } else if (selected) {
    content = (
      <PunchPad
        key={selected.id}
        employee={selected}
        centerId={centerId}
        pinLength={state.pinLength}
        onCancel={() => setSelectedId(null)}
        onDone={handleDone}
      />
    );
  } else {
    content = (
      <>
        <p className="mb-4 text-center text-xl">Toca tu nombre para fichar</p>
        {state.employees.length === 0 && (
          <p className="text-center text-[var(--on-surface-variant)]">No hay empleados asignados a este centro.</p>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {state.employees.map((employee) => (
            <button
              key={employee.id}
              type="button"
              onClick={() => setSelectedId(employee.id)}
              className={`${bigBtn} flex-col bg-[var(--surface-container-high)] py-3`}
            >
              <span className="text-center leading-tight">{employee.name}</span>
              <span className="flex items-center gap-2 text-sm font-normal text-[var(--on-surface-variant)]">
                <span className={`h-3 w-3 rounded-full ${DOT[employee.status]}`} aria-hidden />
                {STATUS_LABELS[employee.status]}
              </span>
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface)] text-[var(--on-surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--outline-variant)] px-4 py-3">
        <div>
          <p className="text-lg font-semibold">Fichaje</p>
          <p className="text-sm text-[var(--on-surface-variant)]">{state?.center?.name ?? ''}</p>
        </div>
        <p className="text-3xl font-semibold tabular-nums">{clock}</p>
        <div className="flex items-center gap-2 text-sm">
          {state && state.legalTexts.length > 0 && (
            <button type="button" onClick={() => setShowLegal(true)} className="flex min-h-[44px] items-center gap-1 px-2 underline">
              <FileText className="h-4 w-4" /> Información legal
            </button>
          )}
          {base && base.centers.length > 1 && centerId && (
            <button type="button" onClick={() => storeCenter(null)} className="min-h-[44px] px-2 underline">
              Cambiar centro
            </button>
          )}
          <Link href="/dashboard" className="flex min-h-[44px] items-center px-2 underline">
            Salir
          </Link>
        </div>
      </div>
      <div className="flex-1 p-4 md:p-8">{content}</div>
    </div>
  );
}

/** Modo kiosco: dispositivo compartido en el centro; cada persona ficha con su PIN. */
export default function KioskPage() {
  return (
    <ProtectedRoute>
      <Kiosk />
    </ProtectedRoute>
  );
}
