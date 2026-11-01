import type { MailAddress, MailDetail, SendMode } from '../hooks/use-correo';

/**
 * Valores iniciales del formulario al responder, responder a todos o reenviar.
 * El usuario puede cambiarlo todo antes de enviar.
 */
export interface ComposeDraft {
  mode: SendMode;
  to: string;
  cc: string;
  subject: string;
  ref?: { folder: string; uid: number; uidValidity: string };
  /** Adjuntos del original que se reenviarán (solo informativo). */
  forwardedAttachments: number;
}

const fmt = (a: MailAddress) => (a.name && a.address ? `${a.name} <${a.address}>` : (a.address ?? ''));
const join = (list: MailAddress[]) => list.map(fmt).filter(Boolean).join(', ');

export function prefixSubject(subject: string, mode: SendMode): string {
  const clean = subject.trim();
  if (mode === 'forward') return /^(rv|fw|fwd)\s*:/i.test(clean) ? clean : `RV: ${clean}`;
  if (mode === 'reply' || mode === 'replyAll') return /^re\s*:/i.test(clean) ? clean : `Re: ${clean}`;
  return clean;
}

export function emptyDraft(): ComposeDraft {
  return { mode: 'new', to: '', cc: '', subject: '', forwardedAttachments: 0 };
}

export function draftFrom(detail: MailDetail, mode: SendMode, ownAddress?: string): ComposeDraft {
  const own = ownAddress?.toLowerCase();
  const notOwn = (a: MailAddress) => !!a.address && a.address.toLowerCase() !== own;
  const replyTarget = detail.replyTo.length > 0 ? detail.replyTo : detail.from;
  const ref = { folder: detail.folder, uid: detail.uid, uidValidity: detail.uidValidity };
  const base = { subject: prefixSubject(detail.subject, mode), ref, forwardedAttachments: 0 };

  if (mode === 'forward') {
    return { ...base, mode, to: '', cc: '', forwardedAttachments: detail.attachments.filter((a) => !a.inline).length };
  }
  if (mode === 'replyAll') {
    const to = replyTarget.filter(notOwn);
    const taken = new Set(to.map((a) => a.address!.toLowerCase()));
    const cc = [...detail.to, ...detail.cc].filter((a) => notOwn(a) && !taken.has(a.address!.toLowerCase()));
    return { ...base, mode, to: join(to), cc: join(cc) };
  }
  return { ...base, mode: 'reply', to: join(replyTarget.filter(notOwn).length ? replyTarget.filter(notOwn) : replyTarget), cc: '' };
}
