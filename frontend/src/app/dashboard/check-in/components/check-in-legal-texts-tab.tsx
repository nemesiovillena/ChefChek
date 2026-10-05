'use client';

import { useState } from 'react';
import { CheckCircle2, FileWarning, Loader2, Save, ShieldCheck } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useLegalTexts, useSaveLegalText, useValidateLegalText } from '@/hooks/use-check-in';
import type { LegalTextState } from '@/lib/check-in-types';
import { cardCls, errorMessage, inputCls, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

/** Campos entre corchetes que la empresa aún no ha completado. */
const pendingPlaceholders = (content: string) => content.match(/\[[^\]]+\]/g) ?? [];

function LegalTextEditor({ state }: { state: LegalTextState }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const save = useSaveLegalText();
  const validate = useValidateLegalText();
  const [content, setContent] = useState(state.latest.content);

  const dirty = content.trim() !== state.latest.content;
  const latestIsValidated = state.latest.validatedAt !== null;
  const placeholders = pendingPlaceholders(content);
  const busy = save.isPending || validate.isPending;

  async function handleSave() {
    try {
      await save.mutateAsync({ kind: state.kind, content });
      notify({
        type: 'success',
        title: 'Texto guardado',
        message: latestIsValidated ? 'Es una versión nueva: hay que validarla.' : '',
      });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  async function handleValidate() {
    const ok = await confirm({
      title: `Validar: ${state.title}`,
      description:
        'Confirmas que has revisado el texto y que es correcto para tu empresa. Quedará registrado tu nombre y la fecha.',
    });
    if (!ok) return;
    try {
      if (dirty) await save.mutateAsync({ kind: state.kind, content });
      await validate.mutateAsync(state.kind);
      notify({ type: 'success', title: 'Texto validado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo validar', message: errorMessage(err) });
    }
  }

  return (
    <section className={`${cardCls} space-y-3`}>
      <div>
        <h3 className="font-semibold">{state.title}</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">{state.description}</p>
      </div>

      {state.current ? (
        <p className="flex items-start gap-2 text-sm text-[var(--primary)]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Vigente: versión {state.current.version}, validada por {state.current.validatedByName ?? '—'} el{' '}
          {state.current.validatedAt ? formatDate(state.current.validatedAt) : '—'}.
          {state.hasPendingChanges && ' Hay cambios posteriores guardados sin validar.'}
        </p>
      ) : (
        <p className="flex items-start gap-2 text-sm text-[var(--error)]">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          Borrador sin validar. Mientras no se valide no se puede fichar.
        </p>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        aria-label={state.title}
        className={`${inputCls} min-h-[260px] py-2`}
      />

      {placeholders.length > 0 && (
        <p className="text-sm text-[var(--error)]">
          Faltan por completar: {[...new Set(placeholders)].join(', ')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleSave} disabled={busy || !dirty} className={secondaryBtnCls}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar borrador
        </button>
        <button
          type="button"
          onClick={handleValidate}
          disabled={busy || placeholders.length > 0 || (latestIsValidated && !dirty)}
          className={primaryBtnCls}
        >
          {validate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Validar texto
        </button>
      </div>
    </section>
  );
}

/** Textos legales: revisar, adaptar y validar antes de poder usar el fichaje. */
export function CheckInLegalTextsTab() {
  const { data: texts, isLoading } = useLegalTexts();
  if (isLoading || !texts) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--on-surface-variant)]">
        Estos textos son borradores orientativos, no asesoramiento jurídico. Complétalos con los datos de tu empresa,
        revísalos (recomendable con tu gestoría) y valídalos. Hasta entonces no se puede fichar.
      </p>
      {texts.map((state) => (
        // key con la versión: tras guardar o validar, el editor se remonta con el contenido del servidor.
        <LegalTextEditor key={`${state.kind}-${state.latest.id}-${state.latest.validatedAt}`} state={state} />
      ))}
    </div>
  );
}
