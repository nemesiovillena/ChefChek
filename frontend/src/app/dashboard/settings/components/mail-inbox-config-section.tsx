'use client';

import { useState } from 'react';
import { Inbox, Loader2, PlugZap } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import { useModules } from '@/features/modules/hooks/use-modules';
import { useMailConfig, useSaveMailConfig, useTestMailConfig } from '@/features/correo/hooks/use-correo';

/**
 * Buzón del restaurante: servidor de entrada (IMAP) y de salida (SMTP) con el
 * mismo usuario y contraseña. La contraseña se guarda cifrada y nunca vuelve
 * al navegador; vacía al editar = conservar la guardada. Solo la ve gerencia.
 */
export function MailInboxConfigSection() {
  const notify = useNotification();
  const { user } = useAuth();
  const { modules, isEnabled } = useModules();
  // Solo gerencia y con el módulo activo (SUPERADMIN nunca: el servidor responde 403)
  const visible = ['ADMIN', 'OWNER'].includes(user?.role ?? '') && modules !== null && isEnabled('correo');
  const { data: config, isLoading } = useMailConfig(visible);
  const saveMut = useSaveMailConfig();
  const testMut = useTestMailConfig();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ host: '', port: '993', user: '', pass: '', smtpHost: '', smtpPort: '465' });

  const startEditing = () => {
    setForm({
      host: config?.host ?? 'imap.hostinger.com',
      port: String(config?.port ?? 993),
      user: config?.user ?? '',
      pass: '',
      smtpHost: config?.smtpHost ?? 'smtp.hostinger.com',
      smtpPort: String(config?.smtpPort ?? 465),
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync({
        host: form.host.trim(),
        port: Number(form.port) || 993,
        user: form.user.trim(),
        pass: form.pass || undefined,
        smtpHost: form.smtpHost.trim() || undefined,
        smtpPort: Number(form.smtpPort) || 465,
      });
      setEditing(false);
      notify({ type: 'success', title: 'Buzón guardado', message: 'Pulsa «Probar conexión» para comprobarlo.' });
    } catch (e) {
      notify({ type: 'error', title: 'No se pudo guardar', message: e instanceof Error ? e.message : '' });
    }
  };

  const handleTest = async () => {
    try {
      const res = await testMut.mutateAsync();
      notify({ type: 'success', title: 'Conexión correcta', message: `${res.folders} carpetas en el buzón.` });
    } catch (e) {
      notify({ type: 'error', title: 'La prueba falló', message: e instanceof Error ? e.message : '' });
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const inputCls =
    'w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)] outline-none focus:border-[var(--primary)]';
  const btnCls =
    'rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]';

  if (!visible) return null;

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <Inbox className="h-5 w-5 text-[var(--primary)]" />
        Correo del restaurante
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Buzón que se lee y desde el que se envía en Personal → Correo. Conexión siempre cifrada; la contraseña se guarda cifrada.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-[var(--on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : !editing ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {config?.configured ? (
            <p className="text-sm text-[var(--on-surface)]">
              {config.user} · entrada {config.host}:{config.port} · salida {config.smtpHost}:{config.smtpPort}
            </p>
          ) : (
            <p className="text-sm italic text-[var(--on-surface-variant)]">Sin configurar.</p>
          )}
          <button type="button" onClick={startEditing} className={btnCls}>
            {config?.configured ? 'Editar' : 'Configurar'}
          </button>
          {config?.configured && (
            <button
              type="button"
              onClick={handleTest}
              disabled={testMut.isPending}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              Probar conexión
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.user} onChange={set('user')} placeholder="Dirección del buzón" type="email" className={inputCls} />
            <input
              value={form.pass}
              onChange={set('pass')}
              placeholder={config?.hasPassword ? 'Contraseña (vacío = conservar)' : 'Contraseña'}
              type="password"
              autoComplete="new-password"
              className={inputCls}
            />
            <input value={form.host} onChange={set('host')} placeholder="Servidor de entrada (imap.hostinger.com)" className={inputCls} />
            <input value={form.port} onChange={set('port')} placeholder="Puerto (993)" type="number" className={inputCls} />
            <input value={form.smtpHost} onChange={set('smtpHost')} placeholder="Servidor de salida (smtp.hostinger.com)" className={inputCls} />
            <input value={form.smtpPort} onChange={set('smtpPort')} placeholder="Puerto de salida (465 o 587)" type="number" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.host.trim() || !form.user.trim() || saveMut.isPending}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saveMut.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={btnCls}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
