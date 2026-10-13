'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import { useEmployees } from '@/hooks/use-check-in';
import { useEmployeeDocuments, useUploadEmployeeDocument } from '@/hooks/use-rrhh';
import type { Employee } from '@/lib/check-in-types';
import { DOCUMENT_CATEGORY_LABELS, type EmployeeDocumentCategory } from '@/lib/rrhh-types';
import {
  canManageCheckIn,
  cardCls,
  errorMessage,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';
import { DOCUMENT_ACCEPT, DocumentList } from '../components/document-list';

export const dynamic = 'force-dynamic';

const CATEGORIES = Object.keys(DOCUMENT_CATEGORY_LABELS) as EmployeeDocumentCategory[];
const nameOf = (e: Employee) => [e.firstName, e.lastName].filter(Boolean).join(' ');

/** Subir un documento a una o varias personas (p. ej. un protocolo para todo el equipo). */
function UploadForm({ employees, onDone }: { employees: Employee[]; onDone: () => void }) {
  const notify = useNotification();
  const upload = useUploadEmployeeDocument();
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState<EmployeeDocumentCategory>('CONTRATO');
  const [title, setTitle] = useState('');
  const [requiresAck, setRequiresAck] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const allSelected = selected.length === employees.length;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selected.length === 0 || title.trim().length < 2 || !file) {
      notify({ type: 'error', title: 'Faltan datos', message: 'Elige al menos una persona, un título y el archivo.' });
      return;
    }
    try {
      await upload.mutateAsync({
        employeeIds: selected,
        category,
        title: title.trim(),
        requiresAck,
        expiresAt: expiresAt || undefined,
        file,
      });
      notify({
        type: 'success',
        title: 'Documento subido',
        message: selected.length > 1 ? `Enviado a ${selected.length} personas.` : '',
      });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-4`}>
      <fieldset>
        <legend className={labelCls}>Para quién</legend>
        <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex min-h-[44px] items-center gap-2 font-medium sm:col-span-2 lg:col-span-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : employees.map((e) => e.id))}
              className="h-5 w-5"
            />
            Todo el equipo
          </label>
          {employees.map((employee) => (
            <label key={employee.id} className="flex min-h-[44px] items-center gap-2">
              <input type="checkbox" checked={selected.includes(employee.id)} onChange={() => toggle(employee.id)} className="h-5 w-5" />
              {nameOf(employee)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Contrato indefinido 2026" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Tipo</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as EmployeeDocumentCategory)} className={inputCls}>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Caduca el (opcional)</span>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Archivo (PDF o foto, máx. 10 MB)</span>
          <input type="file" accept={DOCUMENT_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-base" />
        </label>
      </div>
      <label className="flex min-h-[44px] items-center gap-2">
        <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} className="h-5 w-5" />
        Pedir acuse de lectura
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={upload.isPending} className={primaryBtnCls}>
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function TeamDocuments() {
  const { data: employees } = useEmployees(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { data: documents, isLoading } = useEmployeeDocuments(employeeId);
  const active = (employees ?? []).filter((e) => e.isActive);

  const attention = (documents ?? []).filter(
    (d) => d.expiryStatus === 'EXPIRED' || d.expiryStatus === 'EXPIRING' || (d.requiresAck && !d.ackAt),
  ).length;
  return (
    <div className="space-y-4">
      {adding ? (
        <UploadForm employees={active} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={primaryBtnCls}>
          <Upload className="h-4 w-4" /> Subir documento
        </button>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={employeeId ?? ''}
          onChange={(e) => setEmployeeId(e.target.value || null)}
          aria-label="Persona"
          className={`${inputCls} max-w-md`}
        >
          <option value="">Todo el equipo</option>
          {employees?.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {nameOf(employee)}
              {!employee.isActive ? ' (baja)' : ''}
            </option>
          ))}
        </select>
        {attention > 0 && (
          <span className="text-sm text-[var(--on-surface-variant)]">
            {attention} con algo pendiente (caducidad o lectura)
          </span>
        )}
      </div>
      <div className={cardCls}>
        {isLoading || !documents ? (
          <p className="text-[var(--on-surface-variant)]">Cargando…</p>
        ) : (
          <DocumentList documents={documents} scope="team" empty="No hay documentos." />
        )}
      </div>
      <p className="text-sm text-[var(--on-surface-variant)]">
        Cada documento lo ven gerencia y su titular. Un documento con acuse de lectura no se puede retirar. Las nóminas
        no se gestionan aquí.
      </p>
    </div>
  );
}

/** Documentación laboral del equipo: contratos, formación, prevención y justificantes. */
export default function TeamDocumentsPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width space-y-6 pb-28 pt-8">
      <h2 className="font-headline-lg text-headline-lg text-primary">Documentos del equipo</h2>
      {canManageCheckIn(user) ? (
        <TeamDocuments />
      ) : (
        <p className="text-[var(--on-surface-variant)]">Tus documentos están en Mi espacio. Esta página es de gerencia.</p>
      )}
    </div>
  );
}
