'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useOwnDocuments, useUploadOwnDocument } from '@/hooks/use-rrhh';
import { cardCls, errorMessage, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from '../../check-in/components/check-in-form-styles';
import { DOCUMENT_ACCEPT, DocumentList } from '../../rrhh/components/document-list';

/** Subir un justificante (parte médico, cita…). */
function JustificanteForm({ onDone }: { onDone: () => void }) {
  const notify = useNotification();
  const upload = useUploadOwnDocument();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2 || !file) {
      notify({ type: 'error', title: 'Falta el título o el archivo', message: '' });
      return;
    }
    try {
      await upload.mutateAsync({ title: title.trim(), file });
      notify({ type: 'success', title: 'Justificante enviado', message: '' });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-3`}>
      <label className="block">
        <span className={labelCls}>Qué es</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Justificante médico del 12 de octubre" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Archivo (PDF o foto, máx. 10 MB)</span>
        <input type="file" accept={DOCUMENT_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-base" />
      </label>
      <p className="text-sm text-[var(--on-surface-variant)]">Solo lo verán gerencia y tú. No hace falta que indique el diagnóstico.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={upload.isPending} className={primaryBtnCls}>
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Mis documentos laborales: consultarlos, dar acuse de lectura y subir justificantes. */
export function MyDocumentsTab() {
  const { data: documents, isLoading } = useOwnDocuments();
  const [adding, setAdding] = useState(false);
  if (isLoading || !documents) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  return (
    <div className="space-y-4">
      {adding ? (
        <JustificanteForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={primaryBtnCls}>
          <Upload className="h-4 w-4" /> Subir un justificante
        </button>
      )}
      <div className={cardCls}>
        <DocumentList documents={documents} scope="own" empty="Aún no tienes documentos." />
      </div>
      <p className="text-sm text-[var(--on-surface-variant)]">
        «He leído este documento» deja constancia de la lectura con fecha y hora. No es una firma electrónica.
      </p>
    </div>
  );
}
