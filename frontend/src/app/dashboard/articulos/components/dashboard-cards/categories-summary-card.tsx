import { FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  categoryCount: number;
  onManageCategories: () => void;
}

export function CategoriesSummaryCard({ categoryCount, onManageCategories }: Props) {
  return (
    <div
      className="bg-white border rounded-lg p-6 hover:shadow-md transition cursor-pointer"
      onClick={onManageCategories}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <FolderTree className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Categorías</p>
            <p className="text-3xl font-bold text-gray-900">{categoryCount}</p>
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2">
        <FolderTree className="h-4 w-4" />
        Gestionar categorías
      </Button>
    </div>
  );
}