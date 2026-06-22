import { Plus, FileUp, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  articleCount: number;
  onCreateArticle: () => void;
  onOpenAlbaranUpload: () => void;
}

export function ArticlesSummaryCard({ articleCount, onCreateArticle, onOpenAlbaranUpload }: Props) {
  return (
    <div className="bg-white border rounded-lg p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Package className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Artículos totales</p>
            <p className="text-3xl font-bold text-gray-900">{articleCount}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={onOpenAlbaranUpload}>
          <FileUp className="h-4 w-4" />
          Albarán
        </Button>
        <Button size="sm" className="flex-1 gap-2" onClick={onCreateArticle}>
          <Plus className="h-4 w-4" />
          Añadir
        </Button>
      </div>
    </div>
  );
}