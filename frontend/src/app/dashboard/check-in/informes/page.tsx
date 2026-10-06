'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Copy, Download, FileSpreadsheet, FileText, Link2, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import {
  downloadWorkdayReport,
  useCreateInspectionLink,
  useEmployees,
  useInspectionLinks,
  useRevokeInspectionLink,
  useVerifyIntegrity,
} from '@/hooks/use-check-in';
import { MONTH_NAMES } from '@/lib/check-in-punch';
import type { InspectionLink, ReportFormat } from '@/lib/check-in-types';
import {
  canManageCheckIn,
  cardCls,
  errorMessage,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../components/check-in-form-styles';
import { CheckInMonthPicker, currentYearMonth, type YearMonth } from '../components/check-in-month-picker';

export const dynamic = 'force-dynamic';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const monthLabel = (year: number, month: number) => `${MONTH_NAMES[month - 1]} ${year}`;
/** "2026-10" <-> { year, month } para <input type="month">. */
const toInput = ({ year, month }: YearMonth) => `${year}-${String(month).padStart(2, '0')}`;
const fromInput = (value: string): YearMonth => ({ year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) });

const FORMATS: { format: ReportFormat; label: string; icon: typeof FileText }[] = [
  { format: 'pdf', label: 'PDF', icon: FileText },
  { format: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { format: 'csv', label: 'CSV', icon: Download },
];

/** Descarga del registro de jornada del mes, de todo el equipo o de una persona. */
function DownloadCard() {
  const notify = useNotification();
  const { data: employees } = useEmployees(true);
  const [period, setPeriod] = useState<YearMonth>(currentYearMonth);
  const [employeeId, setEmployeeId] = useState('');
  const [busy, setBusy] = useState<ReportFormat | null>(null);

  async function handleDownload(format: ReportFormat) {
    setBusy(format);
    try {
      await downloadWorkdayReport({ ...period, format, employeeId: employeeId || undefined });
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo generar el informe', message: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`${cardCls} space-y-4`}>
      <div>
        <h3 className="text-lg font-semibold">Registro de jornada</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          El documento que pide la Inspección de Trabajo: jornadas de cada día con sus horas de entrada y salida, las
          correcciones con su motivo y los totales del mes. El PDF trae espacio para firmas.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <CheckInMonthPicker value={period} onChange={setPeriod} />
        <label className="block min-w-[220px] flex-1">
          <span className={labelCls}>Persona</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
            <option value="">Todo el equipo</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {[e.lastName, e.firstName].filter(Boolean).join(', ')}
                {!e.isActive ? ' (baja)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map(({ format, label, icon: Icon }, index) => (
          <button
            key={format}
            type="button"
            onClick={() => handleDownload(format)}
            disabled={busy !== null}
            className={index === 0 ? primaryBtnCls : secondaryBtnCls}
          >
            {busy === format ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            Descargar {label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Comprueba que nadie ha alterado los fichajes por fuera de la aplicación. */
function IntegrityCard() {
  const notify = useNotification();
  const verify = useVerifyIntegrity();
  const result = verify.data;

  async function handleVerify() {
    try {
      await verify.mutateAsync();
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo verificar', message: errorMessage(err) });
    }
  }

  return (
    <section className={`${cardCls} space-y-3`}>
      <div>
        <h3 className="text-lg font-semibold">Integridad del registro</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Cada fichaje va encadenado al anterior con una huella. Esta comprobación recorre toda la cadena: si alguien
          cambiara, quitara o añadiera un fichaje directamente en la base de datos, se detectaría aquí.
        </p>
      </div>
      <button type="button" onClick={handleVerify} disabled={verify.isPending} className={secondaryBtnCls}>
        {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Verificar ahora
      </button>
      {result && result.ok && (
        <p className="flex items-start gap-2 text-sm text-[var(--primary)]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Registro íntegro: {result.checked} fichajes comprobados el {formatDateTime(result.checkedAt)}. Huella final:{' '}
          <code className="break-all">{result.lastHash?.slice(0, 16) ?? '—'}</code>
        </p>
      )}
      {result && !result.ok && (
        <p className="flex items-start gap-2 text-sm text-[var(--error)]">
          <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
          La cadena se rompe en el fichaje n.º {result.brokenAtSeq}: ese registro o el anterior se ha modificado fuera
          de la aplicación. Avisa a soporte antes de entregar ningún informe.
        </p>
      )}
    </section>
  );
}

function LinkRow({ link }: { link: InspectionLink }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const revoke = useRevokeInspectionLink();

  async function handleRevoke() {
    const ok = await confirm({
      title: 'Revocar enlace',
      description: 'Quien lo tenga dejará de poder consultar el registro. No se puede deshacer.',
    });
    if (!ok) return;
    try {
      await revoke.mutateAsync(link.id);
      notify({ type: 'success', title: 'Enlace revocado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  const range =
    link.fromYear === link.toYear && link.fromMonth === link.toMonth
      ? monthLabel(link.fromYear, link.fromMonth)
      : `${monthLabel(link.fromYear, link.fromMonth)} – ${monthLabel(link.toYear, link.toMonth)}`;
  const status = link.revokedAt ? 'Revocado' : link.active ? `Activo hasta el ${formatDateTime(link.expiresAt)}` : 'Caducado';

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-medium capitalize">
          {link.label ? `${link.label} · ` : ''}
          {range}
        </p>
        <p className={`text-sm ${link.active ? 'text-[var(--primary)]' : 'text-[var(--on-surface-variant)]'}`}>{status}</p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Creado por {link.createdByName} el {formatDateTime(link.createdAt)} · {link.accessCount} acceso
          {link.accessCount === 1 ? '' : 's'}
          {link.lastAccessAt && `, el último el ${formatDateTime(link.lastAccessAt)}`}
        </p>
      </div>
      {link.active && (
        <button type="button" onClick={handleRevoke} disabled={revoke.isPending} className={secondaryBtnCls}>
          Revocar
        </button>
      )}
    </li>
  );
}

/** Enlaces de solo lectura para entregar a un inspector. */
function InspectionLinksCard() {
  const notify = useNotification();
  const { data: links } = useInspectionLinks();
  const create = useCreateInspectionLink();
  const now = currentYearMonth();
  const [from, setFrom] = useState(toInput(now));
  const [to, setTo] = useState(toInput(now));
  const [validDays, setValidDays] = useState(7);
  const [label, setLabel] = useState('');
  // El enlace recién creado: solo se puede ver ahora.
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const start = fromInput(from);
    const end = fromInput(to);
    try {
      const link = await create.mutateAsync({
        label: label.trim() || undefined,
        fromYear: start.year,
        fromMonth: start.month,
        toYear: end.year,
        toMonth: end.month,
        validDays,
      });
      setCreatedUrl(`${window.location.origin}/inspeccion/${link.token}`);
      setLabel('');
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo crear el enlace', message: errorMessage(err) });
    }
  }

  async function handleCopy() {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      notify({ type: 'success', title: 'Enlace copiado', message: '' });
    } catch {
      notify({ type: 'warning', title: 'No se pudo copiar', message: 'Selecciónalo y cópialo a mano.' });
    }
  }

  return (
    <section className={`${cardCls} space-y-4`}>
      <div>
        <h3 className="text-lg font-semibold">Enlace para la Inspección</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Crea un enlace de solo lectura para que un inspector descargue el registro de los meses que elijas, sin cuenta
          en ChefChek. Caduca solo, puedes revocarlo y cada acceso queda anotado.
        </p>
      </div>

      <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-4">
        <label className="block">
          <span className={labelCls}>Desde</span>
          <input type="month" value={from} max={toInput(now)} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Hasta</span>
          <input type="month" value={to} min={from} max={toInput(now)} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Válido durante</span>
          <select value={validDays} onChange={(e) => setValidDays(Number(e.target.value))} className={inputCls}>
            {[1, 3, 7, 15, 30].map((days) => (
              <option key={days} value={days}>
                {days} día{days === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Nota (opcional)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej.: visita del 12/11" className={inputCls} />
        </label>
        <button type="submit" disabled={create.isPending} className={`${primaryBtnCls} md:col-span-4 md:w-fit`}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Crear enlace
        </button>
      </form>

      {createdUrl && (
        <div className="space-y-2 rounded-lg border border-[var(--primary)] bg-[var(--surface-container-lowest)] p-3">
          <p className="text-sm font-medium">Copia el enlace ahora: por seguridad no se vuelve a mostrar.</p>
          <p className="break-all text-sm">{createdUrl}</p>
          <button type="button" onClick={handleCopy} className={secondaryBtnCls}>
            <Copy className="h-4 w-4" /> Copiar
          </button>
        </div>
      )}

      {links && links.length > 0 && (
        <ul className="divide-y divide-[var(--outline-variant)]">
          {links.map((link) => (
            <LinkRow key={link.id} link={link} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Informes legales del registro de jornada. Solo para quien gestiona el módulo. */
export default function CheckInReportsPage() {
  const { user, isLoading: authLoading } = useAuth();
  if (authLoading) return null;
  if (!canManageCheckIn(user)) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-24 pt-8">
        <p className="text-[var(--on-surface-variant)]">
          Esta sección es solo para administradores, desde su cuenta personal.
        </p>
      </div>
    );
  }
  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width space-y-6 pb-28 pt-8">
      <h2 className="font-headline-lg text-headline-lg text-primary">Informes de jornada</h2>
      <DownloadCard />
      <InspectionLinksCard />
      <IntegrityCard />
    </div>
  );
}
