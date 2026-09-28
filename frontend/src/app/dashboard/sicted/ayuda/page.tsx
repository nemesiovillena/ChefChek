'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface GuideSection {
  id: string;
  title: string;
  steps: ReactNode[];
}

const linkCls = 'font-medium text-[var(--primary)] underline';

/**
 * Guía de uso del módulo SICTED en Chefchek (metodología SICTED 2026). Página
 * estática: si cambia una pantalla del módulo, actualizar aquí el paso afectado.
 */
const SECTIONS: GuideSection[] = [
  {
    id: 'que-es',
    title: '1. Qué hace Chefchek y qué no',
    steps: [
      <>
        SICTED (Sostenibilidad, Inteligencia y Calidad Turística en el Ecosistema del Destino) concede el distintivo{' '}
        <strong>Compromiso de Turismo Responsable</strong>. Lo otorga el Comité de distinción tras una evaluación externa; Chefchek no
        lo concede.
      </>,
      <>
        Chefchek genera las <strong>evidencias</strong> que pide el evaluador (registros con fecha, hora, quién lo hizo y quién lo
        validó) y te ayuda a preparar la autoevaluación. Regla del evaluador: <em>lo que no está registrado, no se ha hecho</em>.
      </>,
      <>
        Los compromisos oficiales (formación en el Campus, asesorías, comité) se gestionan en la web{' '}
        <a href="https://www.sicted.es" target="_blank" rel="noreferrer" className={linkCls}>
          sicted.es
        </a>
        . Chefchek no se conecta con ella: lo que registres aquí sirve de respaldo documental.
      </>,
    ],
  },
  {
    id: 'puesta-en-marcha',
    title: '2. Puesta en marcha (una sola vez, administrador)',
    steps: [
      <>
        En{' '}
        <Link href="/dashboard/settings#sicted" className={linkCls}>
          Configuración → SICTED
        </Link>{' '}
        marca lo que ofrece tu establecimiento (eventos, servicio en barra, aparcamiento…). Así se incluyen las buenas prácticas
        complementarias que te corresponden. Debe coincidir con lo que configure tu asesor en la web oficial.
      </>,
      <>
        En <strong>Dirección → Catálogo</strong> pulsa <em>Cargar catálogo SICTED 2026</em>: 258 buenas prácticas del oficio
        «Restaurantes y empresas de catering» (74 obligatorias) más las complementarias. Si tenías el catálogo anterior, se archiva
        sin borrar nada.
      </>,
      <>
        En <strong>Editar el Plan (plantillas)</strong> revisa las hojas de limpieza, apertura/cierre y temperaturas: zonas,
        frecuencia, producto y dosis reales de tu cocina.
      </>,
      <>
        En <strong>Mantenimiento → Equipos</strong> da de alta los equipos (cámaras, extintores…) y su mantenimiento preventivo.
      </>,
    ],
  },
  {
    id: 'dia-a-dia',
    title: '3. Día a día (personal)',
    steps: [
      <>
        Abre <strong>Hojas de hoy</strong> y marca cada tarea al hacerla. Elige siempre <strong>quién la ha hecho</strong>, aunque uses
        la cuenta compartida de cocina: esa persona es la que figura en la evidencia.
      </>,
      <>
        Si algo no se hace, déjalo anotado con una observación. Los registros no se pueden borrar ni modificar: para corregir se
        añade una nueva anotación con el motivo.
      </>,
      <>
        El encargado <strong>valida</strong> las hojas que lo requieran. En la portada de SICTED verás las pendientes de validar y las
        incompletas de los últimos 7 días.
      </>,
      <>
        Averías: <strong>Mantenimiento → Averías</strong>. Quejas, sugerencias, satisfacción y objetos perdidos:{' '}
        <strong>Cliente</strong>. Incidencias con proveedores e inventario: <strong>Proveedores y aprovisionamiento</strong>.
      </>,
    ],
  },
  {
    id: 'direccion',
    title: '4. Dirección (encargado o propietario)',
    steps: [
      <>
        <strong>Autoevaluación</strong>: crea un ciclo y valora cada buena práctica como <em>Cumple</em>, <em>No cumple</em> o{' '}
        <em>No aplica</em>. Usa «Ver detalle» para leer la descripción oficial, la documentación requerida y, cuando exista, el enlace a
        la evidencia que ya tienes en Chefchek. El filtro «Obligatorias pendientes» muestra lo que bloquea el distintivo.
      </>,
      <>
        Las prácticas marcadas <strong>Esencial</strong> se revisan también en las evaluaciones parciales de los años de seguimiento.
      </>,
      <>
        <strong>Generar acciones de mejora</strong> crea una acción por cada obligatoria sin cumplir. En <strong>Plan de mejora</strong>{' '}
        completa responsable, plazo y evidencia. El programa exige al menos 3 acciones a desarrollar en 3 años.
      </>,
      <>
        <strong>Eventos</strong>: registra los grupos de mejora, la formación del destino, la evaluación externa y, como «Otro», las
        asesorías.{' '}
        <strong>Legal</strong>: documentos con caducidad (extintores, OCA, declaración responsable…); Chefchek avisa antes de que caduquen.
      </>,
      <>
        <strong>Personas</strong>: puestos, plan de formación con asistencia y protocolos con acuse de lectura.
      </>,
    ],
  },
  {
    id: 'evaluacion',
    title: '5. Preparar la evaluación externa',
    steps: [
      <>
        En <strong>Auditoría</strong> descarga el plan y los registros del periodo en PDF o CSV y comprueba que no haya huecos.
      </>,
      <>
        En <strong>Dirección → Informe anual</strong> descarga el resumen del año: objetivos, plan de mejora, formación, clientes,
        proveedores, documentos legales y última autoevaluación cerrada.
      </>,
      <>Cierra la autoevaluación antes de la visita: queda bloqueada y sirve de constancia.</>,
    ],
  },
  {
    id: 'ciclo',
    title: '6. El ciclo del distintivo',
    steps: [
      <>
        Fases: Adhesión → <strong>Distinción</strong> (hasta 2 años) → Seguimiento 1 → Seguimiento 2 → Renovación. Cada fase dura 12
        meses y el distintivo vale 3 años.
      </>,
      <>
        En cada fase hay compromisos: al menos 4 horas de formación (fases de seguimiento y renovación), asesorías, asistencia a un grupo
        de mejora, autoevaluación (obligatoria en Distinción y Renovación) y evaluación externa como máximo 6 meses antes del comité.
      </>,
    ],
  },
];

/** Guía de uso del módulo SICTED. */
export default function SictedHelpPage() {
  const router = useRouter();
  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <button
        type="button"
        onClick={() => router.push('/dashboard/sicted')}
        className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a SICTED
      </button>

      <div className="mb-6">
        <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">Calidad</span>
        <div className="font-headline-lg text-headline-lg text-primary mt-stack-xs flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-[var(--primary)]" />
          Cómo usar SICTED
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-[var(--outline-variant)] px-3 py-1 text-sm hover:bg-[var(--surface-container)]"
          >
            {s.title.replace(/^\d+\.\s*/, '')}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-24 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5"
          >
            <h2 className="mb-3 text-lg font-semibold">{s.title}</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              {s.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
