import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Table, Thead, Tr, Th, Tbody, Td, ThProps } from '@patternfly/react-table';
import {
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  Pagination,
  EmptyState,
  EmptyStateBody,
  Bullseye,
  Spinner,
  Alert,
  Button,
} from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';

interface ResourceTableProps<T> {
  data: T[] | undefined;
  columns: ColumnDef<T, any>[];
  isLoading?: boolean;
  error?: Error | null;
  searchPlaceholder?: string;
  emptyMessage?: string;
  getRowId?: (row: T) => string;
  /** When provided, enables a CSV-export button with this base filename (no extension). */
  exportFilename?: string;
}

/** Convert a cell value to a CSV-safe string. */
function toCSVCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  // Wrap in quotes if the value contains comma, newline, or double-quote
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return '"' + s.split('"').join('""') + '"';
  }
  return s;
}

export function ResourceTable<T>({
  data,
  columns,
  isLoading,
  error,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No resources found.',
  getRowId,
  exportFilename,
}: ResourceTableProps<T>) {
  // GlobalSearch (Cmd+K) deep-links to a resource via ?search=<name>; seed the table filter from it.
  const [searchParams] = useSearchParams();
  const searchParam = searchParams.get('search');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState(searchParam ?? '');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync the filter when ?search= changes while the table stays mounted (e.g. picking another
  // resource in GlobalSearch without leaving the page). Adjusting state during render — React's
  // recommended alternative to an effect — so there's no extra commit or flash of stale rows.
  const [prevSearchParam, setPrevSearchParam] = useState(searchParam);
  if (searchParam !== prevSearchParam) {
    setPrevSearchParam(searchParam);
    if (searchParam != null) {
      setGlobalFilter(searchParam);
      setPage(1);
    }
  }

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting, globalFilter, pagination: { pageIndex: page - 1, pageSize: perPage } },
    onSortingChange: setSorting,
    onGlobalFilterChange: (value) => {
      setGlobalFilter(value);
      setPage(1);
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex: page - 1, pageSize: perPage })
        : updater;
      setPage(next.pageIndex + 1);
      setPerPage(next.pageSize);
    },
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalRows = table.getFilteredRowModel().rows.length;

  // Press `/` anywhere on the page to jump to the search box (Cmd/Ctrl+K is used
  // by GlobalSearch, so we use `/` here for the table-level filter, like GitHub).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? '';
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '/' && !isEditable && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // CSV export — exports all rows that pass the current filter (not just the
  // visible page), using raw getValue() so the output is machine-readable.
  const exportCSV = useCallback(() => {
    const headers = table
      .getHeaderGroups()[0]
      .headers.map((h) => toCSVCell(String(h.column.columnDef.header ?? h.id)));

    const filteredRows = table.getFilteredRowModel().rows;
    const bodyRows = filteredRows.map((row) =>
      row.getVisibleCells().map((cell) => toCSVCell(cell.getValue())),
    );

    const csvLines = [headers, ...bodyRows].map((r) => r.join(','));
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [table, exportFilename]);

  if (error) {
    return <Alert variant="danger" title="Failed to load resources">{error.message}</Alert>;
  }

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              ref={searchRef}
              placeholder={`${searchPlaceholder}  (/)`}
              value={globalFilter}
              onChange={(_e, value) => table.setGlobalFilter(value)}
              onClear={() => table.setGlobalFilter('')}
              aria-label={searchPlaceholder}
            />
          </ToolbarItem>
          {exportFilename && (
            <ToolbarItem>
              <Button
                variant="secondary"
                icon={<DownloadIcon />}
                onClick={exportCSV}
                isDisabled={totalRows === 0}
                aria-label="Export to CSV"
                size="sm"
              >
                Export CSV
              </Button>
            </ToolbarItem>
          )}
          <ToolbarItem variant="pagination" align={{ default: 'alignEnd' }}>
            <Pagination
              itemCount={totalRows}
              page={page}
              perPage={perPage}
              onSetPage={(_e, p) => setPage(p)}
              onPerPageSelect={(_e, pp) => {
                setPerPage(pp);
                setPage(1);
              }}
              isCompact
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {isLoading ? (
        <Bullseye>
          <Spinner size="lg" aria-label="Loading resources" />
        </Bullseye>
      ) : totalRows === 0 ? (
        <EmptyState>
          <EmptyStateBody>{emptyMessage}</EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="Resource table" variant="compact">
          <Thead>
            <Tr>
              {table.getHeaderGroups()[0].headers.map((header, columnIndex) => {
                const sortedIndex = table
                  .getHeaderGroups()[0]
                  .headers.findIndex((h) => h.column.id === sorting[0]?.id);
                const sortParams: ThProps['sort'] | undefined = header.column.getCanSort()
                  ? {
                      sortBy: {
                        index: sortedIndex,
                        direction: sorting[0]?.desc ? 'desc' : 'asc',
                      },
                      onSort: () => header.column.toggleSorting(header.column.getIsSorted() === 'asc'),
                      columnIndex,
                    }
                  : undefined;
                return (
                  <Th key={header.id} sort={sortParams}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                );
              })}
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <Td key={cell.id} dataLabel={String(cell.column.columnDef.header)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
