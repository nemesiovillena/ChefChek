'use client';

import { Archive, FilePen, Folder, Inbox, Send, ShieldAlert, Trash2, type LucideIcon } from 'lucide-react';
import type { MailFolder } from '../hooks/use-correo';

const ICONS: Record<string, LucideIcon> = {
  '\\Inbox': Inbox,
  '\\Sent': Send,
  '\\Drafts': FilePen,
  '\\Archive': Archive,
  '\\Junk': ShieldAlert,
  '\\Trash': Trash2,
};

interface Props {
  folders: MailFolder[];
  selected: string | null;
  onSelect: (path: string) => void;
}

/** Carpetas: desplegable en móvil, columna en escritorio. */
export function MailFolderList({ folders, selected, onSelect }: Props) {
  return (
    <>
      <select
        aria-label="Carpeta"
        value={selected ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="min-h-[44px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base lg:hidden"
      >
        {folders.map((f) => (
          <option key={f.path} value={f.path}>
            {f.name}
          </option>
        ))}
      </select>
      <ul className="hidden space-y-1 lg:block">
        {folders.map((f) => (
          <li key={f.path}>
            <button
              type="button"
              onClick={() => onSelect(f.path)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                selected === f.path
                  ? 'bg-[var(--primary)] text-primary-foreground'
                  : 'text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
              }`}
            >
              {(() => { const FolderIcon = ICONS[f.specialUse ?? ''] ?? Folder; return <FolderIcon aria-hidden className="h-[18px] w-[18px] shrink-0" />; })()}
              <span className="truncate">{f.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
