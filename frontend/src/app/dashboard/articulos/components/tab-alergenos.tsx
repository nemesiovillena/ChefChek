'use client';

import { useRef } from 'react';

const ALLERGENS = [
  { id: 1, name: 'Cereales con Gluten', image: '/images/allergens/gluten-derivados-300x300.webp' },
  { id: 2, name: 'Crustáceos', image: '/images/allergens/crustaceos-300x300.webp' },
  { id: 3, name: 'Huevos', image: '/images/allergens/huevos-300x300.webp' },
  { id: 4, name: 'Pescados', image: '/images/allergens/pescados-300x300.webp' },
  { id: 5, name: 'Cacahuetes', image: '/images/allergens/cacahuetes-300x300.webp' },
  { id: 6, name: 'Soja', image: '/images/allergens/soja-300x300.webp' },
  { id: 7, name: 'Lácteos', image: '/images/allergens/lacteos-300x300.webp' },
  { id: 8, name: 'Apio', image: '/images/allergens/apio-300x300.webp' },
  { id: 9, name: 'Mostaza', image: '/images/allergens/mostaza-300x300.webp' },
  { id: 10, name: 'Granos de Sésamo', image: '/images/allergens/granos-sesamo-300x300.webp' },
  { id: 11, name: 'Dióxido de Azufre / Sulfitos', image: '/images/allergens/dioxido-azufre-sulfitos-300x300.webp' },
  { id: 12, name: 'Altramuces', image: '/images/allergens/altramuces-300x300.webp' },
  { id: 13, name: 'Moluscos', image: '/images/allergens/moluscos-300x300.webp' },
  { id: 14, name: 'Cáscaras de Frutos Secos', image: '/images/allergens/cascaras-frutos-secos-300x300.webp' },
];

interface TabAlergenosProps {
  allergens: number[];
  setAllergens: (allergens: number[]) => void;
  hideAllergens: boolean;
  setHideAllergens: (value: boolean) => void;
  imageUrl: string;
  onImageUpload: (file: File) => void;
}

export default function TabAlergenos({ allergens, setAllergens, hideAllergens, setHideAllergens, imageUrl, onImageUpload }: TabAlergenosProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleAllergen = (id: number) => {
    if (allergens.includes(id)) {
      setAllergens(allergens.filter((a) => a !== id));
    } else {
      setAllergens([...allergens, id]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('El archivo no puede superar los 2 MB');
      return;
    }
    onImageUpload(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Seleccionar Alérgenos</label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {ALLERGENS.map((allergen) => {
            const isSelected = allergens.includes(allergen.id);
            return (
              <button
                key={allergen.id}
                type="button"
                onClick={() => toggleAllergen(allergen.id)}
                className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                  isSelected ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                }`}
                title={allergen.name}
              >
                <img src={allergen.image} alt={allergen.name} className="w-10 h-10 object-contain" />
                <span className={`text-xs mt-1 text-center leading-tight ${isSelected ? 'font-bold text-indigo-700' : 'text-gray-600'}`}>
                  {allergen.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          id="hideAllergens"
          checked={hideAllergens}
          onChange={(e) => setHideAllergens(e.target.checked)}
          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <label htmlFor="hideAllergens" className="text-sm text-gray-700">
          Ocultar en etiquetado
        </label>
        <span className="text-xs text-gray-400 ml-2">Los alérgenos no se mostrarán en el etiquetado</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Imagen de ficha técnica o etiqueta</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            Subir imagen
          </button>
          <span className="text-xs text-gray-400">Máximo 2 MB (JPEG, PNG, WebP, GIF)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        {imageUrl && (
          <div className="mt-3">
            <img src={imageUrl} alt="Ficha técnica" className="w-32 h-32 object-cover rounded-lg border" />
          </div>
        )}
      </div>
    </div>
  );
}
