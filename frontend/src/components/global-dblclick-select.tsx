'use client';

import { useEffect } from 'react';

/**
 * Seleccionar todo el contenido de un campo con un gesto sencillo.
 *
 * Cubre dos casos para ser robusto:
 *  1) Doble-clic nativo (`dblclick`) sobre un <input>/<textarea>.
 *  2) Dos clics (eventos `click`) sobre el MISMO campo en menos de 800 ms.
 *     Esto es más tolerante que el `dblclick` nativo: los eventos `click`
 *     siempre se disparan (uno por pulsación), mientras que `dblclick` depende
 *     del umbral del SO/trackpad y a veces no llega. Así, gestos lentos o con
 *     trackpad siguen seleccionando todo.
 *
 * No es destructivo: un único clic no selecciona (solo cuenta como primer clic).
 */
export function GlobalDblclickSelect() {
  useEffect(() => {
    const isField = (
      t: EventTarget | null,
    ): t is HTMLInputElement | HTMLTextAreaElement =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

    const selectAll = (el: HTMLInputElement | HTMLTextAreaElement) => {
      try {
        el.select();
      } catch {
        /* noop */
      }
    };

    const onDblClick = (e: MouseEvent) => {
      if (isField(e.target)) selectAll(e.target);
    };

    let lastClick = { target: null as EventTarget | null, time: 0 };
    const onClick = (e: MouseEvent) => {
      if (!isField(e.target)) {
        lastClick = { target: null, time: 0 };
        return;
      }
      const now = Date.now();
      if (lastClick.target === e.target && now - lastClick.time < 800) {
        selectAll(e.target);
        lastClick = { target: null, time: 0 };
      } else {
        lastClick = { target: e.target, time: now };
      }
    };

    document.addEventListener('dblclick', onDblClick);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('dblclick', onDblClick);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return null;
}
