'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

/**
 * Buzón del restaurante (leer y enviar). Sin reintentos (ni de react-query ni
 * del api-client) y con 30 s de frescura: cada petición es un login IMAP y
 * las ráfagas pueden hacer que Hostinger bloquee la IP.
 */
const BASE = '/v1/correo';
const NO_RETRY = { noRetry: true } as const;
const QUERY_DEFAULTS = { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } as const;

export interface MailAddress {
  name?: string;
  address?: string;
}

export interface MailFolder {
  path: string;
  name: string;
  specialUse?: string;
}

export interface MailSummary {
  uid: number;
  from: MailAddress[];
  to: MailAddress[];
  subject: string;
  date: string | null;
  seen: boolean;
  hasAttachments: boolean;
  size: number;
}

export interface MailListPage {
  uidValidity: string;
  messages: MailSummary[];
  nextBeforeUid: number | null;
}

export interface MailPart {
  part: string;
  filename: string;
  contentType: string;
  size: number;
  inline: boolean;
}

export interface MailDetail extends MailSummary {
  folder: string;
  uidValidity: string;
  cc: MailAddress[];
  replyTo: MailAddress[];
  tooLarge: boolean;
  html: string | null;
  text: string | null;
  attachments: MailPart[];
  /** Dirección del propio buzón (para «Responder a todos»). */
  mailboxAddress?: string;
}

export interface MailInboxConfig {
  configured: boolean;
  host: string;
  port: number;
  user?: string;
  hasPassword: boolean;
  smtpHost: string;
  smtpPort: number;
}

export interface MailInboxConfigInput {
  host: string;
  port: number;
  user: string;
  pass?: string;
  smtpHost?: string;
  smtpPort?: number;
}

export interface MailAccessEntry {
  id: string;
  createdAt: string;
  kind: 'view' | 'send';
  to: string | null;
  userName: string;
  folder: string;
  subject: string | null;
  from: string | null;
  part: string | null;
}

async function get<T>(url: string, params?: Record<string, string | number | undefined>): Promise<T> {
  return (await apiClient.get<T>(url, { params, ...NO_RETRY })).data;
}

/** Estado HTTP de un error de axios (409 buzón cambiado, 503 no disponible…). */
export function mailErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export function useMailFolders(enabled: boolean) {
  return useQuery({
    queryKey: ['correo', 'folders'],
    queryFn: () => get<MailFolder[]>(`${BASE}/folders`),
    enabled,
    ...QUERY_DEFAULTS,
  });
}

export function useMailMessages(folder: string | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['correo', 'messages', folder],
    queryFn: ({ pageParam }) =>
      get<MailListPage>(`${BASE}/messages`, {
        folder: folder ?? undefined,
        beforeUid: pageParam?.beforeUid,
        uidValidity: pageParam?.uidValidity,
      }),
    initialPageParam: null as { beforeUid: number; uidValidity: string } | null,
    getNextPageParam: (last) =>
      last.nextBeforeUid ? { beforeUid: last.nextBeforeUid, uidValidity: last.uidValidity } : undefined,
    enabled: enabled && !!folder,
    ...QUERY_DEFAULTS,
  });
}

/** "Actualizar": salta la caché del servidor y recarga la primera página. */
export function useRefreshMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folder: string) => {
      await get(`${BASE}/folders`, { fresh: 1 });
      await get(`${BASE}/messages`, { folder, fresh: 1 });
    },
    onSettled: () => queryClient.resetQueries({ queryKey: ['correo'] }),
  });
}

export function useMailMessage(folder: string | null, uid: number | null, uidValidity: string | null) {
  return useQuery({
    queryKey: ['correo', 'message', folder, uidValidity, uid],
    queryFn: () => get<MailDetail>(`${BASE}/messages/${uid}`, { folder: folder ?? undefined, uidValidity: uidValidity ?? undefined }),
    enabled: !!folder && !!uid && !!uidValidity,
    ...QUERY_DEFAULTS,
    staleTime: 5 * 60_000,
  });
}

