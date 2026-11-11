import type { MouseEvent } from 'react';

/**
 * Abre el calendario o el reloj nativo al tocar cualquier parte de un
 * input date/time, no solo su iconito (que además pueden tapar extensiones
 * como LastPass).
 */
export function openNativePicker(e: MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // Navegadores antiguos o sin gesto válido: se queda el comportamiento nativo.
  }
}
