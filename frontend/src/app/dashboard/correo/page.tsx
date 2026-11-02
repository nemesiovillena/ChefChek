'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, PenSquare, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useSectionAccess } from '@/features/modules/hooks/use-section-access';
import {
  mailErrorStatus,
  useMailFolders,
  useMailMessage,
  useMailMessages,
  useRefreshMailbox,
  useMarkOpenedInList,
  type MailPageSize,
  type MailDetail,
  type SendMode,
} from '@/features/correo/hooks/use-correo';
import { draftFrom, emptyDraft, type ComposeDraft } from '@/features/correo/lib/mail-compose-prefill';
import { MailAccessLogTable } from '@/features/correo/components/mail-access-log-table';
import { MailComposeDialog } from '@/features/correo/components/mail-compose-dialog';
import { MailFolderList } from '@/features/correo/components/mail-folder-list';
import { MailMessageList } from '@/features/correo/components/mail-message-list';
import { MailListPager } from '@/features/correo/components/mail-list-pager';
import { MailMessageReader } from '@/features/correo/components/mail-message-reader';

export const dynamic = 'force-dynamic';

const MANAGER_ROLES = ['ADMIN', 'OWNER'];
type Tab = 'bandeja' | 'accesos';

function errorText(error: unknown): string {
  const status = mailErrorStatus(error);
  if (status === 409) return 'El buzón ha cambiado: pulsa «Actualizar».';
  if (status === 503) return error instanceof Error && error.message ? error.message : 'Buzón no disponible, reinténtalo en unos minutos.';
  return error instanceof Error && error.message ? error.message : 'No se pudo cargar el buzón.';
}

