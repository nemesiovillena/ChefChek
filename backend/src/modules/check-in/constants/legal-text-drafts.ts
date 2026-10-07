import { CheckInLegalTextKind } from "@prisma/client";

export interface LegalTextDraft {
  kind: CheckInLegalTextKind;
  title: string;
  /** Qué es y para qué sirve, mostrado al administrador. */
  description: string;
  content: string;
}

/**
 * Borradores orientativos que se siembran al abrir la configuración. NO son
 * asesoramiento jurídico: el administrador del tenant los revisa, adapta y
 * valida antes de poder usar el fichaje. Los corchetes marcan lo que debe
 * completar la empresa.
 */
export const LEGAL_TEXT_DRAFTS: LegalTextDraft[] = [
  {
    kind: CheckInLegalTextKind.REGISTRO_JORNADA_INFO,
    title: "Información sobre el registro de jornada",
    description:
      "Texto que ve cada persona la primera vez que ficha: qué se registra, para qué y qué derechos tiene.",
    content: `La empresa [RAZÓN SOCIAL], con CIF [CIF], registra a diario la jornada de cada persona trabajadora, incluyendo la hora concreta de inicio y de finalización, en cumplimiento del artículo 34.9 del Estatuto de los Trabajadores.

Qué se registra: fecha y hora de cada entrada, salida y pausa; el dispositivo desde el que se ficha; y, cuando está activada, la ubicación en el momento exacto del fichaje.

Para qué: garantizar el cumplimiento de los límites de jornada y descansos, y el cómputo correcto de las horas trabajadas.

Conservación: los registros se conservan durante cuatro años y están a disposición de la persona trabajadora, de sus representantes legales y de la Inspección de Trabajo y Seguridad Social.

Sus derechos: puede consultar sus registros en cualquier momento, solicitar la corrección de un fichaje erróneo indicando el motivo, y ejercer los derechos de acceso, rectificación, limitación y oposición dirigiéndose a [CONTACTO DE PROTECCIÓN DE DATOS].`,
  },
  {
    kind: CheckInLegalTextKind.GEOLOCALIZACION,
    title: "Información sobre geolocalización",
    description:
      "Cláusula informativa sobre el uso de la ubicación al fichar (art. 90 LOPDGDD).",
    content: `La empresa [RAZÓN SOCIAL] informa de que, al fichar, la aplicación puede registrar la ubicación del dispositivo con la única finalidad de comprobar que el fichaje se realiza en el centro de trabajo.

La ubicación se obtiene solo en el instante del fichaje. No se realiza ningún seguimiento continuo ni se registra la ubicación fuera de ese momento.

Base jurídica: el ejercicio de las facultades de control previstas en el artículo 20.3 del Estatuto de los Trabajadores, dentro de los límites del artículo 90 de la Ley Orgánica 3/2018.

Si no se concede el permiso de ubicación en el dispositivo, el fichaje se registra igualmente y queda marcado como "ubicación no disponible".

Puede ejercer sus derechos de acceso, rectificación, limitación del tratamiento y supresión dirigiéndose a [CONTACTO DE PROTECCIÓN DE DATOS].`,
  },
  {
    kind: CheckInLegalTextKind.PROTOCOLO_REGISTRO,
    title: "Protocolo de registro de jornada",
    description:
      "Normas internas de uso del fichaje: cuándo fichar, pausas, olvidos y correcciones.",
    content: `1. Ámbito. Este protocolo se aplica a todas las personas trabajadoras de [RAZÓN SOCIAL].

2. Cuándo fichar. Se ficha la entrada al comenzar efectivamente a trabajar y la salida al terminar. En turno partido se ficha la salida al acabar el primer tramo y la entrada al comenzar el segundo.

3. Pausas. [INDIQUE SI LAS PAUSAS CORTAS SE FICHAN Y SI COMPUTAN COMO TIEMPO DE TRABAJO SEGÚN SU CONVENIO.]

4. Cómo fichar. Desde la cuenta personal en la aplicación o en el dispositivo compartido del centro con el PIN personal. El PIN es personal e intransferible: fichar en nombre de otra persona es una falta.

5. Olvidos y errores. Si se olvida un fichaje o se comete un error, la persona lo comunica solicitando una corrección con su motivo. La corrección la aprueba la persona responsable y queda registrada junto al fichaje original, que nunca se modifica.

6. Horas extraordinarias. Solo se realizan con autorización previa de [RESPONSABLE]. Se totalizan en cada periodo de pago.

7. Consulta. Cada persona puede consultar sus registros en la aplicación. Los representantes legales reciben [PERIODICIDAD] copia de los resúmenes.`,
  },
];

export function findLegalTextDraft(
  kind: CheckInLegalTextKind,
): LegalTextDraft | undefined {
  return LEGAL_TEXT_DRAFTS.find((draft) => draft.kind === kind);
}
