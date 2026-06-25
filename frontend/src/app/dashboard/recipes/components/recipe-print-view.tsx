'use client';

import { Recipe } from '@/hooks/use-recipes';

interface RecipePrintViewProps {
  recipe: Recipe;
}

/** Parse elaboration JSON to structured steps for display */
function parseElaborationSteps(elaboration: string | null | undefined) {
  if (!elaboration) return [];

  try {
    const parsed = JSON.parse(elaboration) as unknown;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { steps?: unknown }).steps)) {
      return (parsed as { steps: Array<Record<string, unknown>> }).steps;
    }
    // Legacy TipTap: extract text
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
      return texts.map((t) => ({ description: t }));
    }
  } catch {
    // Plain text fallback
    return elaboration.split('\n').filter((l) => l.trim()).map((t) => ({ description: t }));
  }
  return [];
}

export default function RecipePrintView({ recipe }: RecipePrintViewProps) {
  const steps = parseElaborationSteps(recipe.elaboration);

  return (
    <div className="print-view max-w-[210mm] mx-auto p-8 font-sans text-sm">
      {/* Recipe image */}
      {recipe.imageUrl && (
        <div className="mb-4 flex justify-center">
          <img src={recipe.imageUrl} alt={recipe.name} className="max-h-48 rounded-lg object-cover" />
        </div>
      )}

      {/* Header */}
      <h1 className="text-2xl font-bold text-center mb-1">{recipe.name}</h1>
      {recipe.description && (
        <p className="text-center text-gray-600 mb-2">{recipe.description}</p>
      )}
      <p className="text-center text-gray-500 mb-2">
        {recipe.portions} porciones{recipe.portionSize ? ` de ${recipe.portionSize}g` : ''}
      </p>
      {recipe.sourceUrl && (
        <p className="text-center text-xs text-gray-400 mb-4">
          Fuente: <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">{recipe.sourceUrl}</a>
        </p>
      )}

      <hr className="mb-6 border-gray-300" />

      {/* Elaboration Steps */}
      {steps.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">ELABORACIÓN</h2>
          <div className="space-y-2">
            {steps.map((step: Record<string, unknown>, index: number) => {
              // Build description with inline time/temperature
              let desc = typeof step.description === 'string' ? step.description : '';
              if (typeof step.temperature === 'string') desc += ` a ${step.temperature}`;
              if (typeof step.time === 'string') desc += ` ${step.time}`;

              return (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex gap-2 flex-1">
                    <span className="font-bold text-indigo-500 shrink-0">{index + 1}.</span>
                    <span>{desc}</span>
                  </div>
                  {typeof step.equipment === 'string' && step.equipment && (
                    <span className="ml-4 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium whitespace-nowrap shrink-0">
                      {step.equipment}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">INGREDIENTES</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {recipe.ingredients.map((ing, index) => (
              <div key={index} className="flex justify-between">
                <span>{ing.productName || ing.productId}</span>
                <span className="text-gray-600">
                  {ing.quantity} {ing.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {recipe.notes && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-2">NOTAS</h2>
          <p className="whitespace-pre-line text-gray-700">{recipe.notes}</p>
        </div>
      )}

      {/* Cost summary */}
      {recipe.totalCost > 0 && (
        <div className="border-t border-gray-300 pt-4 mt-4">
          <div className="flex justify-between text-sm">
            <span>Coste total:</span>
            <span className="font-bold">€{recipe.totalCost.toFixed(2)}</span>
          </div>
          {recipe.costBreakdown?.costPerPortion && (
            <div className="flex justify-between text-sm">
              <span>Coste por porción:</span>
              <span className="font-bold">€{recipe.costBreakdown.costPerPortion.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-view, .print-view * { visibility: visible; }
          .print-view { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
