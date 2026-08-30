"use client"

import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { EmptyState } from "./empty-state"
import ClickLoadingState from "../click/ClickLoadingState"

/**
 * DataTable — one sortable, selectable table for every list page.
 *
 * List pages each hand-rolled their own table markup, sort handling, selection
 * state, empty text and spinner, which is why those states look different on
 * every screen. This owns all four: loading, empty, error and data.
 *
 * Deliberately NOT a virtualized/data-grid library — the pages here show tens
 * of rows, not thousands, and a dependency would cost more than it returns.
 */

export interface Column<T> {
  /** Stable key; also the sort key unless `sortKey` is given. */
  id: string
  header: React.ReactNode
  /** Cell renderer. Keep it pure — it runs for every row on every render. */
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  /** Value used for sorting when the cell renders something non-comparable. */
  sortValue?: (row: T) => string | number
  /** Hide below `lg` — for secondary columns on narrow screens. */
  hideOnMobile?: boolean
  align?: "left" | "right" | "center"
  width?: string
}

export type SortDirection = "asc" | "desc"

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  /** Stable identity per row — required for selection and React keys. */
  getRowId: (row: T) => string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Shown when there are no rows and we're not loading. */
  empty?: React.ReactNode
  emptyTitle?: string
  emptyMessage?: string
  /** Selection is enabled by passing these two together. */
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  onRowClick?: (row: T) => void
  /** Uncontrolled initial sort. */
  defaultSort?: { columnId: string; direction: SortDirection }
  caption?: string
  className?: string
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  loading = false,
  error = null,
  onRetry,
  empty,
  emptyTitle,
  emptyMessage,
  selectedIds,
  onSelectionChange,
  onRowClick,
  defaultSort,
  caption,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ columnId: string; direction: SortDirection } | null>(
    defaultSort ?? null
  )

  const selectable = Boolean(selectedIds && onSelectionChange)
  const selected = React.useMemo(() => new Set(selectedIds ?? []), [selectedIds])

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.id === sort.columnId)
    if (!column) return rows

    const valueOf = (row: T): string | number => {
      if (column.sortValue) return column.sortValue(row)
      const raw = column.cell(row)
      return typeof raw === "string" || typeof raw === "number" ? raw : ""
    }

    // Copy before sorting — mutating the caller's array causes stale-render bugs.
    return [...rows].sort((a, b) => {
      const av = valueOf(a)
      const bv = valueOf(b)
      if (av === bv) return 0
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sort.direction === "asc" ? cmp : -cmp
    })
  }, [rows, columns, sort])

  const toggleSort = (columnId: string) => {
    setSort((current) =>
      current?.columnId === columnId
        ? { columnId, direction: current.direction === "asc" ? "desc" : "asc" }
        : { columnId, direction: "asc" }
    )
  }

  const allVisibleSelected = sortedRows.length > 0 && sortedRows.every((r) => selected.has(getRowId(r)))

  const toggleAll = () => {
    if (!onSelectionChange) return
    onSelectionChange(allVisibleSelected ? [] : sortedRows.map(getRowId))
  }

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange([...next])
  }

  if (loading) return <ClickLoadingState variant="block" />

  if (error) {
    return (
      <EmptyState
        title="That didn't load"
        description={error}
        action={
          onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg px-3 py-1.5 ds-text-label ds-surface-subtle transition-colors hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Try again
            </button>
          ) : undefined
        }
      />
    )
  }

  if (sortedRows.length === 0) {
    return (
      <>
        {empty ?? <EmptyState title={emptyTitle ?? "Nothing here yet"} description={emptyMessage} />}
      </>
    )
  }

  const alignClass = (align?: Column<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

  return (
    // Wide tables scroll inside their own container so the page body never
    // scrolls horizontally.
    <div className={cn("w-full overflow-x-auto rounded-xl ds-surface-card", className)}>
      <table className="w-full border-collapse text-left">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-[var(--glass-border)]">
            {selectable ? (
              <th scope="col" className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  aria-label={allVisibleSelected ? "Deselect all rows" : "Select all rows"}
                  className="h-4 w-4 rounded border-[var(--glass-border-strong)] accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </th>
            ) : null}

            {columns.map((column) => {
              const isSorted = sort?.columnId === column.id
              return (
                <th
                  key={column.id}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={isSorted ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "px-3 py-2.5 ds-text-label text-theme-muted",
                    alignClass(column.align),
                    column.hideOnMobile && "hidden lg:table-cell"
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.id)}
                      className="inline-flex items-center gap-1 rounded transition-colors hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {column.header}
                      {isSorted ? (
                        sort!.direction === "asc" ? (
                          <ArrowUp size={12} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={12} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown size={12} aria-hidden="true" className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row) => {
            const id = getRowId(row)
            const isSelected = selected.has(id)
            return (
              <tr
                key={id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-[var(--glass-border)] last:border-0 transition-colors",
                  isSelected && "bg-[hsl(var(--primary)/0.06)]",
                  onRowClick && "cursor-pointer hover:bg-[hsl(var(--muted))]"
                )}
              >
                {selectable ? (
                  // Stop propagation so ticking a row doesn't also navigate.
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(id)}
                      aria-label={`Select row ${id}`}
                      className="h-4 w-4 rounded border-[var(--glass-border-strong)] accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </td>
                ) : null}

                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "px-3 py-2.5 ds-text-body text-theme-secondary",
                      alignClass(column.align),
                      column.hideOnMobile && "hidden lg:table-cell"
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

DataTable.displayName = "DataTable"
