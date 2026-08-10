/** Convierte texto libre (una línea por artículo) en líneas con bullet `•`, descartando vacías. */
export function toBulletLines(text: string, bullet = "•"): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${bullet} ${line}`);
}
