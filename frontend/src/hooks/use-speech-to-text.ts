'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado por voz para inputs de texto, sobre la Web Speech API
 * (`SpeechRecognition` / `webkitSpeechRecognition`). Soportado en Chrome
 * Android y Safari iOS ≥ 14.5, que es donde el asistente Chefchek se usa más
 * desde el móvil. En navegadores sin soporte, `supported` es `false` y el
 * componente simplemente no muestra el botón de micrófono.
 *
 * El hook no posee el texto del input: emite el transcript acumulado de la
 * sesión de dictado vía `onResult`, y el componente decide cómo fusionarlo
 * con lo que el usuario ya había escrito.
 */

// La Web Speech API no está en las typings de lib.dom, así que declaramos lo
// mínimo que usamos.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Traduce los códigos de error de la API a mensajes en español accionables. */
function messageForError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permite el acceso al micrófono para dictar tu pregunta.';
    case 'no-speech':
      return 'No te he oído. Toca el micrófono e inténtalo de nuevo.';
    case 'audio-capture':
      return 'No se ha detectado ningún micrófono.';
    case 'network':
      return 'Sin conexión para transcribir la voz.';
    default:
      return 'No se ha podido usar el dictado por voz.';
  }
}

interface UseSpeechToTextOptions {
  /** Idioma BCP-47 del reconocimiento. Por defecto español de España. */
  lang?: string;
  /** Transcript acumulado de la sesión actual de dictado. */
  onResult: (transcript: string, meta: { isFinal: boolean }) => void;
}

interface UseSpeechToTextResult {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useSpeechToText({
  lang = 'es-ES',
  onResult,
}: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Texto ya finalizado en esta sesión; los tramos interinos se le anteponen
  // en cada evento para que el input muestre las palabras en vivo.
  const finalTranscriptRef = useRef('');

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    setError(null);
    finalTranscriptRef.current = '';

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTranscriptRef.current =
            `${finalTranscriptRef.current} ${text}`.trim();
        } else {
          interim += text;
        }
      }
      const combined = `${finalTranscriptRef.current} ${interim}`.trim();
      onResult(combined, { isFinal: interim.length === 0 });
    };

    recognition.onerror = (event) => {
      setError(messageForError(event.error));
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() lanza si ya hay un reconocimiento activo; lo ignoramos.
      recognitionRef.current = null;
    }
  }, [lang, onResult]);

  // Único efecto: cortar el micrófono si el componente se desmonta mientras
  // escucha (p. ej. al cerrar el widget flotante del asistente).
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { supported, listening, error, start, stop };
}
