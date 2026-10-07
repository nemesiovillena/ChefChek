import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NotificationSystem } from "@/components/notification-system";
import { GlobalDblclickSelect } from "@/components/global-dblclick-select";
import { AuthProvider } from "@/contexts/auth.context";
import { ConfirmProvider } from "@/contexts/confirm.context";
import { QueryProvider } from "@/lib/query-client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChefChek - Gestión Profesional de Cocinas",
  description: "Sistema multi-tenant para gestión de escandallos, recetas, menús y control de producción",
  // App instalable (fichaje sin conexión): ver public/manifest.webmanifest y public/sw.js.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ChefChek", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// El service worker solo se registra en el build de producción: en desarrollo
// los ficheros de Next no llevan huella y una caché los dejaría viejos.
const REGISTER_SERVICE_WORKER =
  "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: antes de hidratar, el script de abajo añade
    // `ms-fonts-ready` y el tema `dark` a <html>; el className del cliente
    // difiere a propósito del del servidor. Solo silencia atributos de <html>.
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Los iconos se renderizan como el nombre del glifo en texto
            ("local_shipping") hasta que la fuente de iconos lo convierte en
            ligadura. Edge antiguo no puede cargar la fuente variable woff2 y
            deja ese texto visible (recortado a una letra por el overflow de
            globals.css). Los spans .material-symbols-outlined arrancan ocultos
            y solo se revelan si document.fonts confirma que la fuente cargó
            de verdad. En navegadores que no cargan la fuente (o sin la API)
            los iconos no se muestran, en vez de mostrar texto basura. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var f='24px \"Material Symbols Outlined\"';if(!document.fonts||!document.fonts.load)return;document.fonts.load(f).then(function(){if(document.fonts.check(f))document.documentElement.classList.add('ms-fonts-ready');},function(){});}catch(e){}})();",
          }}
        />
        {process.env.NODE_ENV === "production" && (
          <script dangerouslySetInnerHTML={{ __html: REGISTER_SERVICE_WORKER }} />
        )}
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <QueryProvider>
          <GlobalDblclickSelect />
          <AuthProvider>
            <ConfirmProvider>
              {children}
              <NotificationSystem />
            </ConfirmProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}