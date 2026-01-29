import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { DataTable, DataTableToolbar, useDataTable } from '../../components/DataTable'
import { Button, Alert, Badge, StatusBadge } from '../../components/ui'
import { getReturns, completeReturn } from '../../api'

const managerNavItems = [
  { to: '/manager', label: 'Dashboard' },
  { to: '/manager/import', label: 'Import' },
  { to: '/manager/locations', label: 'Locations' },
  { to: '/manager/products', label: 'Products' },
  { to: '/manager/users', label: 'Users' },
  { to: '/manager/returns', label: 'Returns' }
]

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'matched', label: 'Matched' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'unmatched', label: 'Unmatched' }
]

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Check if return is urgent (due within 3 days or overdue)
const isUrgent = (returnItem) => {
  if (!returnItem.return_by_date) return false
  const returnBy = new Date(returnItem.return_by_date)
  const now = new Date()
  const daysUntilDue = Math.ceil((returnBy - now) / (1000 * 60 * 60 * 24))
  return daysUntilDue <= 3
}

// Get urgency color for the row
const getUrgencyRowClass = (returnItem) => {
  if (!returnItem.return_by_date || returnItem.status === 'completed' || returnItem.status === 'cancelled') {
    return ''
  }
  const returnBy = new Date(returnItem.return_by_date)
  const now = new Date()
  const daysUntilDue = Math.ceil((returnBy - now) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) return 'bg-red-50' // Overdue
  if (daysUntilDue <= 3) return 'bg-orange-50' // Urgent
  if (daysUntilDue <= 7) return 'bg-yellow-50' // Warning
  return ''
}

