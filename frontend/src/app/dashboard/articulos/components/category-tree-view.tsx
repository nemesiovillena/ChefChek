import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CategoryTreeNode, Category } from '@/hooks/use-categories';

interface Props {
  tree: CategoryTreeNode[];
  onEdit: (category: Category) => void;
  onDelete: (id: string, name: string) => void;
}

export function CategoryTreeView({ tree, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-1">
      {tree.map(node => (
        <CategoryTreeNodeComponent
          key={node.id}
          node={node}
          level={0}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function CategoryTreeNodeComponent({
  node,
  level,
  onEdit,
  onDelete
}: {
  node: CategoryTreeNode;
  level: number;
  onEdit: (category: Category) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = level * 16;

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer group"
        style={{ paddingLeft: `${paddingLeft + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 hover:text-gray-600">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-indigo-500" />
        ) : (
          <Folder className="h-4 w-4 text-indigo-500" />
        )}

        {node.icon && (
          <span className="text-lg" role="img" aria-label={node.name}>
            {node.icon}
          </span>
        )}

        {node.color && (
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: node.color }} />
        )}

        <span className="flex-1 font-medium text-sm">{node.name}</span>

        {!node.isActive && (
          <span className="text-xs text-gray-400">Inactivo</span>
        )}

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => onEdit(node as Category)}
          >
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-red-600"
            onClick={() => onDelete(node.id, node.name)}
          >
            Eliminar
          </Button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <CategoryTreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}