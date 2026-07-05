import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Category, CategoryTreeNode } from '@/hooks/use-categories';

/** Shape of the data emitted by CategoryForm on submit. */
export interface CategoryFormData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

interface Props {
  category?: Category | null;
  tree: CategoryTreeNode[];
  onSubmit: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

// Emojis simples como iconos predefinidos
const ICONS = ['🍎', '🥬', '🥩', '🐟', '🥛', '🧀', '🥚', '🥖', '🍝', '🍕', '🥗', '🍲', '☕', '🍵', '🍬', '🧂'];

export function CategoryForm({ category, tree, onSubmit, onCancel, isSubmitting }: Props) {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<CategoryFormData>({
    defaultValues: category || {
      name: '',
      description: '',
      icon: '📁',
      color: '#6366f1',
      parentId: '',
      sortOrder: 0,
      isActive: true
    }
  });

  const selectedIcon = watch('icon');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <Input {...register('name', { required: 'Nombre requerido' })} placeholder="Verduras" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <Input {...register('description')} placeholder="Categoría para vegetales frescos" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Icono</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map(icon => (
              <button
                key={icon}
                type="button"
                onClick={() => setValue('icon', icon)}
                className={`w-10 h-10 text-2xl rounded-lg border-2 ${
                  selectedIcon === icon ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Color</label>
          <input
            type="color"
            {...register('color')}
            className="w-full h-10 rounded-lg border cursor-pointer"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Categoría padre</label>
        <select
          {...register('parentId')}
          className="w-full px-3 py-2 border rounded-md text-sm"
        >
          <option value="">Sin categoría padre</option>
          {tree.map(node => (
            <option key={node.id} value={node.id}>
              {node.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t">
        <input
          type="checkbox"
          {...register('isActive')}
          id="isActive"
          className="w-4 h-4 rounded border-gray-300"
        />
        <label htmlFor="isActive" className="text-sm cursor-pointer">Categoría activa</label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : category ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}