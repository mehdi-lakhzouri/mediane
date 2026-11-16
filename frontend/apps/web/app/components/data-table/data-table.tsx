"use client";

import { Fragment, type ReactNode, useState } from "react";
import type {
  ColumnDef,
  ExpandedState,
  OnChangeFn,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUpIcon,
  LayoutGrid,
  Table2,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    view: "Choose data view",
    table: "Table view",
    cards: "Cards view",
    rowsPerPage: "Rows per page",
    page: (current: string, total: string) => `Page ${current} of ${total}`,
    first: "First page",
    previous: "Previous page",
    next: "Next page",
    last: "Last page",
    selected: (count: string, total: string) => `${count} of ${total} selected`,
    noRows: "No rows",
    noResults: "No results.",
    range: (first: string, last: string, total: string) =>
      `${first}–${last} of ${total}`,
  },
  fr: {
    view: "Choisir l’affichage",
    table: "Vue tableau",
    cards: "Vue cartes",
    rowsPerPage: "Lignes par page",
    page: (current: string, total: string) => `Page ${current} sur ${total}`,
    first: "Première page",
    previous: "Page précédente",
    next: "Page suivante",
    last: "Dernière page",
    selected: (count: string, total: string) =>
      `${count} sur ${total} sélectionné${Number(count) > 1 ? "s" : ""}`,
    noRows: "Aucune ligne",
    noResults: "Aucun résultat.",
    range: (first: string, last: string, total: string) =>
      `${first}–${last} sur ${total}`,
  },
});
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

const MotionTableRow = motion.create(TableRow);

