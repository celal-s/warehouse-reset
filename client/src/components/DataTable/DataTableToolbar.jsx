import { useState, useEffect, useCallback, useRef } from 'react'
import { SearchInput, Select, Button } from '../ui'

/**
 * DataTableToolbar - Toolbar with search, filters, and column visibility
 * @param {Object} props
 * @param {string} props.search - Current search value
 * @param {Function} props.onSearchChange - Callback when search changes
 * @param {string} props.searchPlaceholder - Placeholder for search input
 * @param {Array} props.filters - Array of filter configs: { id, label, options, value, onChange }
 * @param {Array} props.columns - Table columns for visibility toggle
 * @param {Object} props.columnVisibility - Current column visibility state
 * @param {Function} props.onColumnVisibilityChange - Callback when column visibility changes
 * @param {React.ReactNode} props.actions - Additional action buttons to render
 * @param {string} props.className - Additional CSS classes
 */
export default function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  columns = [],
  columnVisibility = {},
  onColumnVisibilityChange,
  actions,
  className = '',
}) {
  const [localSearch, setLocalSearch] = useState(search || '')
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const columnMenuRef = useRef(null)
  const debounceRef = useRef(null)

  // Sync local search with prop
  useEffect(() => {
    setLocalSearch(search || '')
  }, [search])

  // Debounced search handler
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value
    setLocalSearch(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      onSearchChange?.(value)
    }, 300)
  }, [onSearchChange])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Handle click outside to close column menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target)) {
        setShowColumnMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get toggleable columns (filter out columns that can't be hidden)
  const toggleableColumns = columns.filter((col) => col.getCanHide())

  const handleColumnToggle = (columnId) => {
    const column = columns.find((c) => c.id === columnId)
    if (column) {
      column.toggleVisibility()
    }
  }

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 ${className}`}>
      {/* Search input */}
      {onSearchChange && (
        <div className="w-full sm:w-72">
          <SearchInput
            value={localSearch}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
          />
        </div>
      )}

      {/* Filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <div key={filter.id} className="min-w-[140px]">
              <Select
                value={filter.value || ''}
                onChange={(e) => filter.onChange(e.target.value)}
                options={filter.options}
                placeholder={filter.label}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Column visibility dropdown */}
        {toggleableColumns.length > 0 && onColumnVisibilityChange && (
          <div className="relative" ref={columnMenuRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              Columns
            </Button>

            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                    Toggle columns
                  </div>
                  {toggleableColumns.map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={() => handleColumnToggle(column.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {typeof column.columnDef.header === 'string'
                          ? column.columnDef.header
                          : column.id}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional actions */}
        {actions}
      </div>
    </div>
  )
}
