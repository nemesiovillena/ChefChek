'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  tenantSlug: z.string().min(1, 'El tenant es requerido'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError('');

    try {
      await login(data);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-[var(--background)] text-foreground selection:bg-secondary-container selection:text-white px-margin-mobile">
      <div className="max-w-md w-full space-y-stack-lg p-stack-lg bg-[var(--tonal-2)] rounded-xl border border-border shadow-2xl">
        <div className="flex flex-col items-center">
          <h1 className="font-display text-display tracking-tight text-primary uppercase font-extrabold text-4xl mb-stack-xs select-none">
            CHEFCHEK
          </h1>
          <h2 className="mt-stack-sm text-center font-display text-headline-lg text-secondary tracking-tight uppercase">
            Iniciar Sesión
          </h2>
          <p className="mt-stack-xs text-center font-body-md text-body-md text-on-surface-variant">
            Ingresa a tu cuenta de ChefChek
          </p>
        </div>

        <form className="mt-8 space-y-stack-md" onSubmit={handleSubmit(onSubmit)}>
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
              {...register('email')}
              className="mt-1 block w-full px-stack-md py-stack-sm bg-[#1a1a1a] text-primary border border-[#333333] rounded-md shadow-inner focus:border-[var(--secondary)] focus:ring-2 focus:ring-[var(--secondary)]/30 focus:outline-none font-body-md text-body-md transition-all duration-200 placeholder-[#444749]"
            />
            {errors.email && (
              <p className="mt-2 font-label-sm text-label-sm text-error">{errors.email.message}</p>
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
              {...register('password')}
              className="mt-1 block w-full px-stack-md py-stack-sm bg-[#1a1a1a] text-primary border border-[#333333] rounded-md shadow-inner focus:border-[var(--secondary)] focus:ring-2 focus:ring-[var(--secondary)]/30 focus:outline-none font-body-md text-body-md transition-all duration-200 placeholder-[#444749]"
            />
            {errors.password && (
              <p className="mt-2 font-label-sm text-label-sm text-error">{errors.password.message}</p>
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
              {...register('tenantSlug')}
              className="mt-1 block w-full px-stack-md py-stack-sm bg-[#1a1a1a] text-primary border border-[#333333] rounded-md shadow-inner focus:border-[var(--secondary)] focus:ring-2 focus:ring-[var(--secondary)]/30 focus:outline-none font-body-md text-body-md transition-all duration-200 placeholder-[#444749]"
            />
            {errors.tenantSlug && (
              <p className="mt-2 font-label-sm text-label-sm text-error">{errors.tenantSlug.message}</p>
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

          <div className="text-center pt-2 border-t border-border/50">
            <a
              href="/register"
              className="font-label-md text-label-sm text-secondary hover:text-secondary/80 transition-colors uppercase tracking-wider"
            >
              ¿No tienes cuenta? Regístrate
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}