'use client';

interface NutritionalData {
  energyKj: string;
  energyKcal: string;
  fat: string;
  saturatedFat: string;
  transFat: string;
  monounsaturatedFat: string;
  polyunsaturatedFat: string;
  omega3: string;
  cholesterol: string;
  carbohydrates: string;
  sugars: string;
  protein: string;
  salt: string;
}

interface TabNutricionProps {
  nutritionalData: NutritionalData;
  setNutritionalData: (data: NutritionalData) => void;
}

const FIELDS: { key: keyof NutritionalData; label: string }[] = [
  { key: 'energyKj', label: 'Valor energético kj' },
  { key: 'energyKcal', label: 'Valor energético Kcal' },
  { key: 'fat', label: 'Grasas g' },
  { key: 'saturatedFat', label: 'De las cuales saturadas g' },
  { key: 'transFat', label: 'Grasas trans g' },
  { key: 'monounsaturatedFat', label: 'Grasas monoinsaturadas g' },
  { key: 'polyunsaturatedFat', label: 'Grasas poliinsaturadas g' },
  { key: 'omega3', label: 'Grasas Omega3 g' },
  { key: 'cholesterol', label: 'Colesterol g' },
  { key: 'carbohydrates', label: 'Hidratos de carbono g' },
  { key: 'sugars', label: 'De los cuales azúcares g' },
  { key: 'protein', label: 'Proteínas g' },
  { key: 'salt', label: 'Sal g' },
];

export default function TabNutricion({ nutritionalData, setNutritionalData }: TabNutricionProps) {
  const update = (key: keyof NutritionalData, value: string) => {
    setNutritionalData({ ...nutritionalData, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-3 rounded-lg">
        <p className="text-sm font-medium text-gray-700">Valores para 100 gr.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={nutritionalData[key]}
              onChange={(e) => update(key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
