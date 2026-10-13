'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Pencil, Send } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateOwnRequest, useOwnProfile, useOwnRequests } from '@/hooks/use-rrhh';
import { PERSONAL_DATA_LABELS, type OwnProfile, type PersonalDataField } from '@/lib/rrhh-types';
import {
  cardCls,
  errorMessage,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';

const FIELDS = Object.keys(PERSONAL_DATA_LABELS) as PersonalDataField[];

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm text-[var(--on-surface-variant)]">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  );
}

/** Proponer un cambio de mis datos: gerencia lo aprueba antes de aplicarlo. */
function ChangeForm({ profile, onDone }: { profile: OwnProfile; onDone: () => void }) {
  const notify = useNotification();
  const create = useCreateOwnRequest();
  const [values, setValues] = useState(() =>
    Object.fromEntries(FIELDS.map((field) => [field, profile.personal[field] ?? ''])) as Record<PersonalDataField, string>,
  );
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Solo viaja lo que cambia.
    const changes = Object.fromEntries(
      FIELDS.filter((field) => values[field].trim() && values[field].trim() !== (profile.personal[field] ?? '')).map(
        (field) => [field, values[field].trim()],
      ),
    );
    if (Object.keys(changes).length === 0) {
      notify({ type: 'error', title: 'No has cambiado nada', message: 'Modifica al menos un dato.' });
      return;
    }
    try {
      await create.mutateAsync({ kind: 'DATA_CHANGE', changes, message: message.trim() || undefined });
      notify({ type: 'success', title: 'Solicitud enviada', message: 'Tus datos cambiarán cuando se apruebe.' });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-4`}>
      <p className="font-medium">Solicitar un cambio de mis datos</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field} className="block">
            <span className={labelCls}>{PERSONAL_DATA_LABELS[field]}</span>
            <input
              type={field === 'payrollEmail' ? 'email' : 'text'}
              value={values[field]}
              onChange={(e) => setValues({ ...values, [field]: e.target.value })}
              className={inputCls}
            />
          </label>
        ))}
      </div>
      <label className="block">
        <span className={labelCls}>Nota para gerencia (opcional)</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className={`${inputCls} min-h-[72px] py-2`} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={create.isPending} className={primaryBtnCls}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar solicitud
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Mis datos personales y laborales. Los personales se cambian con una solicitud. */
export function MyDataTab() {
  const { data: profile, isLoading } = useOwnProfile();
  const { data: requests } = useOwnRequests();
  const [editing, setEditing] = useState(false);
  if (isLoading || !profile) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

  const pendingChange = requests?.find(
    (r) => r.source === 'REQUEST' && r.status === 'PENDING' && r.title === 'Cambio de datos personales',
  );
  const { job } = profile;
  return (
    <div className="space-y-4">
      <section className={cardCls}>
        <h3 className="mb-3 font-semibold">Datos personales</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label="Nombre" value={profile.name} />
          <Row label="Email de acceso" value={profile.email} />
          {FIELDS.map((field) => (
            <Row key={field} label={PERSONAL_DATA_LABELS[field]} value={profile.personal[field]} />
          ))}
        </dl>
      </section>

      {pendingChange ? (
        <p className={`${cardCls} text-sm`}>
          Tienes un cambio pendiente de respuesta: <span className="font-medium">{pendingChange.detail}</span>
        </p>
      ) : editing ? (
        <ChangeForm profile={profile} onDone={() => setEditing(false)} />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className={secondaryBtnCls}>
          <Pencil className="h-4 w-4" /> Solicitar un cambio
        </button>
      )}

      <section className={cardCls}>
        <h3 className="mb-1 font-semibold">Datos laborales</h3>
        <p className="mb-3 text-sm text-[var(--on-surface-variant)]">Los lleva gerencia. Si algo no es correcto, avisa con una solicitud.</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label="Puesto" value={job.jobTitle} />
          <Row label="Sección" value={job.section} />
          <Row label="Contrato" value={job.contractType} />
          <Row label="Horas semanales" value={`${job.weeklyHours} h`} />
          <Row label="Fecha de alta" value={job.hireDate ? new Date(job.hireDate).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : null} />
          <Row label="Centros" value={job.centers.join(', ')} />
        </dl>
      </section>
    </div>
  );
}
