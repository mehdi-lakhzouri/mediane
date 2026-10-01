"use client";

import type { ReactNode } from "react";
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUpIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";

export const PAGE_SIZES = [5, 10, 25, 50, 100] as const;

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Total rows on the server, not just this page. */
  rowCount: number;
  getRowId: (row: T) => string;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  loading?: boolean;
  /** Filters and search, rendered above the table. */
  toolbar?: ReactNode;
  /** Shown below the toolbar while at least one row is selected. */
  bulkBar?: ReactNode;
  emptyState?: ReactNode;
  activeRowId?: string | null;
  onRowClick?: (row: T) => void;
}

/**
 * Paging and sorting are server-driven (`manual*`): the table never reorders or
 * slices rows itself, so what you sort is the whole result set rather than the
 * page you happen to be looking at.
 */
export function DataTable<T>({
  columns,
  data,
  rowCount,
  getRowId,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  loading = false,
  toolbar,
  bulkBar,
  emptyState,
  activeRowId,
  onRowClick,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getRowId,
    manualPagination: true,
    manualSorting: true,
    rowCount,
    state: { pagination, sorting, rowSelection },
    onPaginationChange,
    onSortingChange,
    onRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;
  const pageCount = Math.max(1, Math.ceil(rowCount / pagination.pageSize));
  const currentPage = pagination.pageIndex + 1;
  const firstRow =
    rowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow = Math.min(rowCount, currentPage * pagination.pageSize);

  return (
    <div className="flex flex-col gap-4">
      {/* The toolbar stays put while rows are selected: hiding search and
          filters behind the bulk bar would strand anyone mid-selection. */}
      <div className="flex flex-col gap-3">
        {toolbar}
        {selectedCount > 0 && bulkBar}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.03)]">
        <Table>
          <TableHeader className="bg-[#f8fafc]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const sortable = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      style={
                        header.column.columnDef.size
                          ? { width: header.column.columnDef.size }
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex h-full w-full cursor-pointer items-center gap-1.5 rounded-sm text-left select-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <span className="truncate">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                          </span>
                          {sorted === "asc" && (
                            <ChevronUpIcon className="size-3.5 shrink-0" />
                          )}
                          {sorted === "desc" && (
                            <ChevronDownIcon className="size-3.5 shrink-0" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(pagination.pageSize, 5) }).map(
                (_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`}>
                    {columns.map((_column, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full max-w-[160px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ),
              )
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  data-current={row.id === activeRowId ? "true" : undefined}
                  className="h-[72px] data-[current=true]:bg-[#eef4ff]"
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("button, a, input, [role=checkbox]"))
                      return;
                    onRowClick?.(row.original);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick?.(row.original);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-52 p-0">
                  {emptyState ?? (
                    <p className="grid h-52 place-items-center text-[13px] text-muted-foreground">
                      No results.
                    </p>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex min-h-[70px] flex-col-reverse items-center justify-between gap-4 border-t border-border px-5 py-3 sm:flex-row">
          <p className="text-[12px] text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} of ${rowCount} selected`
              : rowCount === 0
                ? "No rows"
                : `${firstRow}–${lastRow} of ${rowCount}`}
          </p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">
                Rows per page
              </span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) =>
                  onPaginationChange({
                    pageIndex: 0,
                    pageSize: Number(value),
                  })
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Rows per page"
                  className="w-[72px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-[12px] font-medium text-foreground tabular-nums">
              Page {currentPage} of {pageCount}
            </span>

            <div className="flex items-center gap-1">
              <PageButton
                label="First page"
                icon={ChevronsLeft}
                disabled={currentPage === 1}
                onClick={() => table.setPageIndex(0)}
              />
              <PageButton
                label="Previous page"
                icon={ChevronLeft}
                disabled={currentPage === 1}
                onClick={() => table.previousPage()}
              />
              <PageButton
                label="Next page"
                icon={ChevronRight}
                disabled={currentPage >= pageCount}
                onClick={() => table.nextPage()}
              />
              <PageButton
                label="Last page"
                icon={ChevronsRight}
                disabled={currentPage >= pageCount}
                onClick={() => table.setPageIndex(pageCount - 1)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof ChevronLeft;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("text-muted-foreground")}
    >
      <Icon />
    </Button>
  );
}