export function useMailAccessLog(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['correo', 'access-log'],
    queryFn: ({ pageParam }) =>
      get<{ entries: MailAccessEntry[]; nextCursor: string | null }>(`${BASE}/access-log`, {
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useMailConfig(enabled = true) {
  return useQuery({
    queryKey: ['correo', 'config'],
    queryFn: () => get<MailInboxConfig>(`${BASE}/config`),
    enabled,
    retry: false,
  });
}

export function useSaveMailConfig() {
  const queryClient = useQueryClient();
  return useMutation<MailInboxConfig, Error, MailInboxConfigInput>({
    mutationFn: async (data) => (await apiClient.put<MailInboxConfig>(`${BASE}/config`, data, NO_RETRY)).data,
    onSuccess: () => queryClient.resetQueries({ queryKey: ['correo'] }),
  });
}

export function useTestMailConfig() {
  return useMutation<{ ok: true; folders: number }, Error, void>({
    mutationFn: async () => (await apiClient.post(`${BASE}/config/test`, {}, NO_RETRY)).data,
  });
}

export type SendMode = 'new' | 'reply' | 'replyAll' | 'forward';

export interface SendMailInput {
  mode: SendMode;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  text: string;
  /** Correo original al responder o reenviar. */
  ref?: { folder: string; uid: number; uidValidity: string };
  files: File[];
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SEND_TIMEOUT_MS = 180_000;

/** ¿El envío se cortó sin respuesta? Entonces puede que el correo sí saliera. */
export function isUncertainSendError(error: unknown): boolean {
  const e = error as { code?: string; response?: unknown };
  return !e?.response && (e?.code === 'ECONNABORTED' || e?.code === 'ERR_NETWORK' || e?.code === 'ETIMEDOUT');
}

/** Envío (multipart). Nunca se reintenta solo: un reintento podría duplicar el correo. */
export function useSendMail() {
  const queryClient = useQueryClient();
  return useMutation<{ savedToSent: boolean }, Error, SendMailInput>({
    mutationFn: async (input) => {
      const form = new FormData();
      form.append('mode', input.mode);
      form.append('to', input.to);
      if (input.cc.trim()) form.append('cc', input.cc);
      if (input.bcc.trim()) form.append('bcc', input.bcc);
      form.append('subject', input.subject);
      form.append('text', input.text);
      if (input.ref) {
        form.append('refFolder', input.ref.folder);
        form.append('refUid', String(input.ref.uid));
        form.append('refUidValidity', input.ref.uidValidity);
      }
      input.files.forEach((f) => form.append('files', f));
      // Tope amplio: subida + leer original + SMTP + copia. Cortar antes haría
      // creer que falló un correo que el servidor sí envía (y se repetiría).
      return (await apiClient.post<{ savedToSent: boolean }>(`${BASE}/send`, form, { ...NO_RETRY, timeout: SEND_TIMEOUT_MS }))
        .data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correo', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['correo', 'access-log'] });
    },
  });
}

const PREVIEWABLE_IMAGE = /^image\/(png|jpe?g|gif|webp)$/i;

export function isPreviewableImage(contentType: string): boolean {
  return PREVIEWABLE_IMAGE.test(contentType);
}

async function fetchPart(folder: string, uid: number, uidValidity: string, part: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(`${BASE}/messages/${uid}/parts/${part}`, {
    params: { folder, uidValidity },
    responseType: 'blob',
    ...NO_RETRY,
  });
  return response.data;
}

/**
 * Descarga segura: el blob va siempre como application/octet-stream y se
 * guarda con <a download>. Nunca se abre en una pestaña ni se navega a él,
 * así un adjunto HTML/SVG no puede ejecutarse con el origen de la app.
 */
export async function downloadMailPart(
  folder: string,
  uid: number,
  uidValidity: string,
  attachment: MailPart,
): Promise<void> {
  const data = await fetchPart(folder, uid, uidValidity, attachment.part);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Vista previa solo para imágenes rasterizadas (nunca SVG): URL para un <img>. */
export async function previewMailImage(
  folder: string,
  uid: number,
  uidValidity: string,
  attachment: MailPart,
): Promise<string> {
  if (!isPreviewableImage(attachment.contentType)) throw new Error('Este adjunto no tiene vista previa.');
  const data = await fetchPart(folder, uid, uidValidity, attachment.part);
  return URL.createObjectURL(new Blob([data], { type: attachment.contentType.toLowerCase() }));
}
