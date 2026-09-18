import type { FoodLabelForPrint } from "../types/food-label-for-print.type";
import { euAllergenName } from "../../../common/constants/eu-allergens";

/**
 * Texto de cada campo de la etiqueta, compartido entre `FoodLabelPdfService`
 * (A4) y `FoodLabelZplService` (térmica Zebra) para que las reglas de negocio
 * (LOTE de compra, congelado, HANDLED, alérgenos...) no diverjan entre ambos
 * renderers.
 */

const STORAGE_LABEL: Record<string, string> = {
  REFRIGERATED: "REFRIGERADO",
  FROZEN: "CONGELADO",
  AMBIENT: "TEMP. AMBIENTE",
};

export function fmtDate(d: Date | null): string {
  if (!d) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

export function fmtDateTime(d: Date | null): string {
  if (!d) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Rango de temperaturas de conservación, p. ej. "0–4 °C" o "≤ 4 °C". */
export function tempsText(label: FoodLabelForPrint): string {
  const min = label.storageTempMin;
  const max = label.storageTempMax;
  if (min !== null && max !== null) {
    return `${min}–${max} °C`;
  }
  if (max !== null) {
    return `≤ ${max} °C`;
  }
  return "";
}

export function storageText(label: FoodLabelForPrint): string {
  const cond = STORAGE_LABEL[label.storageCondition] ?? label.storageCondition;
  const temps = tempsText(label);
  return temps ? `${cond}  ${temps}` : cond;
}

/**
 * "LOTE <nº>" — HANDLED sin lote de proveedor se ancla en la fecha de compra
 * ("LOTE compra <fecha>") en vez de mostrar un nº de lote inexistente.
 */
export function lotLine(label: FoodLabelForPrint): string {
  const lotText =
    label.labelType === "HANDLED" && !label.sourceLotId && label.purchaseDate
      ? `compra ${fmtDate(label.purchaseDate)}`
      : label.lotNumber;
  return `LOTE ${lotText}`;
}

export function prepLine(label: FoodLabelForPrint): string {
  const prepWord = label.labelType === "ELABORATED" ? "Elab." : "Manip.";
  return `${prepWord}: ${fmtDateTime(label.preparedAt)}`;
}

export function consumeLine(label: FoodLabelForPrint): string {
  return `Consumir: ${fmtDate(label.useByDate)}`;
}

/**
 * Congelado: fecha + temperaturas en una sola línea (el consumo preferente ya
 * va aparte). Sin congelado: conservación normal.
 */
export function conservationLine(label: FoodLabelForPrint): string {
  if (label.frozenAt) {
    const temps = tempsText(label);
    return `congelado ${fmtDate(label.frozenAt)}${temps ? ` · ${temps}` : ""}`;
  }
  return storageText(label);
}

/** HANDLED: proveedor (si se conoce) + caducidad fabricante. Null si no aplica. */
export function handledExtraLine(label: FoodLabelForPrint): string | null {
  if (label.labelType !== "HANDLED") {
    return null;
  }
  const supplier = label.supplierName ?? label.sourceLot?.supplier?.name;
  const parts: string[] = [];
  if (supplier) {
    parts.push(`Prov.: ${supplier}`);
  }
  if (label.manufacturerExpiryDate) {
    parts.push(`Cad. fábrica: ${fmtDate(label.manufacturerExpiryDate)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** "Alérgenos: ..." (nombres Reg. UE 1169/2011). Null si la etiqueta no declara ninguno. */
export function allergensLine(label: FoodLabelForPrint): string | null {
  if (!label.allergens.length) {
    return null;
  }
  return `Alérgenos: ${label.allergens.map((a) => euAllergenName(a)).join(", ")}`;
}

/** "Ingr.: ..." con nº de lote por ingrediente. Null si no aplica (solo ELABORATED). */
export function ingredientsLine(label: FoodLabelForPrint): string | null {
  if (label.labelType !== "ELABORATED" || !label.ingredientLots.length) {
    return null;
  }
  return (
    "Ingr.: " +
    label.ingredientLots
      .map((il) =>
        il.lotNumber
          ? `${il.productName.toLowerCase()} (L:${il.lotNumber})`
          : il.productName.toLowerCase(),
      )
      .join(", ")
  );
}

export function responsableLine(label: FoodLabelForPrint): string {
  return `Resp.: ${label.createdByName}`;
}
