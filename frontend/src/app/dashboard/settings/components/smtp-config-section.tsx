'use client';

import { useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import {
  useSaveSmtpConfig,
  useSmtpConfig,
  useTestSmtp,
} from '@/hooks/use-smtp-config';

/**
 * Configuración SMTP del tenant para enviar pedidos de compra por email.
 * El password se guarda cifrado en el backend y nunca vuelve al navegador
 * (solo el flag hasPassword); dejarlo vacío al editar conserva el guardado.
 */
export function SmtpConfigSection() {
  const addNotification = useNotification();
  const { data: config, isLoading } = useSmtpConfig();
  const saveMut = useSaveSmtpConfig();
  const testMut = useTestSmtp();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    host: '',
    port: '587',
    secure: false,
    user: '',
    pass: '',
    from: '',
  });
  const [testTo, setTestTo] = useState('');

  const startEditing = () => {
    setForm({
      host: config?.host ?? '',
      port: String(config?.port ?? 587),
      secure: config?.secure ?? false,
      user: config?.user ?? '',
      pass: '',
      from: config?.from ?? '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync({
        host: form.host.trim(),
        port: Number(form.port) || 587,
        secure: form.secure,
        user: form.user.trim() || undefined,
        pass: form.pass || undefined,
        from: form.from.trim() || undefined,
      });
      setEditing(false);
      addNotification({
        type: 'success',
        title: 'SMTP guardado',
        message: 'Ya puedes enviar pedidos por email.',
      });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const handleTest = async () => {
    try {
      const result = await testMut.mutateAsync({
        to: testTo.trim() || undefined,
      });
      addNotification({
        type: 'success',
        title: 'Email de prueba enviado',
        message: `Revisa el buzón de ${result.sentTo}`,
      });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'La prueba falló',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const inputCls =
    'w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]';

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <Mail className="h-5 w-5 text-[var(--primary)]" />
        Envío de pedidos por email (SMTP)
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Servidor de correo de tu empresa para enviar los pedidos a proveedores
        con el PDF adjunto. La contraseña se guarda cifrada.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-[var(--on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : !editing ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {config?.configured ? (
            <p className="text-sm text-[var(--on-surface)]">
              {config.host}:{config.port}
              {config.user ? ` · ${config.user}` : ''} ·{' '}
              {config.hasPassword ? 'contraseña guardada' : 'sin contraseña'}
            </p>
          ) : (
            <p className="text-sm italic text-[var(--on-surface-variant)]">
              Sin configurar: los pedidos por email no funcionarán todavía.
            </p>
          )}
          <button
            onClick={startEditing}
            className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
          >
            {config?.configured ? 'Editar' : 'Configurar'}
          </button>
          {config?.configured && (
            <div className="flex items-center gap-2">
              <input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="Email de prueba (opcional)"
                className={`${inputCls} w-56`}
              />
              <button
                onClick={handleTest}
                disabled={testMut.isPending}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {testMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Probar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.host}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              placeholder="Servidor (smtp.miempresa.com)"
              className={inputCls}
            />
            <input
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
              placeholder="Puerto (587)"
              type="number"
              className={inputCls}
            />
            <input
              value={form.user}
              onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
              placeholder="Usuario"
              className={inputCls}
            />
            <input
              value={form.pass}
              onChange={(e) => setForm((f) => ({ ...f, pass: e.target.value }))}
              placeholder={
                config?.hasPassword
                  ? 'Contraseña (vacío = conservar)'
                  : 'Contraseña'
              }
              type="password"
              className={inputCls}
            />
            <input
              value={form.from}
              onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
              placeholder='Remitente ("Compras <compras@mi.com>")'
              className={`${inputCls} sm:col-span-2`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--on-surface)]">
            <input
              type="checkbox"
              checked={form.secure}
              onChange={(e) =>
                setForm((f) => ({ ...f, secure: e.target.checked }))
              }
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Conexión segura (SSL/TLS directo, puerto 465)
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!form.host.trim() || saveMut.isPending}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saveMut.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
