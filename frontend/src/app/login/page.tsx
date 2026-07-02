'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

const tenantLoginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  tenantSlug: z.string().min(1, 'El tenant es requerido'),
});

const superadminLoginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type TenantLoginFormData = z.infer<typeof tenantLoginSchema>;
type SuperadminLoginFormData = z.infer<typeof superadminLoginSchema>;

export default function LoginPage() {
  const { login, loginSuperadmin } = useAuth();
  const router = useRouter();
  const [isSuperadminMode, setIsSuperadminMode] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tenantForm = useForm<TenantLoginFormData>({
    resolver: zodResolver(tenantLoginSchema),
  });

  const superadminForm = useForm<SuperadminLoginFormData>({
    resolver: zodResolver(superadminLoginSchema),
  });

  const onTenantSubmit = async (data: TenantLoginFormData) => {
    setLoading(true);
    setError('');
    try {
      await login(data);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const onSuperadminSubmit = async (data: SuperadminLoginFormData) => {
    setLoading(true);
    setError('');
    try {
      await loginSuperadmin(data.email, data.password);
      router.push('/superadmin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'mt-1 block w-full px-stack-md py-stack-sm bg-[#1a1a1a] text-primary border border-[#333333] rounded-md shadow-inner focus:border-[var(--secondary)] focus:ring-2 focus:ring-[var(--secondary)]/30 focus:outline-none font-body-md text-body-md transition-all duration-200 placeholder-[#444749]';

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-[var(--background)] text-foreground selection:bg-secondary-container selection:text-white px-margin-mobile">
      <div className="max-w-md w-full space-y-stack-lg p-stack-lg bg-[var(--tonal-2)] rounded-xl border border-border shadow-2xl">
        <div className="flex flex-col items-center">
          <h1 className="font-display text-display tracking-tight text-primary uppercase font-extrabold text-4xl mb-stack-xs select-none">
            CHEFCHEK
          </h1>
          <h2 className="mt-stack-sm text-center font-display text-headline-lg text-secondary tracking-tight uppercase">
            {isSuperadminMode ? 'Acceso ChefChek' : 'Iniciar Sesión'}
          </h2>
          <p className="mt-stack-xs text-center font-body-md text-body-md text-on-surface-variant">
            {isSuperadminMode
              ? 'Panel de administración de la plataforma'
              : 'Ingresa a tu cuenta de ChefChek'}
          </p>
        </div>

        {!isSuperadminMode ? (
          <form className="mt-8 space-y-stack-md" onSubmit={tenantForm.handleSubmit(onTenantSubmit)}>
            {error && (
              <div className="bg-[#93000a] border border-[#ffb4ab] text-[#ffdad6] px-stack-md py-stack-sm rounded-md font-body-md text-body-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-stack-xs">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="chef@chefchek.local"
                {...tenantForm.register('email')}
                className={inputClass}
              />
              {tenantForm.formState.errors.email && (
                <p className="mt-2 font-label-sm text-label-sm text-error">{tenantForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-stack-xs">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...tenantForm.register('password')}
                className={inputClass}
              />
              {tenantForm.formState.errors.password && (
                <p className="mt-2 font-label-sm text-label-sm text-error">{tenantForm.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="tenantSlug" className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-stack-xs">
                Organización (Tenant Slug)
              </label>
              <input
                id="tenantSlug"
                type="text"
                autoComplete="organization"
                placeholder="ejemplo: chefchek-demo"
                {...tenantForm.register('tenantSlug')}
                className={inputClass}
              />
              {tenantForm.formState.errors.tenantSlug && (
                <p className="mt-2 font-label-sm text-label-sm text-error">{tenantForm.formState.errors.tenantSlug.message}</p>
              )}
              <p className="mt-2 font-body-md text-label-sm text-on-surface-variant/65 italic">
                Slug de tu organización.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-stack-md px-stack-lg border border-transparent rounded-md font-label-md text-label-md text-[#2d3133] bg-primary hover:bg-opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-bold uppercase tracking-wider cursor-pointer"
              >
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>
            </div>

            <div className="text-center pt-2 border-t border-border/50 space-y-2">
              <a
                href="/register"
                className="block font-label-md text-label-sm text-secondary hover:text-secondary/80 transition-colors uppercase tracking-wider"
              >
                ¿No tienes cuenta? Regístrate
              </a>
              <button
                type="button"
                onClick={() => { setIsSuperadminMode(true); setError(''); }}
                className="block w-full font-label-sm text-label-sm text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
              >
                Acceso ChefChek →
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-stack-md" onSubmit={superadminForm.handleSubmit(onSuperadminSubmit)}>
            {error && (
              <div className="bg-[#93000a] border border-[#ffb4ab] text-[#ffdad6] px-stack-md py-stack-sm rounded-md font-body-md text-body-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="sa-email" className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-stack-xs">
                Correo Electrónico
              </label>
              <input
                id="sa-email"
                type="email"
                autoComplete="email"
                placeholder="superadmin@chefchek.io"
                {...superadminForm.register('email')}
                className={inputClass}
              />
              {superadminForm.formState.errors.email && (
                <p className="mt-2 font-label-sm text-label-sm text-error">{superadminForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="sa-password" className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-stack-xs">
                Contraseña
              </label>
              <input
                id="sa-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...superadminForm.register('password')}
                className={inputClass}
              />
              {superadminForm.formState.errors.password && (
                <p className="mt-2 font-label-sm text-label-sm text-error">{superadminForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-stack-md px-stack-lg border border-transparent rounded-md font-label-md text-label-md text-[#2d3133] bg-primary hover:bg-opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-bold uppercase tracking-wider cursor-pointer"
              >
                {isLoading ? 'Verificando...' : 'Acceder'}
              </button>
            </div>

            <div className="text-center pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => { setIsSuperadminMode(false); setError(''); }}
                className="font-label-sm text-label-sm text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
              >
                ← Volver al login de restaurante
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