/** Buzón del restaurante: leer (todas las carpetas) y, con permiso, enviar. */
export default function CorreoPage() {
  const { user } = useAuth();
  const { map, canSee } = useSectionAccess();
  const isManager = MANAGER_ROLES.includes(user?.role ?? '');
  const accessReady = map !== null && canSee('correo');
  const canSend = map !== null && canSee('correo.enviar');

  const [tab, setTab] = useState<Tab>('bandeja');
  const [folderChoice, setFolderChoice] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<MailPageSize>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [draft, setDraft] = useState<ComposeDraft | null>(null);

  const folders = useMailFolders(accessReady);
  const folder = folderChoice ?? folders.data?.[0]?.path ?? null;
  const messages = useMailMessages(folder, accessReady, pageSize);
  const pages = messages.data?.pages ?? [];
  const uidValidity = pages[0]?.uidValidity ?? null;
  const detail = useMailMessage(folder, selectedUid, uidValidity);
  const refresh = useRefreshMailbox();
  const markOpened = useMarkOpenedInList();
  const isSentFolder = folders.data?.find((f) => f.path === folder)?.specialUse === '\\Sent';

  const selectFolder = (path: string) => {
    setFolderChoice(path);
    setSelectedUid(null);
    setPageIndex(0);
  };
  const changePageSize = (size: MailPageSize) => {
    setPageSize(size);
    setPageIndex(0);
  };
  // Las páginas ya cargadas se reutilizan; solo se pide al servidor la siguiente
  const nextPage = async () => {
    if (pageIndex + 1 >= pages.length) {
      const res = await messages.fetchNextPage();
      if (res.isError) return;
    }
    setPageIndex((i) => i + 1);
  };
  const currentPage = pages[Math.min(pageIndex, Math.max(pages.length - 1, 0))];
  const compose = (mode: SendMode, d?: MailDetail) =>
    setDraft(d ? draftFrom(d, mode, d.mailboxAddress) : emptyDraft());

  const tabCls = (active: boolean) =>
    `flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
      active ? 'bg-[var(--primary)] text-primary-foreground' : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
    }`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* <div> y no <header>/<nav>: globals.css oculta esos elementos si no son fixed */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-[var(--on-surface)]">
            <Mail className="h-7 w-7 text-[var(--primary)]" /> Correo del restaurante
          </h1>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Abrir un correo aquí no lo marca como leído en Outlook ni en el móvil.
          </p>
        </div>
        {tab === 'bandeja' && (
          <div className="flex gap-2">
            {canSend && (
              <button
                type="button"
                onClick={() => compose('new')}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
              >
                <PenSquare className="h-4 w-4" /> Redactar
              </button>
            )}
            <button
              type="button"
              disabled={!folder || refresh.isPending}
              onClick={() => {
                if (!folder) return;
                setPageIndex(0);
                refresh.mutate({ folder, pageSize });
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>
        )}
      </div>

      {isManager && (
        <div role="tablist" aria-label="Secciones del correo" className="mb-4 flex gap-1 rounded-2xl bg-[var(--surface-container)] p-1">
          <button type="button" role="tab" aria-selected={tab === 'bandeja'} onClick={() => setTab('bandeja')} className={tabCls(tab === 'bandeja')}>
            Bandeja
          </button>
          <button type="button" role="tab" aria-selected={tab === 'accesos'} onClick={() => setTab('accesos')} className={tabCls(tab === 'accesos')}>
            Accesos
          </button>
        </div>
      )}

      {tab === 'accesos' && isManager ? (
        <MailAccessLogTable />
      ) : folders.isLoading || !accessReady ? (
        <div className="flex items-center gap-2 p-6 text-[var(--on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Conectando con el buzón…
        </div>
      ) : folders.error ? (
        <div className="rounded-xl border border-[var(--outline-variant)] p-6 text-sm">
          <p className="text-[var(--on-surface)]">{errorText(folders.error)}</p>
          {mailErrorStatus(folders.error) === 400 &&
            (isManager ? (
              <Link href="/dashboard/settings#correo-restaurante" className="mt-2 inline-block text-[var(--primary)] underline">
                Configurar el buzón en Ajustes
              </Link>
            ) : (
              <p className="mt-2 text-[var(--on-surface-variant)]">Pídeselo a gerencia.</p>
            ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[14rem_22rem_1fr]">
          <div className={selectedUid ? 'hidden lg:block' : ''}>
            <MailFolderList folders={folders.data ?? []} selected={folder} onSelect={selectFolder} />
          </div>
          <div className={`overflow-hidden rounded-xl border border-[var(--outline-variant)] ${selectedUid ? 'hidden lg:block' : ''}`}>
            {messages.isLoading ? (
              <div className="flex items-center gap-2 p-6 text-[var(--on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando correos…
              </div>
            ) : messages.error ? (
              <p className="p-6 text-sm text-[var(--error)]">{errorText(messages.error)}</p>
            ) : (
              <MailMessageList
                messages={currentPage?.messages ?? []}
                selectedUid={selectedUid}
                showRecipients={isSentFolder}
                onSelect={(uid) => {
                  setSelectedUid(uid);
                  markOpened(folder, uid);
                }}
                footer={
                  <MailListPager
                    pageSize={pageSize}
                    onPageSize={changePageSize}
                    pageIndex={pageIndex}
                    canPrev={pageIndex > 0}
                    canNext={pageIndex + 1 < pages.length || !!messages.hasNextPage}
                    loading={messages.isFetchingNextPage}
                    onPrev={() => setPageIndex((i) => Math.max(0, i - 1))}
                    onNext={nextPage}
                  />
                }
              />
            )}
          </div>
          <div className={`min-h-[60vh] overflow-hidden rounded-xl border border-[var(--outline-variant)] ${selectedUid ? '' : 'hidden lg:block'}`}>
            <MailMessageReader
              key={selectedUid ?? 'none'}
              detail={detail.data}
              loading={detail.isLoading}
              error={detail.error ? errorText(detail.error) : null}
              canSend={canSend}
              onBack={() => setSelectedUid(null)}
              onCompose={compose}
            />
          </div>
        </div>
      )}

      {draft && <MailComposeDialog draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}
