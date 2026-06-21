import { useState } from 'react';
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
} from '@patternfly/react-core';

interface ResourceTableProps<T> {
  data: T[] | undefined;
  columns: ColumnDef<T, any>[];
  isLoading?: boolean;
  error?: Error | null;
  searchPlaceholder?: string;
  emptyMessage?: string;
  getRowId?: (row: T) => string;
}

export function ResourceTable<T>({
  data,
  columns,
  isLoading,
  error,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No resources found.',
  getRowId,
}: ResourceTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

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

  if (error) {
    return <Alert variant="danger" title="Failed to load resources">{error.message}</Alert>;
  }

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(_e, value) => table.setGlobalFilter(value)}
              onClear={() => table.setGlobalFilter('')}
            />
          </ToolbarItem>
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
