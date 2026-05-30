import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NotificationSystem } from "@/components/notification-system";
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
      <body className="min-h-full flex flex-col">
        {children}
        <NotificationSystem />
      </body>
    </html>
  );
}
