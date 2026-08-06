'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useGenerateProductionReport, type ProductionKpis } from '@/hooks/use-production-reports';

interface ProductionReportDialogProps {
  onClose: () => void;
}

const KPI_LABELS: { key: keyof ProductionKpis; label: string; suffix: string }[] = [
  { key: 'completionRate', label: 'Tasa de completado', suffix: '%' },
  { key: 'efficiency', label: 'Eficiencia', suffix: '%' },
  { key: 'onTimeDelivery', label: 'Entregas a tiempo', suffix: '%' },
  { key: 'staffUtilization', label: 'Utilización de personal', suffix: '%' },
  { key: 'avgTaskDuration', label: 'Duración media de tarea', suffix: ' min' },
  { key: 'alertCount', label: 'Alertas', suffix: '' },
];

export default function ProductionReportDialog({ onClose }: ProductionReportDialogProps) {
  const { mutateAsync: generateReport, data: report, isPending } = useGenerateProductionReport();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canGenerate = startDate.trim() !== '' && endDate.trim() !== '';

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-lg shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Reporte de producción</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Desde</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <Button
            disabled={!canGenerate || isPending}
            onClick={() =>
              generateReport({
                startDate: new Date(`${startDate}T00:00:00`).toISOString(),
                // Fin de día inclusive: "hasta 2026-08-06" debe incluir todo
                // ese día, no cortar en medianoche (si no, filtrar "hasta hoy"
                // deja fuera todo lo de hoy).
                endDate: new Date(`${endDate}T23:59:59.999`).toISOString(),
              })
            }
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generar reporte
          </Button>

          {report && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {KPI_LABELS.map(({ key, label, suffix }) => (
                <Card key={key} className="p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-semibold">
                    {report.kpis[key].toFixed(key === 'alertCount' ? 0 : 1)}
                    {suffix}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
