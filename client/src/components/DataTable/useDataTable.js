import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

const DEFAULT_PAGE_SIZES = [25, 50, 100]

/**
 * Custom hook for managing DataTable state with URL synchronization
 * @param {Object} options - Configuration options
 * @param {number} options.defaultPageSize - Initial page size (default: 25)
 * @param {string} options.defaultSortColumn - Initial sort column
 * @param {string} options.defaultSortDirection - Initial sort direction ('asc' or 'desc')
 * @param {Object} options.defaultFilters - Initial filter values
 * @param {Object} options.defaultColumnVisibility - Initial column visibility
 * @param {boolean} options.syncWithUrl - Whether to sync state with URL params (default: true)
 */
export function useDataTable({
  defaultPageSize = 25,
  defaultSortColumn = '',
  defaultSortDirection = 'asc',
  defaultFilters = {},
  defaultColumnVisibility = {},
  syncWithUrl = true,
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize state from URL params or defaults
  const getInitialState = useCallback(() => {
    if (!syncWithUrl) {
      return {
        search: '',
        page: 1,
        pageSize: defaultPageSize,
        sortColumn: defaultSortColumn,
        sortDirection: defaultSortDirection,
        filters: defaultFilters,
        columnVisibility: defaultColumnVisibility,
      }
    }

    const page = parseInt(searchParams.get('page')) || 1
    const pageSize = parseInt(searchParams.get('pageSize')) || defaultPageSize
    const search = searchParams.get('search') || ''
    const sortColumn = searchParams.get('sortColumn') || defaultSortColumn
    const sortDirection = searchParams.get('sortDirection') || defaultSortDirection

    // Parse filters from URL
    const filters = { ...defaultFilters }
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('filter_')) {
        const filterKey = key.replace('filter_', '')
        filters[filterKey] = value
      }
    }

    return {
      search,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      filters,
      columnVisibility: defaultColumnVisibility,
    }
  }, [searchParams, syncWithUrl, defaultPageSize, defaultSortColumn, defaultSortDirection, defaultFilters, defaultColumnVisibility])

  const initialState = getInitialState()

  const [search, setSearchState] = useState(initialState.search)
  const [page, setPageState] = useState(initialState.page)
  const [pageSize, setPageSizeState] = useState(initialState.pageSize)
  const [sortColumn, setSortColumnState] = useState(initialState.sortColumn)
  const [sortDirection, setSortDirectionState] = useState(initialState.sortDirection)
  const [filters, setFiltersState] = useState(initialState.filters)
  const [columnVisibility, setColumnVisibilityState] = useState(initialState.columnVisibility)

  // Sync state to URL params
  const updateUrlParams = useCallback((updates) => {
    if (!syncWithUrl) return

    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev)

      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'filters') {
          // Remove old filter params
          for (const paramKey of Array.from(newParams.keys())) {
            if (paramKey.startsWith('filter_')) {
              newParams.delete(paramKey)
            }
          }
          // Add new filter params
          Object.entries(value).forEach(([filterKey, filterValue]) => {
            if (filterValue) {
              newParams.set(`filter_${filterKey}`, filterValue)
            }
          })
        } else if (value === null || value === undefined || value === '') {
          newParams.delete(key)
        } else {
          newParams.set(key, value.toString())
        }
      })

      // Remove default values from URL to keep it clean
      if (newParams.get('page') === '1') newParams.delete('page')
      if (newParams.get('pageSize') === defaultPageSize.toString()) newParams.delete('pageSize')

      return newParams
    }, { replace: true })
  }, [syncWithUrl, setSearchParams, defaultPageSize])

  // State setters with URL sync
  const setSearch = useCallback((value) => {
    setSearchState(value)
    setPageState(1) // Reset to first page on search
    updateUrlParams({ search: value, page: 1 })
  }, [updateUrlParams])

  const setPage = useCallback((value) => {
    setPageState(value)
    updateUrlParams({ page: value })
  }, [updateUrlParams])

  const setPageSize = useCallback((value) => {
    setPageSizeState(value)
    setPageState(1) // Reset to first page on page size change
    updateUrlParams({ pageSize: value, page: 1 })
  }, [updateUrlParams])

  const setSorting = useCallback((column, direction) => {
    setSortColumnState(column)
    setSortDirectionState(direction)
    updateUrlParams({ sortColumn: column, sortDirection: direction })
  }, [updateUrlParams])

  const setFilter = useCallback((key, value) => {
    setFiltersState((prev) => {
      const newFilters = { ...prev, [key]: value }
      // Combine filter and page updates into single URL update to avoid race condition
      setPageState(1)
      updateUrlParams({ filters: newFilters, page: 1 })
      return newFilters
    })
  }, [updateUrlParams])

  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters)
    setPageState(1)
    updateUrlParams({ filters: defaultFilters, page: 1 })
  }, [defaultFilters, updateUrlParams])

  const setColumnVisibility = useCallback((value) => {
    setColumnVisibilityState(typeof value === 'function' ? value(columnVisibility) : value)
  }, [columnVisibility])

  const resetAll = useCallback(() => {
    setSearchState('')
    setPageState(1)
    setPageSizeState(defaultPageSize)
    setSortColumnState(defaultSortColumn)
    setSortDirectionState(defaultSortDirection)
    setFiltersState(defaultFilters)
    setColumnVisibilityState(defaultColumnVisibility)
    if (syncWithUrl) {
      setSearchParams(new URLSearchParams(), { replace: true })
    }
  }, [syncWithUrl, setSearchParams, defaultPageSize, defaultSortColumn, defaultSortDirection, defaultFilters, defaultColumnVisibility])

  // Computed values
  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize])

  // Sorting state in @tanstack/react-table format
  const sorting = useMemo(() => {
    if (!sortColumn) return []
    return [{ id: sortColumn, desc: sortDirection === 'desc' }]
  }, [sortColumn, sortDirection])

  const onSortingChange = useCallback((updater) => {
    const newSorting = typeof updater === 'function' ? updater(sorting) : updater
    if (newSorting.length === 0) {
      setSorting('', 'asc')
    } else {
      const { id, desc } = newSorting[0]
      setSorting(id, desc ? 'desc' : 'asc')
    }
  }, [sorting, setSorting])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((value) => value !== '' && value !== null && value !== undefined)
  }, [filters])

  return {
    // State values
    search,
    page,
    pageSize,
    sortColumn,
    sortDirection,
    sorting,
    filters,
    columnVisibility,

    // Setters
    setSearch,
    setPage,
    setPageSize,
    setSorting,
    onSortingChange,
    setFilter,
    clearFilters,
    setColumnVisibility,
    resetAll,

    // Computed values
    offset,
    hasActiveFilters,

    // Constants
    pageSizeOptions: DEFAULT_PAGE_SIZES,
  }
}

export default useDataTable
