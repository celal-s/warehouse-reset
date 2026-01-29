import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { Spinner } from '../ui'
import DataTableColumnHeader from './DataTableColumnHeader'
import DataTablePagination from './DataTablePagination'
import DataTableEmpty from './DataTableEmpty'

/**
 * DataTable - Main data table component
 * @param {Object} props
 * @param {Array} props.columns - Column definitions for @tanstack/react-table
 * @param {Array} props.data - Array of data to display
 * @param {boolean} props.loading - Whether data is loading
 * @param {string|Object} props.error - Error message or object to display
 * @param {number} props.totalCount - Total number of items (for server-side pagination)
 * @param {number} props.page - Current page (1-indexed)
 * @param {number} props.pageSize - Items per page
 * @param {Function} props.onPageChange - Callback when page changes
 * @param {Function} props.onPageSizeChange - Callback when page size changes
 * @param {number[]} props.pageSizeOptions - Available page size options
 * @param {Array} props.sorting - Current sorting state
 * @param {Function} props.onSortingChange - Callback when sorting changes
 * @param {Object} props.columnVisibility - Column visibility state
 * @param {Function} props.onColumnVisibilityChange - Callback when column visibility changes
 * @param {React.ReactNode} props.toolbar - Toolbar component to render above the table
 * @param {string} props.emptyMessage - Message to show when no data
 * @param {Object} props.emptyState - Custom empty state config { icon, title, description, action }
 * @param {Function} props.onRowClick - Callback when a row is clicked
 * @param {Function} props.getRowId - Function to get unique row ID
 * @param {Function} props.getRowClassName - Function to get custom class name for a row (receives row data)
 * @param {string} props.className - Additional CSS classes
 */
export default function DataTable({
  columns,
  data = [],
  loading = false,
  error = null,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  sorting = [],
  onSortingChange,
  columnVisibility = {},
  onColumnVisibilityChange,
  toolbar,
  emptyMessage = 'No data available',
  emptyState,
  onRowClick,
  getRowId,
  getRowClassName,
  className = '',
}) {
  // Memoize column definitions to add DataTableColumnHeader
  const tableColumns = useMemo(() => {
    return columns.map((column) => {
      // If column already has a custom header, use it
      if (typeof column.header === 'function') {
        return column
      }

      // Wrap string headers with DataTableColumnHeader for sortable columns
      const headerTitle = column.header || column.id
      return {
        ...column,
        header: ({ column: col }) => (
          <DataTableColumnHeader
            column={col}
            title={headerTitle}
            sortable={column.enableSorting !== false}
          />
        ),
      }
    })
  }, [columns])

  // Create table instance
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange,
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: onSortingChange ? undefined : getSortedRowModel(), // Only use client-side sorting if no external handler
    manualSorting: !!onSortingChange, // Enable manual sorting for server-side
    manualPagination: true, // Always manual pagination (handled by props)
    getRowId,
  })

  // Get actual total count (for client-side pagination, use data length)
  const actualTotalCount = totalCount ?? data.length

  // Error state
  if (error) {
    const errorMessage = typeof error === 'object' ? error.message : error
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        {toolbar}
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Error loading data</h3>
          <p className="text-sm text-gray-500">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Toolbar slot */}
      {toolbar && <div className="p-4 border-b">{toolbar}</div>}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : data.length === 0 ? (
        // Empty state
        <DataTableEmpty
          icon={emptyState?.icon}
          title={emptyState?.title || emptyMessage}
          description={emptyState?.description}
          action={emptyState?.action}
        />
      ) : (
        <>
          {/* Table with horizontal scroll */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        style={{
                          width: header.getSize() !== 150 ? header.getSize() : undefined,
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.map((row) => {
                  const rowClassName = getRowClassName ? getRowClassName(row.original) : ''
                  return (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName}`}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {onPageChange && (
            <div className="px-6 py-4 border-t">
              <DataTablePagination
                page={page}
                pageSize={pageSize}
                totalCount={actualTotalCount}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                pageSizeOptions={pageSizeOptions}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
