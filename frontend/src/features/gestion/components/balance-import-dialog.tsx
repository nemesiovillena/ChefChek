"use client";

import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/contexts/confirm.context";
import { useNotification } from "@/components/notification-system";
import { inputCls } from "@/app/dashboard/check-in/components/check-in-form-styles";
import {
  BALANCE_TARGET_LABEL,
  type BalanceAccountLine,
  type BalanceExtraction,
  type BalanceTarget,
  balanceTotals,
  useApplyBalance,
  useExtractBalance,
} from "../api/gestion-results-api";
import { formatEuros } from "../gestion-format";

const TARGETS = Object.keys(BALANCE_TARGET_LABEL) as BalanceTarget[];
const errText = (e: unknown) => (e instanceof Error ? e.message : "");
const day = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Importar el balance de explotación del gestor: la IA lee las cuentas, se
 * revisa a qué categoría va cada una y, al importar, los gastos del periodo
 * se reparten por meses según las ventas de cada mes.
 */
export function BalanceImportDialog() {
  const notify = useNotification();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useExtractBalance();
  const apply = useApplyBalance();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState<BalanceExtraction | null>(null);
  const [periodIdx, setPeriodIdx] = useState(0);
  // Categoría elegida por cuenta, por periodo (clave «periodo:código»).
  const [targets, setTargets] = useState<Record<string, BalanceTarget>>({});

  const period = data?.periods[periodIdx];
  const lines: BalanceAccountLine[] = (period?.accounts ?? []).map((a) => ({
    ...a,
    target: targets[`${periodIdx}:${a.code}`] ?? a.target,
  }));
  const totals = balanceTotals(lines);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setData(null);
    setTargets({});
    setPeriodIdx(0);
    setOpen(true);
    try {
      setData(await extract.mutateAsync(file));
    } catch {
      // El error se muestra en el diálogo.
    }
  };

  const doApply = async (replaceExisting: boolean): Promise<void> => {
    if (!period) return;
    try {
      const r = await apply.mutateAsync({
        from: period.from,
        to: period.to,
        fileName,
        accounts: lines,
        replaceExisting,
      });
      notify({
        type: "success",
        title: "Balance importado",
        message: `${r.expenses} gasto(s) repartidos en ${r.months} mes(es)${r.replaced ? `; sustituidos ${r.replaced} anteriores` : ""}.`,
      });
      setOpen(false);
    } catch (e) {
      if (!replaceExisting && isAxiosError(e) && e.response?.status === 409) {
        const ok = await confirm({
          title: "Sustituir gastos",
          description: `${errText(e)} Se borrarán todos los gastos de ${day(period.from)} a ${day(period.to)} y se pondrán los del balance.`,
          variant: "destructive",
        });
        if (ok) return doApply(true);
        return;
      }
      notify({
        type: "error",
        title: "No se pudo importar",
        message: errText(e),
      });
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileRef.current?.click()}
      >
        <FileUp className="mr-2 h-4 w-4" />
        Importar balance del gestor
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) =>
          !extract.isPending && !apply.isPending && setOpen(o)
        }
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Balance de explotación{data?.company ? ` · ${data.company}` : ""}
            </DialogTitle>
          </DialogHeader>

          {extract.isPending && (
            <p className="flex items-center gap-2 py-6 text-sm text-[var(--on-surface-variant)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Leyendo «{fileName}»
              con IA. Puede tardar hasta 2 minutos…
            </p>
          )}
          {extract.error && (
            <p className="text-sm text-[var(--error)]">
              {extract.error.message}
            </p>
          )}

          {period && (
            <div className="space-y-4">
              {data.periods.length > 1 && (
                <div
                  className="flex flex-wrap gap-2"
                  role="tablist"
                  aria-label="Periodo"
                >
                  {data.periods.map((p, i) => (
                    <button
                      key={p.from}
                      type="button"
                      role="tab"
                      aria-selected={i === periodIdx}
                      onClick={() => setPeriodIdx(i)}
                      className={`rounded-full border px-3 py-1 text-sm ${i === periodIdx ? "border-[var(--primary)] bg-[var(--primary-container)] text-[var(--on-primary-container)]" : "border-[var(--outline-variant)] text-[var(--on-surface-variant)]"}`}
                    >
                      {day(p.from)} – {day(p.to)}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-sm text-[var(--on-surface-variant)]">
                Revisa a qué va cada cuenta. Los gastos se reparten entre los
                meses del periodo según las ventas de cada mes; ventas y compras
                solo se guardan para cuadrarlas con Cuiner y los albaranes.
              </p>

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Total label="Ventas" value={totals.sales} />
                <Total label="Compras" value={totals.purchases} />
                <Total label="Personal" value={totals.labor} />
                <Total label="Gastos generales" value={totals.overheads} />
                <Total label="Financieros" value={totals.financial} />
                <Total
                  label="Resultado del balance"
                  value={totals.result}
                  strong
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)] text-left text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
                      <th className="px-2 py-2 font-medium">Cuenta</th>
                      <th className="px-2 py-2 text-right font-medium">
                        Saldo
                      </th>
                      <th className="px-2 py-2 font-medium">Va a</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr
                        key={l.code}
                        className={`border-b border-[var(--outline-variant)] ${l.target === "ignorar" ? "opacity-60" : ""}`}
                      >
                        <td className="px-2 py-1.5">
                          <span className="mr-2 tabular-nums text-[var(--on-surface-variant)]">
                            {l.code}
                          </span>
                          {l.name}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatEuros(Math.abs(l.amount))}
                          {l.amount < 0 ? " (ingreso)" : ""}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            aria-label={`Categoría de ${l.name}`}
                            className={`${inputCls} py-1`}
                            value={l.target}
                            onChange={(e) =>
                              setTargets({
                                ...targets,
                                [`${periodIdx}:${l.code}`]: e.target
                                  .value as BalanceTarget,
                              })
                            }
                          >
                            {TARGETS.map((t) => (
                              <option key={t} value={t}>
                                {BALANCE_TARGET_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={apply.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void doApply(false)}
                  disabled={apply.isPending}
                >
                  {apply.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Importar {day(period.from)} – {day(period.to)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Total({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg bg-[var(--surface-container-high)] px-3 py-2">
      <div className="text-xs text-[var(--on-surface-variant)]">{label}</div>
      <div className={`tabular-nums ${strong ? "font-semibold" : ""}`}>
        {formatEuros(value)}
      </div>
    </div>
  );
}
