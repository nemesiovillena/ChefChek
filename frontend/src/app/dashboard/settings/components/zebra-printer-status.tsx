'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Usb, RefreshCw, Printer, Loader2, CheckCircle2, XCircle, ExternalLink, Save, Zap } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import {
  listZebraPrinters,
  sendZpl,
  type ZebraDevice,
} from '@/lib/zebra-browser-print';
import { preparePrinterForDailyUse } from '@/lib/zebra-printer-setup';
import {
  getPreferredZebraDeviceUid,
  setPreferredZebraDeviceUid,
} from '@/hooks/use-food-labels';

function testZpl(widthDots: number, heightDots: number): string {
  return [
    '^XA',
    '^CI28',
    `^PW${widthDots}`,
    `^LL${heightDots}`,
    '^FO20,20^A0N,26,26^FDPrueba ChefChek^FS',
    '^FO20,56^A0N,18,18^FDZebra Browser Print OK^FS',
    '^XZ',
  ].join('\n');
}

/**
 * Estado de Zebra Browser Print (detección de dispositivos USB, selección de
 * impresora preferida, etiqueta de prueba). Vive aparte de
 * `EtiquetadoConfigSection` porque es lógica de navegador/hardware local, no
 * configuración de servidor — nada de esto se guarda en el backend.
 */