const EASE = [0.22, 1, 0.36, 1] as const;

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
  /** Columns whose fields use the full width of a card. */
  cardFullWidthColumns?: readonly string[];
  /** Shown below the toolbar while at least one row is selected. */
  bulkBar?: ReactNode;
  emptyState?: ReactNode;
  activeRowId?: string | null;
  onRowClick?: (row: T) => void;
  /** Optional controlled expansion, used for detail rows. */
  expanded?: ExpandedState;
  onExpandedChange?: OnChangeFn<ExpandedState>;
  getRowCanExpand?: (row: T) => boolean;
  renderSubComponent?: (row: Row<T>) => ReactNode;
  /**
   * Entrance for data rows and cards, with `hidden` and `show` states. Each
   * item gets its index on the page as `custom`, so the stagger replays
   * whenever a new page of results arrives.
   */
  rowVariants?: Variants;
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
  cardFullWidthColumns = [],
  bulkBar,
  emptyState,
  activeRowId,
  onRowClick,
  expanded,
  onExpandedChange,
  getRowCanExpand,
  renderSubComponent,
  rowVariants,
}: DataTableProps<T>) {
  const t = useMessages(messages);
  const format = useFormatters();
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const table = useReactTable({
    data,
    columns,
    getRowId,
    manualPagination: true,
    manualSorting: true,
    rowCount,
    state: { pagination, sorting, rowSelection, expanded },
    onPaginationChange,
    onSortingChange,
    onRowSelectionChange,
    onExpandedChange,
    getRowCanExpand: (row) =>
      getRowCanExpand?.(row.original) ?? Boolean(renderSubComponent),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
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
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">{toolbar}</div>
          <div
            className="flex h-11 shrink-0 items-center rounded-[9px] border border-border bg-card p-1 shadow-[0_1px_2px_rgba(16,24,40,.03)]"
            role="group"
            aria-label={t.view}
          >
            <ViewButton
              label={t.table}
              icon={Table2}
              active={viewMode === "table"}
              onClick={() => setViewMode("table")}
            />
            <ViewButton
              label={t.cards}
              icon={LayoutGrid}
              active={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
            />
          </div>
        </div>
        <AnimatePresence initial={false}>
          {selectedCount > 0 && bulkBar ? (
            <motion.div
              key="bulk-bar"
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              {bulkBar}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* No `initial={false}` here: a presence child keeps that flag for its
          whole life, which would also block the entrance of every row or
          card that mounts later when data arrives. */}
      <AnimatePresence mode="wait">
        {viewMode === "table" ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.03)]"
          >
            <Table>
              <TableHeader className="bg-[#f8fafc]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
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
                  table.getRowModel().rows.map((row, rowIndex) => (
                    <Fragment key={row.id}>
                      <MotionTableRow
                        variants={rowVariants}
                        custom={rowIndex}
                        initial={rowVariants ? "hidden" : false}
                        animate={rowVariants ? "show" : undefined}
                        data-state={
                          row.getIsSelected() ? "selected" : undefined
                        }
                        data-current={
                          row.id === activeRowId ? "true" : undefined
                        }
                        data-expanded={row.getIsExpanded() ? "true" : undefined}
                        className="h-[72px] data-[current=true]:bg-[#eef4ff] data-[expanded=true]:bg-[#f8faff]"
                        tabIndex={onRowClick ? 0 : undefined}
                        onClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (
                            target.closest(
                              "button, a, input, [role=checkbox], [role=menuitem]",
                            )
                          )
                            return;
                          onRowClick?.(row.original);
                        }}
                        onKeyDown={(event) => {
                          const target = event.target as HTMLElement;
                          if (
                            target.closest(
                              "button, a, input, [role=checkbox], [role=menuitem]",
                            )
                          )
                            return;
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
                      </MotionTableRow>
                      {/* The detail row stays mounted while it collapses, so
                        the panel folds away instead of vanishing. */}
                      <AnimatePresence initial={false}>
                        {row.getIsExpanded() && renderSubComponent ? (
                          <TableRow
                            key="detail"
                            className="bg-[#f8faff] hover:bg-[#f8faff]"
                          >
                            <TableCell
                              colSpan={row.getVisibleCells().length}
                              className="p-0"
                            >
                              <ExpandPanel>
                                {renderSubComponent(row)}
                              </ExpandPanel>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </AnimatePresence>
                    </Fragment>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="h-52 p-0">
                      <EmptyReveal>
                        {emptyState ?? (
                          <p className="grid h-52 place-items-center text-[13px] text-muted-foreground">
                            {t.noResults}
                          </p>
                        )}
                      </EmptyReveal>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </motion.div>
        ) : (
          <motion.div
            key="cards"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <CardGrid
              cardFullWidthColumns={cardFullWidthColumns}
              rowVariants={rowVariants}
              table={table}
              columns={columns}
              loading={loading}
              emptyState={emptyState}
              activeRowId={activeRowId}
              onRowClick={onRowClick}
              renderSubComponent={renderSubComponent}
              pageSize={pagination.pageSize}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid min-h-[68px] items-center gap-4 rounded-[12px] border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,.02)] sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <span className="text-[12px] text-muted-foreground">
            {t.rowsPerPage}
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
              aria-label={t.rowsPerPage}
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

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-[12px] font-semibold text-foreground tabular-nums">
            {t.page(format.number(currentPage), format.number(pageCount))}
          </span>
          <div className="flex items-center gap-1">
            <PageButton
              label={t.first}
              icon={ChevronsLeft}
              disabled={currentPage === 1}
              onClick={() => table.setPageIndex(0)}
            />
            <PageButton
              label={t.previous}
              icon={ChevronLeft}
              disabled={currentPage === 1}
              onClick={() => table.previousPage()}
            />
            <PageButton
              label={t.next}
              icon={ChevronRight}
              disabled={currentPage >= pageCount}
              onClick={() => table.nextPage()}
            />
            <PageButton
              label={t.last}
              icon={ChevronsRight}
              disabled={currentPage >= pageCount}
              onClick={() => table.setPageIndex(pageCount - 1)}
            />
          </div>
        </div>

        <p className="text-center text-[12px] text-muted-foreground sm:text-right">
          {selectedCount > 0
            ? t.selected(format.number(selectedCount), format.number(rowCount))
            : rowCount === 0
              ? t.noRows
              : t.range(
                  format.number(firstRow),
                  format.number(lastRow),
                  format.number(rowCount),
                )}
        </p>
      </div>
    </div>
  );
}

function CardGrid<T>({
  cardFullWidthColumns,
  table,
  columns,
  loading,
  emptyState,
  activeRowId,
  onRowClick,
  renderSubComponent,
  pageSize,
  rowVariants,
}: {
  cardFullWidthColumns: readonly string[];
  table: ReturnType<typeof useReactTable<T>>;
  columns: ColumnDef<T>[];
  loading: boolean;
  emptyState?: ReactNode;
  activeRowId?: string | null;
  onRowClick?: (row: T) => void;
  renderSubComponent?: (row: Row<T>) => ReactNode;
  pageSize: number;
  rowVariants?: Variants;
}) {
  const t = useMessages(messages);
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: Math.min(pageSize, 5) }).map((_, index) => (
          <div
            key={`card-skeleton-${index}`}
            className="min-h-[230px] rounded-[16px] border border-border bg-card p-5 shadow-[0_2px_10px_rgba(16,24,40,.04)]"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((__, fieldIndex) => (
                <div key={fieldIndex} className="space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const rows = table.getRowModel().rows;
  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,.02)]">
        <EmptyReveal>
          {emptyState ?? (
            <p className="grid h-52 place-items-center text-[13px] text-muted-foreground">
              {t.noResults}
            </p>
          )}
        </EmptyReveal>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, rowIndex) => {
        const cells = row.getVisibleCells();
        const utilityCells = cells.filter((cell) =>
          ["select", "expand", "actions"].includes(cell.column.id),
        );
        const contentCells = cells.filter(
          (cell) => !["select", "expand", "actions"].includes(cell.column.id),
        );
        const primaryCell = contentCells[0];
        const detailCells = contentCells.slice(1);

        // The entrance lives on a wrapper so its inline transform never
        // overrides the card's own CSS hover lift.
        return (
          <motion.div
            key={row.id}
            variants={rowVariants}
            custom={rowIndex}
            initial={rowVariants ? "hidden" : false}
            animate={rowVariants ? "show" : undefined}
            className={cn(row.getIsExpanded() && "md:col-span-2 xl:col-span-3")}
          >
            <article
              data-state={row.getIsSelected() ? "selected" : undefined}
              data-current={row.id === activeRowId ? "true" : undefined}
              className="group overflow-hidden rounded-[16px] border border-border bg-card shadow-[0_2px_10px_rgba(16,24,40,.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_28px_rgba(32,53,135,.10)] data-[current=true]:border-primary/40 data-[current=true]:ring-2 data-[current=true]:ring-primary/10 data-[state=selected]:border-primary/40 data-[state=selected]:bg-[#f8faff]"
            >
              <div
                className="min-h-[230px] p-5"
                tabIndex={onRowClick ? 0 : undefined}
                onClick={(event) => {
                  if (isInteractiveTarget(event.target)) return;
                  onRowClick?.(row.original);
                }}
                onKeyDown={(event) => {
                  if (isInteractiveTarget(event.target)) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRowClick?.(row.original);
                  }
                }}
              >
                <div className="flex min-w-0 items-start gap-3 border-b border-border/70 pb-4">
                  <div className="min-w-0 flex-1">
                    {primaryCell
                      ? flexRender(
                          primaryCell.column.columnDef.cell,
                          primaryCell.getContext(),
                        )
                      : null}
                  </div>
                  {utilityCells.length > 0 ? (
                    <div className="flex shrink-0 items-center gap-1">
                      {utilityCells.map((cell) => (
                        <Fragment key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </Fragment>
                      ))}
                    </div>
                  ) : null}
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
                  {detailCells.map((cell) => (
                    <div
                      key={cell.id}
                      className={cn(
                        "min-w-0",
                        cardFullWidthColumns.includes(cell.column.id) &&
                          "col-span-2",
                      )}
                    >
                      <dt className="mb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                        {cardFieldLabel(
                          cell.column.id,
                          cell.column.columnDef.header,
                        )}
                      </dt>
                      <dd className="min-w-0 text-[12px]">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <AnimatePresence initial={false}>
                {row.getIsExpanded() && renderSubComponent ? (
                  <ExpandPanel key="detail">
                    <div className="border-t border-border bg-[#f8faff]">
                      {renderSubComponent(row)}
                    </div>
                  </ExpandPanel>
                ) : null}
              </AnimatePresence>
            </article>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Folds a detail panel open from zero height, and closed again on exit. */
function ExpandPanel({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

function EmptyReveal({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function cardFieldLabel<T>(id: string, header: ColumnDef<T>["header"]): string {
  if (typeof header === "string") return header;
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "button, a, input, select, [role=checkbox], [role=menuitem]",
      ),
    )
  );
}

function ViewButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Table2;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-[7px] px-3 text-[12px] text-muted-foreground",
        active &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
      )}
    >
      <Icon />
      {label.replace(" view", "")}
    </Button>
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
