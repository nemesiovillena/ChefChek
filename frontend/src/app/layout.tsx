import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NotificationSystem } from "@/components/notification-system";
import { AuthProvider } from "@/contexts/auth.context";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            {children}
            <NotificationSystem />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}