/** URL pública que abre el QR (ficha de trazabilidad sin login), dinámica por lote. */
export function traceUrl(qrToken: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/e/${qrToken}`;
}