export default function ManagerReturns() {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(null)
  const [totalCount, setTotalCount] = useState(0)

  // Use the DataTable hook for state management with URL sync
  const {
    page,
    pageSize,
    filters,
    setPage,
    setPageSize,
    setFilter,
    clearFilters,
    hasActiveFilters,
    pageSizeOptions
  } = useDataTable({
    defaultPageSize: 50,
    defaultFilters: {
      status: '',
      urgent: '',
      client_id: ''
    }
  })

  // Derive urgentOnly from filters
  const urgentOnly = filters.urgent === 'true'

  // Load returns data
  const loadReturns = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const apiFilters = {
        page,
        limit: pageSize
      }
      if (filters.status) apiFilters.status = filters.status
      if (filters.client_id) apiFilters.client_id = filters.client_id
      if (filters.urgent === 'true') apiFilters.urgent = 'true'

      const data = await getReturns(apiFilters)
      setReturns(data.returns || data)
      setTotalCount(data.total || data.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters])

  useEffect(() => {
    loadReturns()
  }, [loadReturns])

  // Handle status filter change
  const handleStatusChange = useCallback((status) => {
    setFilter('status', status)
  }, [setFilter])

  // Handle urgent toggle
  const handleUrgentToggle = useCallback(() => {
    setFilter('urgent', urgentOnly ? '' : 'true')
  }, [setFilter, urgentOnly])

  // Handle client filter change
  const handleClientChange = useCallback((clientId) => {
    setFilter('client_id', clientId)
  }, [setFilter])

  // Handle complete action
  const handleComplete = useCallback(async (returnId) => {
    if (!confirm('Mark this return as completed?')) return

    setCompleting(returnId)
    try {
      await completeReturn(returnId)
      loadReturns()
    } catch (err) {
      setError(err.message)
    } finally {
      setCompleting(null)
    }
  }, [loadReturns])

  // Define columns for the DataTable
  const columns = useMemo(() => [
    {
      id: 'id',
      header: 'ID',
      accessorKey: 'id',
      size: 80,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-gray-600">
          #{getValue()}
        </span>
      )
    },
    {
      id: 'product',
      header: 'Product',
      accessorKey: 'product_name',
      cell: ({ row }) => {
        const item = row.original
        return (
          <div className="max-w-xs">
            <div className="font-medium text-gray-900 truncate" title={item.product_name}>
              {item.product_name || 'Unknown Product'}
            </div>
            {item.product_sku && (
              <div className="text-sm text-gray-500 font-mono">
                SKU: {item.product_sku}
              </div>
            )}
            {item.tracking_number && (
              <div className="text-xs text-gray-400 truncate" title={item.tracking_number}>
                {item.tracking_number}
              </div>
            )}
          </div>
        )
      }
    },
    {
      id: 'client',
      header: 'Client',
      accessorKey: 'client_code',
      size: 100,
      cell: ({ getValue }) => (
        <Badge variant="purple">
          {getValue() || '-'}
        </Badge>
      )
    },
    {
      id: 'quantity',
      header: 'Qty',
      accessorKey: 'quantity',
      size: 60,
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-900">
          {getValue() || 1}
        </span>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      size: 110,
      cell: ({ getValue }) => (
        <StatusBadge status={getValue()} />
      )
    },
    {
      id: 'return_by',
      header: 'Return By',
      accessorKey: 'return_by_date',
      size: 130,
      cell: ({ row }) => {
        const item = row.original
        return (
          <div className="flex items-center gap-1">
            {isUrgent(item) && item.status !== 'completed' && item.status !== 'cancelled' && (
              <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-sm text-gray-600">
              {formatDate(item.return_by_date)}
            </span>
          </div>
        )
      }
    },
    {
      id: 'shipped',
      header: 'Shipped',
      accessorKey: 'shipped_at',
      size: 110,
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-600">
          {formatDate(getValue())}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 140,
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original
        return (
          <div className="flex items-center gap-2">
            {item.status === 'shipped' && (
              <Button
                size="sm"
                variant="success"
                onClick={(e) => {
                  e.stopPropagation()
                  handleComplete(item.id)
                }}
                disabled={completing === item.id}
                loading={completing === item.id}
              >
                Complete
              </Button>
            )}
            <Link
              to={`/manager/returns/${item.id}`}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              View
            </Link>
          </div>
        )
      }
    }
  ], [completing, handleComplete])

  // Toolbar with filters
  const toolbar = (
    <DataTableToolbar
      filters={[
        {
          id: 'status',
          label: 'Status',
          options: statusOptions,
          value: filters.status,
          onChange: handleStatusChange
        }
      ]}
      actions={
        <>
          {/* Urgent Toggle */}
          <Button
            variant={urgentOnly ? 'primary' : 'outline'}
            size="sm"
            onClick={handleUrgentToggle}
            className={urgentOnly ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Urgent Only
          </Button>

          {/* Client Filter Input */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Client ID:</label>
            <input
              type="text"
              value={filters.client_id || ''}
              onChange={(e) => handleClientChange(e.target.value)}
              placeholder="Filter by client..."
              className="border rounded-lg px-3 py-1.5 text-sm w-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          )}
        </>
      }
    />
  )

  // Empty state configuration
  const emptyState = {
    icon: (
      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'No returns found',
    description: hasActiveFilters ? 'Try adjusting your filters to find what you\'re looking for.' : undefined,
    action: hasActiveFilters ? (
      <Button variant="link" onClick={clearFilters}>
        Clear filters
      </Button>
    ) : undefined
  }

  return (
    <Layout title="Returns Management" navItems={managerNavItems}>
      {/* Header with Actions */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">All Returns</h2>
          {!loading && (
            <p className="text-sm text-gray-600 mt-1">
              Showing {returns.length} of {totalCount} returns
              {filters.status && ` (${filters.status})`}
              {urgentOnly && ' - Urgent only'}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to="/manager/returns/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import Labels
          </Link>
          <Link
            to="/manager/returns/unmatched"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Unmatched Returns
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={returns}
        loading={loading}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[25, 50, 100]}
        toolbar={toolbar}
        emptyState={emptyState}
        getRowClassName={getUrgencyRowClass}
        getRowId={(row) => row.id}
      />
    </Layout>
  )
}
