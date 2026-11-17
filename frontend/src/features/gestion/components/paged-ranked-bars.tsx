'use client';

import { useState } from 'react';
import PaginationControls from '@/components/shared/pagination-controls';
import { RankedBars, type RankedItem } from './ranked-bars';

/**
 * Ranking con paginador propio. Las barras se miden contra el máximo de toda la
 * lista, así la página 2 no aparenta que su primer elemento vende como el nº 1.
 * Para volver a la página 1 al cambiar de periodo, el padre le cambia la `key`.
 */
export function PagedRankedBars({
  items,
  emptyText,
  pageEmptyLabel,
}: {
  items: RankedItem[];
  emptyText: string;
  pageEmptyLabel: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  const max = Math.max(...items.map((i) => i.total), 0);

  return (
    <>
      <RankedBars
        items={items.slice((current - 1) * pageSize, current * pageSize)}
        emptyText={emptyText}
        max={max}
      />
      {items.length > 10 && (
        <div className="-mx-4 mt-3 -mb-4">
          <PaginationControls
            variant="attached"
            page={current}
            totalPages={totalPages}
            total={items.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            emptyLabel={pageEmptyLabel}
          />
        </div>
      )}
    </>
  );
}