export function ZebraPrinterStatus() {
  const addNotification = useNotification();
  // Impresora guardada en este navegador: la que usan las etiquetas reales.
  const [savedUid, setSavedUid] = useState(getPreferredZebraDeviceUid() ?? '');
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [preparing, setPreparing] = useState(false);

  // Se comprueba sola al abrir Ajustes (y con "Comprobar"): así, tras apagar
  // el PC o la impresora, no parece que la configuración se haya perdido.
  // Si aún no hay ninguna guardada y solo hay una Zebra, se guarda esa.
  const probe = useQuery({
    queryKey: ['zebra-printers'],
    queryFn: async () => {
      const found = await listZebraPrinters();
      if (!getPreferredZebraDeviceUid() && found.length === 1) {
        setPreferredZebraDeviceUid(found[0].uid);
        setSavedUid(found[0].uid);
      }
      return found;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  const devices: ZebraDevice[] = probe.data ?? [];
  const errorMsg =
    probe.error instanceof Error ? probe.error.message : 'No se pudo comprobar la impresora.';
  const savedConnected = devices.some((d) => d.uid === savedUid);
  const selectedUid =
    selectedDraft && devices.some((d) => d.uid === selectedDraft)
      ? selectedDraft
      : savedConnected
        ? savedUid
        : (devices[0]?.uid ?? '');
  const isSaved = !!selectedUid && selectedUid === savedUid;
  const state = probe.isFetching
    ? 'checking'
    : probe.isError
      ? 'error'
      : probe.data
        ? devices.length
          ? 'found'
          : 'empty'
        : 'idle';

  const check = () => {
    void probe.refetch();
  };

  const savePrinter = () => {
    setPreferredZebraDeviceUid(selectedUid || null);
    setSavedUid(selectedUid);
    const device = devices.find((d) => d.uid === selectedUid);
    addNotification({
      type: 'success',
      title: 'Impresora guardada',
      message: device ? `Las etiquetas se imprimirán en ${device.name}.` : '',
    });
  };

  const printTest = async () => {
    setTesting(true);
    try {
      const device = devices.find((d) => d.uid === selectedUid);
      await sendZpl(testZpl(480, 320), device);
      addNotification({ type: 'success', title: 'Etiqueta de prueba enviada', message: '' });
    } catch (e: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo imprimir la prueba',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    } finally {
      setTesting(false);
    }
  };

  /**
   * Un solo uso (idempotente): activa el auto-calibrado al encender + guarda
   * la config de media troquelada. Con esto, apagar la impresora (o el PC) y
   * encender deja la impresora lista — sin el ritual manual de FEED cada día.
   */
  const preparePrinter = async () => {
    setPreparing(true);
    try {
      const device = devices.find((d) => d.uid === selectedUid);
      if (!device) {
        throw new Error('No hay ninguna impresora seleccionada.');
      }
      const result = await preparePrinterForDailyUse(device);
      if (result === 'auto-calibrate-on') {
        addNotification({
          type: 'success',
          title: 'Impresora preparada',
          message:
            'Calibrará sola al encender. Apágala y enciéndela una vez: sacará unas etiquetas midiendo el rollo y quedará lista. Ya no hace falta calibrar a mano cada mañana.',
        });
      } else {
        addNotification({
          type: 'warning',
          title: 'Configuración guardada, sin auto-calibrado',
          message:
            'Esta impresora no admite calibrar al encender. Si las etiquetas descuadran, usa el botón FEED como se indica abajo.',
        });
      }
    } catch (e: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo preparar la impresora',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-4 dark:border-zinc-800">
      <div className="flex items-center gap-2 mb-2">
        <Usb className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold">Impresora Zebra (Browser Print)</h3>
      </div>
      <p className="text-xs text-gray-500 mb-1">
        Las etiquetas térmicas se envían directas por USB con{' '}
        <span className="font-medium">Zebra Browser Print</span> (app oficial de
        Zebra, gratuita, para Windows/macOS). Instálala en el PC que imprime y
        pulsa &quot;Comprobar&quot;.
      </p>
      <a
        href="https://www.zebra.com/us/en/support-downloads/software/printer-software/browser-print.html"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mb-3 dark:text-indigo-400"
      >
        Descargar Zebra Browser Print
        <ExternalLink className="h-3 w-3" />
      </a>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={check}
          disabled={state === 'checking'}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {state === 'checking' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Comprobar
        </button>

        {state === 'found' && (
          <span className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            {devices.length === 1 ? '1 impresora detectada' : `${devices.length} impresoras detectadas`}
          </span>
        )}
        {state === 'empty' && (
          <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
            <XCircle className="h-4 w-4" />
            No se ve ninguna impresora: comprueba que la Zebra está encendida,
            con la luz verde y conectada por USB, y pulsa Comprobar.
          </span>
        )}
        {state === 'error' && (
          <span className="inline-flex items-center gap-1 text-sm text-red-700 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            {errorMsg}
          </span>
        )}
      </div>

      {devices.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <label className="text-sm">
            <span className="block text-gray-600 dark:text-gray-400">
              Impresora a usar
            </span>
            <select
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
              style={{ colorScheme: 'light dark' }}
              value={selectedUid}
              onChange={(e) => setSelectedDraft(e.target.value)}
            >
              {devices.map((d) => (
                <option key={d.uid} value={d.uid}>
                  {d.name} ({d.connection})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={printTest}
            disabled={testing || preparing}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Imprimir prueba
          </button>
          <button
            type="button"
            onClick={preparePrinter}
            disabled={preparing || testing}
            title="Una vez: la impresora calibrará sola cada vez que se encienda"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {preparing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Preparar impresora
          </button>
          <button
            type="button"
            onClick={savePrinter}
            disabled={!selectedUid || isSaved}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Guardar
          </button>
          {isSaved ? (
            <span className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Impresora guardada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
              <XCircle className="h-4 w-4" />
              Sin guardar: pulsa Guardar para usarla en las etiquetas
            </span>
          )}
        </div>
      )}
      {/* La calibración REMOTA (~JC) dejó la impresora en error en una ZD220d
          real (commit cdf522f) — nunca se envía desde la app. "Preparar
          impresora" activa en cambio el auto-calibrado del propio firmware al
          encender (SGD media.power_up_action), que es el camino seguro. */}
      <div className="rounded-md border border-gray-200 p-3 text-xs text-gray-600 dark:border-zinc-800 dark:text-gray-400">
        <p className="mb-1 font-semibold text-gray-700 dark:text-gray-300">
          ¿Descuadran las etiquetas o salen en blanco de más?
        </p>
        <p className="mb-2">
          Pulsa <span className="font-medium">«Preparar impresora»</span> una vez: desde
          entonces calibrará sola cada vez que se encienda y no hará falta el ritual
          manual de abajo cada mañana. Al cambiar a un rollo de otra medida tampoco hace
          falta nada: el auto-calibrado del arranque re-mide el rollo.
        </p>
        <p className="mb-1 font-semibold text-gray-700 dark:text-gray-300">
          Calibración manual (fallback, si no preparaste la impresora)
        </p>
        <ol className="list-decimal space-y-0.5 pl-4">
          <li>Con la luz verde fija, mantén pulsado el botón FEED y suéltalo tras el 2º parpadeo.</li>
          <li>Sacará unas etiquetas y se parará. Al pulsar FEED debe salir una sola.</li>
          <li>
            Si se queda en rojo: mantén FEED y suelta tras el 4º parpadeo (restaura la
            configuración de fábrica) y vuelve a calibrar.
          </li>
        </ol>
      </div>
    </div>
  );
}
