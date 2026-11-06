'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { MAIL_SEARCH_MAX_CHARS, MAIL_SEARCH_MIN_CHARS } from '../hooks/use-correo';

interface Props {
  /** Búsqueda aplicada ahora mismo ('' = sin filtro). */
  value: string;
  onSearch: (q: string) => void;
}

/**
 * Busca en la carpeta abierta al pulsar Enter o la lupa, nunca al teclear:
 * cada búsqueda es un login IMAP y las ráfagas pueden bloquear la IP.
 */
export function MailSearchBox({ value, onSearch }: Props) {
  const [text, setText] = useState(value);
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MAIL_SEARCH_MIN_CHARS;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tooShort || trimmed === value) return;
    onSearch(trimmed);
  };
  const clear = () => {
    setText('');
    if (value) onSearch('');
  };

  return (
    <form role="search" onSubmit={submit} className="flex items-center gap-1 border-b border-[var(--outline-variant)] px-2 py-1.5">
      <input
        type="search"
        value={text}
        maxLength={MAIL_SEARCH_MAX_CHARS}
        onChange={(e) => setText(e.target.value)}
        placeholder="Buscar remitente, asunto o texto…"
        aria-label="Buscar correos en esta carpeta"
        enterKeyHint="search"
        className="min-h-[40px] min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-variant)] focus:bg-[var(--surface-container)] sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={clear}
          aria-label="Quitar búsqueda"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <button
        type="submit"
        disabled={tooShort}
        aria-label="Buscar"
        title={tooShort ? `Escribe al menos ${MAIL_SEARCH_MIN_CHARS} letras` : 'Buscar'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] disabled:opacity-30"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}
