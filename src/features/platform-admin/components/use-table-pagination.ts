"use client";

import { useState } from "react";

const PAGE_SIZES = [10, 25, 50] as const;

/**
 * Pages a list that is already in memory, for the console tables that load every
 * row and filter in the browser. Call `resetPage` when a filter changes.
 *
 * The page is clamped rather than trusted: blocking a tenant under a status
 * filter can take the last row off the last page.
 */
export function useTablePagination<T>(rows: T[]) {
  const [requestedPage, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;

  return {
    pageRows: rows.slice(start, start + pageSize),
    resetPage: () => setPage(1),
    footer: {
      page,
      pageCount,
      pageSize,
      pageSizes: PAGE_SIZES,
      total: rows.length,
      onPageChange: setPage,
      onPageSizeChange: (size: number) => {
        setPageSize(size);
        setPage(1);
      },
    },
  };
}
