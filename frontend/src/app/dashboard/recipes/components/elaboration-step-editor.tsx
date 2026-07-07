'use client';

import { Plus } from 'lucide-react';
import StepRow, { ElaborationStep } from './step-row';

export type { ElaborationStep };

const EMPTY_STEP: ElaborationStep = {
  description: '',
  equipment: null,
  time: null,
  temperature: null,
};

interface ElaborationStepEditorProps {
  steps: ElaborationStep[];
  onStepsChange: (steps: ElaborationStep[]) => void;
}

export default function ElaborationStepEditor({ steps, onStepsChange }: ElaborationStepEditorProps) {
  const handleAddStep = () => {
    onStepsChange([...steps, { ...EMPTY_STEP }]);
  };

  const handleStepChange = (index: number, step: ElaborationStep) => {
    const updated = [...steps];
    updated[index] = step;
    onStepsChange(updated);
  };

  const handleStepRemove = (index: number) => {
    onStepsChange(steps.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...steps];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onStepsChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === steps.length - 1) return;
    const updated = [...steps];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onStepsChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-[var(--on-surface)]">
          Pasos de elaboración
        </label>
        <button
          type="button"
          onClick={handleAddStep}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:brightness-110 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Añadir paso
        </button>
      </div>

      {steps.length === 0 ? (
        <div className="text-center py-6 text-[var(--on-surface-variant)] text-sm border border-dashed border-[var(--outline-variant)] rounded-xl bg-[var(--surface-container-lowest)]">
          No hay pasos. Haz clic en &quot;Añadir paso&quot; para comenzar.
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {steps.map((step, index) => (
            <StepRow
              key={index}
              step={step}
              index={index}
              total={steps.length}
              onChange={handleStepChange}
              onRemove={handleStepRemove}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Serialize steps array to the JSON string stored in elaboration field */
export function serializeSteps(steps: ElaborationStep[]): string {
  return JSON.stringify({ steps });
}

/** Parse elaboration JSON string back to steps array. Handles structured format and legacy. */
export function parseSteps(elaboration: string | null | undefined): ElaborationStep[] {
  if (!elaboration) return [{ ...EMPTY_STEP }];

  try {
    const parsed = JSON.parse(elaboration) as unknown;
    // Structured format: { steps: [...] }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { steps?: unknown }).steps)) {
      return (parsed as { steps: Array<Record<string, unknown>> }).steps.map((s) => ({
        description: typeof s.description === 'string' ? s.description : '',
        equipment: typeof s.equipment === 'string' ? s.equipment : null,
        time: typeof s.time === 'string' ? s.time : null,
        temperature: typeof s.temperature === 'string' ? s.temperature : null,
      }));
    }
    // Legacy TipTap format: extract text content from paragraphs
    if (parsed && typeof parsed === 'object' && (parsed as { type?: string }).type === 'doc' && Array.isArray((parsed as { content?: unknown[] }).content)) {
      const texts: string[] = [];
      const extractText = (node: unknown) => {
        if (node && typeof node === 'object') {
          const n = node as { text?: unknown; content?: unknown[] };
          if (typeof n.text === 'string') texts.push(n.text);
          if (Array.isArray(n.content)) n.content.forEach(extractText);
        }
      };
      (parsed as { content: unknown[] }).content.forEach(extractText);
      if (texts.length > 0) {
        return texts.map((t) => ({ description: t, equipment: null, time: null, temperature: null }));
      }
    }
  } catch {
    // Plain text — split by lines
    if (typeof elaboration === 'string') {
      const lines = elaboration.split('\n').filter((l) => l.trim());
      if (lines.length > 0) {
        return lines.map((l) => ({ description: l, equipment: null, time: null, temperature: null }));
      }
    }
  }

  return [{ ...EMPTY_STEP }];
}
