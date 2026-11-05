"use client";

import type { ReactNode } from "react";

import { DataTable, TablePaginationFooter } from "./platform-ui";
import { useTablePagination } from "./use-table-pagination";

/**
 * A paged table of ready-made cells. Takes plain rows rather than column
 * functions, so a Server Component can render it.
 */
export function SimpleTable({
  headers,
  rows,
  empty,
  noun,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
  noun: { one: string; other: string };
}) {
  const { pageRows, footer } = useTablePagination(rows);

  return (
    <DataTable
      rows={pageRows}
      rowKey={(_, index) => String(index)}
      empty={empty}
      footer={<TablePaginationFooter {...footer} noun={noun} />}
      columns={headers.map((header, index) => ({
        key: header,
        header,
        primary: index === 0,
        wrap: index === 0,
        cell: (row: ReactNode[]) => row[index],
      }))}
    />
  );
}
