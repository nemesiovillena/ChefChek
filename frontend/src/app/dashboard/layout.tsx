'use client';

import { useAuth } from '@/contexts/auth.context';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useWebSocketNotifications } from '@/hooks/use-websocket';
import { resolveNotificationRoute } from '@/lib/notification-routes';
import { useModules } from '@/features/modules/hooks/use-modules';
import { AssistantFloatingWidget } from '@/components/assistant/assistant-floating-widget';
import {
  SETTINGS_LINK,
  NAV_GROUPS,
  MOBILE_NAV,
  moduleForPath,
} from '@/features/modules/lib/nav-config';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { modules, refetch, isEnabled } = useModules();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });
  const { unreadCount, markAsRead, markAllAsRead, notifications } = useWebSocketNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  /** Which desktop category dropdown (Cocina/Almacén/...) is open, if any. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  /** Mobile-only "Más" drawer, grouping every category in one sheet. */
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Load module activation states for the current tenant once authenticated.
  useEffect(() => {
    if (isAuthenticated) refetch();
  }, [isAuthenticated, refetch]);

  // Block direct URL access to disabled modules: redirect to /dashboard.
  useEffect(() => {
    if (!modules) return; // wait until module states are loaded
    const mod = moduleForPath(pathname);
    if (mod && !isEnabled(mod)) {
      router.replace('/dashboard');
    }
  }, [pathname, modules, isEnabled, router]);

  // React to a 403 from a disabled module (dispatched by api-client): refresh
  // the module states and leave the blocked route.
  useEffect(() => {
    const onModuleDisabled = () => {
      refetch();
      if (pathname !== '/dashboard') router.replace('/dashboard');
    };
    window.addEventListener('chefchek:module-disabled', onModuleDisabled);
    return () => window.removeEventListener('chefchek:module-disabled', onModuleDisabled);
  }, [refetch, pathname, router]);

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

  useEffect(() => {
    if (!openGroup) return;
    const close = () => setOpenGroup(null);
    document.addEventListener('click', close, { capture: true });
    return () => document.removeEventListener('click', close, { capture: true });
  }, [openGroup]);

  // Filter nav groups: drop empty groups (all items disabled).
  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => isEnabled(item.moduleId)),
      })).filter((group) => group.items.length > 0),
    [isEnabled],
  );

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
    <div className={`${isDark ? 'dark' : ''} min-h-screen bg-background text-foreground`}>
      {/* Top Navigation Shell */}
      <header className="fixed top-0 w-full z-50 bg-surface-container flex justify-between items-center px-margin-desktop h-stack-xl border-b border-border">
        <div className="flex items-center gap-gutter">
          <h1 className="font-display text-display tracking-tight text-primary uppercase cursor-pointer" onClick={() => router.push('/dashboard')}>CHEFCHEK</h1>
        </div>
        <div className="hidden md:flex items-center gap-stack-lg ml-gutter">
          {visibleGroups.map((group) => (
            <div key={group.title} className="relative shrink-0">
              <button
                onClick={() => setOpenGroup(openGroup === group.title ? null : (group.title ?? null))}
                className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1 flex items-center gap-1 uppercase whitespace-nowrap"
              >
                {group.title}
                <span className="material-symbols-outlined text-[16px]">{openGroup === group.title ? 'expand_less' : 'expand_more'}</span>
              </button>
              {openGroup === group.title && (
                <div className="absolute top-8 left-0 w-56 bg-surface-container-high border border-border rounded-lg shadow-xl z-50 overflow-hidden p-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenGroup(null)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-variant hover:text-primary rounded-md transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link
            href={SETTINGS_LINK.href}
            className="font-label-md text-label-md text-on-surface-variant cursor-pointer hover:text-primary transition-colors pb-1 whitespace-nowrap shrink-0"
          >
            {SETTINGS_LINK.label.toUpperCase()}
          </Link>
        </div>
        <div className="flex items-center gap-stack-md">
          <div className="text-right hidden sm:block">
            <p className="font-label-sm text-label-sm text-on-surface-variant">{(user?.role || 'CHEF DE CUISINE').toUpperCase()}</p>
            <p className="font-body-md text-body-md text-primary">{user?.name || 'Marcus V.'}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center overflow-hidden border border-outline-variant cursor-pointer text-sm font-medium text-on-surface-variant" onClick={() => router.push('/dashboard/settings')}>
            {user?.avatarUrl ? (
              <Image
                alt="Foto de perfil"
                width={40}
                height={40}
                className="object-cover w-full h-full"
                src={user.avatarUrl}
              />
            ) : (
              getInitials(user?.name) || <span className="material-symbols-outlined text-[20px]">person</span>
            )}
          </div>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="hidden lg:flex relative text-on-surface-variant hover:text-primary cursor-pointer active:scale-95 duration-200 p-1 items-center justify-center"
            title="Notificaciones"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-error text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="hidden lg:block absolute right-4 sm:right-16 top-14 w-72 sm:w-80 bg-surface-container-high rounded-lg shadow-xl border border-border z-50">
              <div className="p-3 border-b border-border flex justify-between items-center">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Notificaciones</h3>
                <button
                  onClick={markAllAsRead}
                  className="text-secondary text-[11px] hover:underline cursor-pointer"
                >
                  Marcar Todas
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {(() => {
                  const visibleNotifications = showAllNotifications
                    ? notifications
                    : notifications.filter((notif) => !notif.read);
                  return visibleNotifications.length === 0 ? (
                    <p className="p-4 text-center text-on-surface-variant text-xs">
                      {showAllNotifications ? 'No hay notificaciones' : 'No hay notificaciones sin leer'}
                    </p>
                  ) : (
                    visibleNotifications.slice(0, showAllNotifications ? 20 : 5).map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          markAsRead(notif.id);
                          const route = resolveNotificationRoute(notif.entityType, notif.entityId);
                          if (route) {
                            setShowNotifications(false);
                            router.push(route);
                          }
                        }}
                        className={`p-2.5 border-b border-border hover:bg-surface-variant transition-colors cursor-pointer ${!notif.read ? 'bg-surface-container-low' : ''}`}
                      >
                        <p className="text-xs text-primary font-medium">{notif.title}</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">{notif.message}</p>
                        <p className="text-[10px] text-on-surface-variant opacity-75 mt-0.5">
                          {new Date(notif.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                  );
                })()}
              </div>
              <button
                onClick={() => setShowAllNotifications((prev) => !prev)}
                className="w-full p-2 text-center text-secondary text-[11px] hover:underline cursor-pointer border-t border-border"
              >
                {showAllNotifications ? 'Ver no leídas' : 'Ver Todas'}
              </button>
            </div>
          )}
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

      {/* Main content wrapper with bottom padding on mobile to clear fixed bottom nav */}
      <div className="pt-16 pb-28 md:pb-8 min-h-screen">
        {children}
      </div>

      {/* Mobile "Más" Menu Overlay & Drawer */}
      {showMobileMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="fixed bottom-16 left-3 right-3 z-50 max-h-[70vh] bg-surface-container-high border border-border rounded-2xl p-4 shadow-2xl overflow-y-auto md:hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Menú Principal</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="text-on-surface-variant hover:text-primary p-1 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="space-y-3.5">
              {visibleGroups.map((group) => (
                <div key={group.title} className="space-y-1">
                  {group.title && (
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold px-2 py-0.5">
                      {group.title}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setShowMobileMenu(false)}
                        className="flex items-center gap-3 px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-variant hover:text-primary rounded-lg transition-colors active:bg-surface-variant"
                      >
                        <span className="material-symbols-outlined text-[18px] text-secondary">{item.icon}</span>
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-1.5">
                <Link
                  href={SETTINGS_LINK.href}
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-variant hover:text-primary rounded-lg transition-colors active:bg-surface-variant"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">{SETTINGS_LINK.icon}</span>
                  <span className="font-medium">{SETTINGS_LINK.label}</span>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sleek, Compact Bottom Nav Shell for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-16 px-2 pb-safe bg-surface-container-high/95 backdrop-blur-md border-t border-border/80 shadow-lg md:hidden">
        {MOBILE_NAV.filter((item) => isEnabled(item.moduleId)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary active:scale-95 transition-all duration-200 py-1.5 px-2"
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            <span className="text-[10px] font-medium tracking-tight mt-0.5">{item.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary active:scale-95 transition-all duration-200 py-1.5 px-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">apps</span>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Más</span>
        </button>
      </nav>

      {isEnabled('asistente-ia') && <AssistantFloatingWidget />}
    </div>
  );
}
