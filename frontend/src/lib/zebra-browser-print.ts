/**
 * Envío de ZPL a una Zebra conectada por USB vía "Zebra Browser Print": la
 * app oficial de Zebra corre en el PC del usuario (servicio local en
 * localhost:9100) y expone un SDK JS que este módulo carga como <script>. El
 * generador de ZPL (backend, `GET /labels/:id/zpl`) no sabe nada de esto —
 * solo produce texto ZPL; este módulo es la única pieza que sabe *cómo*
 * llegar a la impresora, así el transporte se puede cambiar el día de mañana
 * sin tocar el ZPL.
 *
 * Requiere: la app "Zebra Browser Print" instalada y en marcha en el PC que
 * imprime (Windows/macOS) — el SDK JS por sí solo no imprime nada si esa app
 * no está corriendo, solo fallará al conectar con un mensaje claro. El SDK se
 * carga desde jsDelivr (paquete `zebra-browser-print`, republicación del SDK
 * oficial de Zebra) — mismo código, misma API, verificado contra la versión
 * pineada en `BROWSER_PRINT_SDK_SRC`.
 */

const BROWSER_PRINT_SDK_SRC =
  'https://cdn.jsdelivr.net/npm/zebra-browser-print@1.0.1/index.min.js';
const CONNECT_TIMEOUT_MS = 4000;

interface RawBrowserPrintDevice {
  name: string;
  uid: string;
  connection: string;
  deviceType: string;
  send: (
    data: string,
    onSuccess: () => void,
    onError: (err: unknown) => void,
  ) => void;
  sendThenRead: (
    data: string,
    onSuccess: (readData: string) => void,
    onError: (err: unknown) => void,
  ) => void;
}

interface RawBrowserPrintGlobal {
  getDefaultDevice: (
    deviceType: 'printer',
    onSuccess: (device: RawBrowserPrintDevice) => void,
    onError: (err: unknown) => void,
  ) => void;
  getLocalDevices: (
    onSuccess: (devices: RawBrowserPrintDevice[]) => void,
    onError: (err: unknown) => void,
    deviceType: 'printer',
  ) => void;
}

export interface ZebraDevice {
  name: string;
  uid: string;
  connection: string;
  send(zpl: string): Promise<void>;
  /** Manda un comando y lee la respuesta (p. ej. `~HQES` para el estado de la impresora). */
  sendThenRead(command: string): Promise<string>;
}

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function getGlobal(): RawBrowserPrintGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { BrowserPrint?: RawBrowserPrintGlobal }).BrowserPrint ?? null;
}

let sdkLoadPromise: Promise<void> | null = null;

/** Carga el SDK de Zebra Browser Print (una vez por sesión de página). */
function loadSdk(): Promise<void> {
  if (getGlobal()) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = BROWSER_PRINT_SDK_SRC;
    script.async = true;
    script.onload = () => {
      if (getGlobal()) resolve();
      else reject(new Error('El SDK de Zebra Browser Print cargó pero no expuso "window.BrowserPrint".'));
    };
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(
        new Error(
          `No se pudo cargar el SDK de Zebra Browser Print desde ${BROWSER_PRINT_SDK_SRC}. Comprueba la conexión a internet de este equipo.`,
        ),
      );
    };
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

function wrapDevice(raw: RawBrowserPrintDevice): ZebraDevice {
  return {
    name: raw.name,
    uid: raw.uid,
    connection: raw.connection,
    send(zpl: string) {
      return new Promise<void>((resolve, reject) => {
        raw.send(
          zpl,
          () => resolve(),
          (err) => reject(new Error(errorMessage(err, 'La impresora rechazó el envío.'))),
        );
      });
    },
    sendThenRead(command: string) {
      return new Promise<string>((resolve, reject) => {
        raw.sendThenRead(
          command,
          (data) => resolve(data),
          (err) => reject(new Error(errorMessage(err, 'La impresora no respondió.'))),
        );
      });
    },
  };
}

/** true si la app Zebra Browser Print ya respondió (SDK cargado). No implica que haya impresora. */
export function isBrowserPrintLoaded(): boolean {
  return !!getGlobal();
}

/** Impresora Zebra por defecto (USB) configurada en la app Zebra Browser Print del PC. */
export async function getDefaultZebraPrinter(): Promise<ZebraDevice> {
  await loadSdk();
  const bp = getGlobal();
  if (!bp) {
    throw new Error('Zebra Browser Print no está disponible.');
  }
  const raw = await withTimeout(
    new Promise<RawBrowserPrintDevice>((resolve, reject) => {
      bp.getDefaultDevice(
        'printer',
        (device) => resolve(device),
        (err) => reject(new Error(errorMessage(err, 'No se pudo conectar con Zebra Browser Print.'))),
      );
    }),
    CONNECT_TIMEOUT_MS,
    'Zebra Browser Print no responde. Comprueba que la aplicación está abierta en este PC.',
  );
  // Sin impresora predeterminada en Browser Print, el SDK devuelve un dispositivo
  // sin nombre y el envío falla con "No value for name".
  if (!raw?.name) {
    throw new Error('No se encontró ninguna impresora Zebra por defecto. Conéctala por USB o elígela y guárdala en Ajustes → Etiquetas.');
  }
  return wrapDevice(raw);
}

/** Todas las impresoras que Zebra Browser Print detecta en este PC (para un selector). */
export async function listZebraPrinters(): Promise<ZebraDevice[]> {
  await loadSdk();
  const bp = getGlobal();
  if (!bp) {
    throw new Error('Zebra Browser Print no está disponible.');
  }
  const raws = await withTimeout(
    new Promise<RawBrowserPrintDevice[]>((resolve, reject) => {
      bp.getLocalDevices(
        (devices) => resolve(devices ?? []),
        (err) => reject(new Error(errorMessage(err, 'No se pudo listar las impresoras.'))),
        'printer',
      );
    }),
    CONNECT_TIMEOUT_MS,
    'Zebra Browser Print no responde. Comprueba que la aplicación está abierta en este PC.',
  );
  return raws.map(wrapDevice);
}

/** Envía ZPL a la impresora indicada, o a la que Browser Print tenga por defecto. */
export async function sendZpl(zpl: string, device?: ZebraDevice): Promise<void> {
  const target = device ?? (await getDefaultZebraPrinter());
  await target.send(zpl);
}
