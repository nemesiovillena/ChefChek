'use client';

import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    } else {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    localStorage.setItem('theme', nextTheme ? 'dark' : 'light');
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#e5e2e1]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl animate-spin text-secondary">progress_activity</span>
          <div className="font-label-md text-label-md tracking-wider">VALIDANDO ACCESO...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className={`${isDark ? 'dark' : ''} min-h-screen bg-background text-foreground selection:bg-secondary-container selection:text-white`}>
      {/* Top Navigation Shell */}
      <header className="fixed top-0 w-full z-50 bg-surface-container flex justify-between items-center px-margin-desktop h-stack-xl border-b border-border">
        <div className="flex items-center gap-gutter">
          <span className="material-symbols-outlined text-primary cursor-pointer active:scale-95 duration-200" onClick={() => router.push('/dashboard')}>menu</span>
          <h1 className="font-display text-display tracking-tight text-primary uppercase cursor-pointer" onClick={() => router.push('/dashboard')}>CHEFCHEK</h1>
        </div>
        <div className="hidden md:flex items-center gap-stack-lg">
          <a href="/dashboard" className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1">DASHBOARD</a>
          <a href="/dashboard/recipes" className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1">RECETAS</a>
          <a href="/dashboard/articulos" className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1">ARTÍCULOS</a>
          <a href="/dashboard/menus" className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1">MENÚS</a>
          <a href="/dashboard/production" className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1">PRODUCCIÓN</a>
          <a href="/dashboard/users" className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1">EQUIPO</a>
          <a href="/dashboard/settings" className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1">CONFIGURACIÓN</a>
        </div>
        <div className="flex items-center gap-stack-md">
          <div className="text-right hidden sm:block">
            <p className="font-label-sm text-label-sm text-on-surface-variant">{(user?.role || 'CHEF DE CUISINE').toUpperCase()}</p>
            <p className="font-body-md text-body-md text-primary">{user?.name || 'Marcus V.'}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center overflow-hidden border border-outline-variant cursor-pointer" onClick={() => router.push('/dashboard/settings')}>
            <img 
              alt="Chef Profile" 
              className="object-cover w-full h-full"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyjEviJPItAjkIVE069AOakDc9BxNwOWm9b28J4CyXeWz8GsiEoqfmGJvcojI_ljpYcNv6Ns3Sbhp_39eMXgV6AEF6iwWkH4_3fnwSUX5aV1WRd4GSdBc1hswyFlMBNg1QxZ3ibN7ZoMxA7tpasgN8OuninUUnkyb-esrf2U97m4ENXRPvf1u_3-Uup0A2UXwbPmQmJxxJPKISeMhP8nRk1OsyGBbOFHt0RgD2sqs2V3igDz42dSP8kRMAeHI0se30xtIGpJToJ2c"
            />
          </div>
          <button 
            onClick={toggleTheme}
            className="text-on-surface-variant hover:text-primary cursor-pointer active:scale-95 duration-200 ml-1 p-1 flex items-center justify-center" 
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {isDark ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 hover:rotate-90 transition-transform duration-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.95 4.95l1.59 1.59m10.91 10.91l1.59 1.59M3 12h2.25m13.5 0H21M5.97 18.03l1.59-1.59m10.91-10.91l1.59-1.59M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 hover:-rotate-12 transition-transform duration-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
          <button 
            onClick={logout}
            className="material-symbols-outlined text-on-surface-variant hover:text-error cursor-pointer active:scale-95 duration-200 ml-2" 
            title="Cerrar Sesión"
          >
            logout
          </button>
        </div>
      </header>

      {/* Main content wrapper to push content below the header (height 64px) */}
      <div className="pt-16 min-h-screen">
        {children}
      </div>

      {/* Bottom Nav Shell for Mobile */}
      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center h-20 px-base pb-safe bg-surface-container-high border-t border-border rounded-t-xl md:hidden">
        <a 
          href="/dashboard" 
          className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:text-primary transition-all duration-300 ease-in-out"
        >
          <span className="material-symbols-outlined">dashboard</span>
          <span className="font-label-md text-label-md mt-1">Dashboard</span>
        </a>
        <a 
          href="/dashboard/recipes" 
          className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:text-primary transition-all duration-300 ease-in-out"
        >
          <span className="material-symbols-outlined">receipt_long</span>
          <span className="font-label-md text-label-md mt-1">Recetas</span>
        </a>
        <a
          href="/dashboard/articulos"
          className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:text-primary transition-all duration-300 ease-in-out"
        >
          <span className="material-symbols-outlined">flatware</span>
          <span className="font-label-md text-label-md mt-1">Artículos</span>
        </a>
        <a 
          href="/dashboard/settings" 
          className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:text-primary transition-all duration-300 ease-in-out"
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-label-md text-label-md mt-1">Config</span>
        </a>
      </nav>
    </div>
  );
}