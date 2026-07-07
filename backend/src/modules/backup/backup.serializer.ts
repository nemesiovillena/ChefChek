/**
 * Serialización reversible de filas crudas de Postgres a JSON y viceversa.
 *
 * `JSON.stringify` no soporta `Date`, `BigInt` ni `Buffer`, y al volver a leer
 * un JSON perdemos esos tipos. Marcamos cada valor especial con un tag `__t`
 * para reconstruirlo en la restauración. Los `jsonb` llegan como objetos JS
 * planos (ya son JSON) y los arrays PG como arrays JS, así que pasan tal cual.
 *
 * Convención de tags (no chocan con ningún dato real del schema):
 *   { __t: "date",   v: "2026-01-01T..." }  -> Date
 *   { __t: "bigint", v: "1234567890" }      -> BigInt
 *   { __t: "bytes",  v: "<base64>" }        -> Buffer
 */

type Tagged = { __t: "date" | "bigint" | "bytes"; v: string };

function isTagged(x: unknown): x is Tagged {
  return (
    typeof x === "object" &&
    x !== null &&
    "__t" in x &&
    typeof (x as { __t: unknown }).__t === "string" &&
    "v" in x
  );
}

/** Convierte un valor crudo de BD a su forma JSON-safe. */
export function serializeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { __t: "date", v: value.toISOString() } satisfies Tagged;
  }
  if (typeof value === "bigint") {
    return { __t: "bigint", v: value.toString() } satisfies Tagged;
  }
  if (Buffer.isBuffer(value)) {
    return { __t: "bytes", v: value.toString("base64") } satisfies Tagged;
  }
  return value;
}

/** Reconstruye un valor JSON-safe a su tipo original para reinsertar en BD. */
export function deserializeValue(value: unknown): unknown {
  if (isTagged(value)) {
    if (value.__t === "date") {
      return new Date(value.v);
    }
    if (value.__t === "bigint") {
      return BigInt(value.v);
    }
    if (value.__t === "bytes") {
      return Buffer.from(value.v, "base64");
    }
  }
  return value;
}

/** Serializa una fila completa (objeto plano columna->valor). */
export function serializeRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = serializeValue(v);
  }
  return out;
}

/** Deserializa cada valor de una fila (para INSERT). */
export function deserializeRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = deserializeValue(v);
  }
  return out;
}
