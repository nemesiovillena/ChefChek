/**
 * Módulos complementarios del MBP de "Restaurantes y empresas de catering",
 * agrupados por la condición de inclusión que fija la "Guía para la
 * configuración de los MBP" (SEGITTUR, 18/06/2026). Un mismo hecho del negocio
 * ("organiza eventos") activa varios módulos de ejes distintos, así que el
 * usuario marca la condición y se guardan los `moduleCode` que implica.
 *
 * Cada `moduleCode` complementario del seed 2026 debe aparecer en un único
 * grupo (lo comprueba sicted-complementary-modules.spec.ts).
 */
export interface SictedComplementaryGroup {
  key: string;
  label: string;
  condition: string;
  moduleCodes: string[];
}

export const SICTED_COMPLEMENTARY_GROUPS: SictedComplementaryGroup[] = [
  {
    key: "EVENTOS",
    label: "Eventos",
    condition: "Se realizan u organizan eventos en el establecimiento.",
    moduleCodes: ["072", "155", "175"],
  },
  {
    key: "BARRA",
    label: "Servicio en barra",
    condition: "Dispone de servicio de restauración en barra.",
    moduleCodes: ["102"],
  },
  {
    key: "CATERING",
    label: "Catering",
    condition: "Ofrece servicio de catering.",
    moduleCodes: ["046"],
  },
  {
    key: "COMERCIO",
    label: "Tienda",
    condition: "Dispone de tienda en sus instalaciones.",
    moduleCodes: ["048"],
  },
  {
    key: "DEGUSTACION",
    label: "Degustaciones",
    condition: "Ofrece degustaciones.",
    moduleCodes: ["056"],
  },
  {
    key: "ACTIVIDADES",
    label: "Experiencias y talleres",
    condition:
      "Organiza o coordina actividades complementarias con participación del cliente (talleres, experiencias).",
    moduleCodes: ["074", "111"],
  },
  {
    key: "LUDOTECA",
    label: "Ludoteca infantil",
    condition: "Ofrece servicio de ludoteca o animación para niños y jóvenes.",
    moduleCodes: ["077"],
  },
  {
    key: "APARCAMIENTO",
    label: "Aparcamiento propio",
    condition: "Dispone de aparcamiento en sus instalaciones.",
    moduleCodes: ["027", "028", "029", "148", "178"],
  },
  {
    key: "PUNTO_INFORMACION",
    label: "Punto de información o recepción",
    condition: "Dispone de punto de información o recepción.",
    moduleCodes: ["137"],
  },
  {
    key: "ITINERARIOS",
    label: "Recorridos peatonales",
    condition: "Dispone de recorridos peatonales en sus instalaciones.",
    moduleCodes: ["141"],
  },
  {
    key: "ASCENSORES",
    label: "Ascensores",
    condition: "Dispone de ascensores en sus instalaciones.",
    moduleCodes: ["143"],
  },
  {
    key: "PISTAS",
    label: "Parques y pistas deportivas",
    condition: "Dispone de parques o pistas deportivas.",
    moduleCodes: ["164"],
  },
  {
    key: "MOVILIDAD",
    label: "Movilidad sostenible de clientes",
    condition:
      "Puede sugerir a sus clientes opciones de movilidad más sostenibles.",
    moduleCodes: ["172"],
  },
  {
    key: "VEHICULOS",
    label: "Vehículos propios",
    condition: "Dispone de vehículos.",
    moduleCodes: ["173"],
  },
  {
    key: "RIEGO",
    label: "Zonas verdes con riego",
    condition: "Dispone de zonas verdes que requieren riego.",
    moduleCodes: ["176"],
  },
];
