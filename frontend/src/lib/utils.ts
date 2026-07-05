import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formato monetario español: coma decimal y símbolo detrás ("1.234,56 €").
export function formatEuro(value: number, decimals = 2): string {
  const n = (value ?? 0).toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n} €`;
}

// Convierte un texto en slug URL-safe: minúsculas, sin acentos, guiones.
// El backend exige slug único por tenant+context al crear categorías.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
