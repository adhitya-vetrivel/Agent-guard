import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Download, ChevronLeft, ChevronRight, CheckSquare, Square, DownloadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { EmptyState } from './EmptyState'
import { LoadingState } from './LoadingState'
import { Button } from './button'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  width?: string
  render: (item: T) => React.ReactNode
  exportValue?: (item: T) => string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[] | undefined
  isLoading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  onSearch?: (term: string) => void
  searchTerm?: string
  emptyIcon?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  onRowClick?: (item: T) => void
  onRowSelect?: (items: T[]) => void
  selectedItems?: T[]
  selectable?: boolean
  defaultSort?: string
  defaultSortDir?: 'asc' | 'desc'
  loadingMessage?: string
  pageSize?: number
  serverPagination?: boolean
  totalItems?: number
  onPageChange?: (page: number) => void
  currentPage?: number
  exportable?: boolean
  exportFilename?: string
  bulkActions?: React.ReactNode
}

export function DataTable<T extends Record<string, any>>({
  columns, data, isLoading, searchable, searchPlaceholder,
  onSearch, searchTerm, emptyIcon, emptyTitle, emptyDescription,
  emptyAction, onRowClick, onRowSelect, selectedItems, selectable,
  defaultSort, defaultSortDir = 'asc', loadingMessage,
  pageSize = 30, serverPagination, totalItems, onPageChange, currentPage = 0,
  exportable, exportFilename = 'export', bulkActions,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string>(defaultSort || '')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)
  const [localSearch, setLocalSearch] = useState('')
  const [localPage, setLocalPage] = useState(0)
  const [rowSelection, setRowSelection] = useState<Set<string>>(new Set())

  const page = serverPagination ? (currentPage ?? localPage) : localPage
  const setPage = serverPagination ? (onPageChange || setLocalPage) : setLocalPage

  const effectiveSearch = searchTerm !== undefined ? searchTerm : localSearch

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    if (!data || serverPagination) return data || []
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp = 0
      if (typeof av === 'string') cmp = (av || '').localeCompare(bv || '')
      else if (typeof av === 'number') cmp = (av || 0) - (bv || 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir, serverPagination])

  const paged = serverPagination ? sorted : sorted.slice(page * pageSize, (page + 1) * pageSize)
  const total = totalItems ?? sorted.length
  const totalPages = Math.ceil(total / pageSize)

  const allSelected = data && data.length > 0 && rowSelection.size === data.length
  const someSelected = data && rowSelection.size > 0 && rowSelection.size < data.length

  const toggleSelect = (id: string) => {
    const next = new Set(rowSelection)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setRowSelection(next)
    onRowSelect?.(data?.filter(d => next.has(d.id)) || [])
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setRowSelection(new Set())
      onRowSelect?.([])
    } else {
      const ids = new Set(data?.map(d => d.id) || [])
      setRowSelection(ids)
      onRowSelect?.(data || [])
    }
  }

  const exportCSV = () => {
    if (!data) return
    const header = columns.map(c => c.label).join(',')
    const rows = data.map(item =>
      columns.map(c => {
        const val = c.exportValue ? c.exportValue(item) : String(item[c.key] ?? '')
        return `"${val.replace(/"/g, '""')}"`
      }).join(',')
    ).join('\n')
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${exportFilename}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const exportJSON = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${exportFilename}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <LoadingState message={loadingMessage} />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          {searchable && (
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={effectiveSearch} onChange={(e) => { setLocalSearch(e.target.value); onSearch?.(e.target.value); setPage(0) }}
                placeholder={searchPlaceholder || 'Search...'} className="pl-8 h-8 text-sm" />
            </div>
          )}
          {bulkActions && rowSelection.size > 0 && (
            <div className="flex items-center gap-2">{bulkActions}</div>
          )}
        </div>
        {exportable && data && data.length > 0 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={exportCSV} className="gap-1 text-xs text-muted-foreground"><Download className="h-3 w-3" /> CSV</Button>
            <Button variant="ghost" size="sm" onClick={exportJSON} className="gap-1 text-xs text-muted-foreground"><DownloadCloud className="h-3 w-3" /> JSON</Button>
          </div>
        )}
      </div>

      {(!data || data.length === 0) ? (
        <EmptyState icon={emptyIcon || <div />} title={emptyTitle || 'No data'} description={emptyDescription} action={emptyAction} />
      ) : (
        <>
          <div className="rounded-md border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {selectable && (
                      <th className="px-3 py-2.5 w-8" onClick={toggleSelectAll}>
                        {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className={cn('h-3.5 w-3.5', someSelected ? 'text-primary' : 'text-muted-foreground')} />}
                      </th>
                    )}
                    {columns.map((col) => (
                      <th key={col.key} onClick={() => col.sortable !== false && toggleSort(col.key)}
                        className={cn('px-3 py-2.5 text-left text-xs font-medium text-muted-foreground', col.sortable !== false && 'cursor-pointer select-none hover:text-foreground transition-colors')}
                        style={col.width ? { width: col.width } : undefined}>
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.sortable !== false && sortKey === col.key ? (
                            sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : col.sortable !== false ? <ArrowUpDown className="h-3 w-3 opacity-20" /> : null}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item, i) => {
                    const selected = rowSelection.has(item.id)
                    return (
                      <tr key={item.id || i} onClick={() => { if (!selectable) onRowClick?.(item) }}
                        className={cn('border-b border-border/50 transition-colors', onRowClick && !selectable && 'cursor-pointer hover:bg-muted/20', selected && 'bg-primary/[0.02]')}>
                        {selectable && (
                          <td className="px-3 py-2.5 w-8" onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}>
                            {selected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                          </td>
                        )}
                        {columns.map((col) => (
                          <td key={col.key} className="px-3 py-2.5 text-sm">{col.render(item)}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{total} total items</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2">{page + 1} / {totalPages}</span>
                <Button variant="ghost" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
