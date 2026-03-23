// components/finance/Pager.js
// Adapted from bt-finance Pager — rewritten with Tailwind + shadcn/ui style
// to match BT Ops look.  Drop-in replacement; same props interface.

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Props
 *   total      – total number of records
 *   page       – current page (1-indexed)
 *   pageSize   – rows per page
 *   onPage     – (newPage) => void
 *   onPageSize – (newSize) => void   (optional)
 *   sizes      – [10, 25, 50]        (optional)
 */
export default function Pager({
  total = 0,
  page = 1,
  pageSize = 10,
  onPage,
  onPageSize,
  sizes = [10, 25, 50],
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-slate-600">
      <span>
        {total === 0 ? 'No records' : `${from}–${to} of ${total}`}
      </span>

      <div className="flex items-center gap-2">
        {onPageSize && (
          <Select
            value={String(pageSize)}
            onValueChange={(v) => { onPageSize(Number(v)); onPage(1); }}
          >
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizes.map(s => (
                <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant="outline" size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={14} />
        </Button>

        <span className="text-xs font-medium">
          {page} / {totalPages}
        </span>

        <Button
          variant="outline" size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}