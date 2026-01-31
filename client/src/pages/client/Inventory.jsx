import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import { DataTable, DataTableToolbar, useDataTable } from '../../components/DataTable'
import { Button, Alert, StatusBadge } from '../../components/ui'
import { getClientInventory } from '../../api'
import { useClientNavigation } from '../../hooks/useClientNavigation'

export default function ClientInventory() {
  const { clientCode } = useParams()
  const { navItems, isStaffViewing } = useClientNavigation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Use the DataTable hook for state management with URL sync
  const {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters
  } = useDataTable({
    defaultFilters: {
      status: '',
      condition: ''
    },
    syncWithUrl: true
  })

  const loadInventory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiFilters = {}
      if (filters.status) apiFilters.status = filters.status
      if (filters.condition) apiFilters.condition = filters.condition
      const data = await getClientInventory(clientCode, apiFilters)
      setItems(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [clientCode, filters])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  // Define columns for DataTable
  const columns = useMemo(() => [
    {
      id: 'product',
      header: 'Product',
      accessorKey: 'product_title',
      cell: ({ row }) => {
        const item = row.original
        const imageUrl = item.photos?.[0]?.url || item.display_image_url
        return (
          <div className="flex items-center gap-3">
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="w-10 h-10 object-cover rounded"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}
            <div className="font-medium text-gray-900 truncate max-w-xs">
              {item.product_title}
            </div>
          </div>
        )
      },
      enableSorting: false,
    },
    {
      id: 'upc',
      header: 'UPC',
      accessorKey: 'upc',
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-500">{getValue() || '-'}</span>
      ),
      enableSorting: false,
    },
    {
      id: 'qty',
      header: 'Qty',
      accessorKey: 'quantity',
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-900">{getValue()}</span>
      ),
      enableSorting: false,
    },
    {
      id: 'condition',
      header: 'Condition',
      accessorKey: 'condition',
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      enableSorting: false,
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      enableSorting: false,
    },
    {
      id: 'decision',
      header: 'Decision',
      accessorKey: 'client_decision',
      cell: ({ getValue }) => {
        const decision = getValue()
        if (!decision) return null
        return <StatusBadge status={decision} />
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Link
          to={`/client/${clientCode}/inventory/${row.original.id}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          View
        </Link>
      ),
      enableSorting: false,
    },
  ], [clientCode])

  // Filter configuration for toolbar
  const filterConfig = [
    {
      id: 'status',
      label: 'Status',
      options: [
        { value: '', label: 'All statuses' },
        { value: 'awaiting_decision', label: 'Awaiting Decision' },
        { value: 'decision_made', label: 'Decision Made' },
        { value: 'processed', label: 'Processed' }
      ],
      value: filters.status,
      onChange: (value) => setFilter('status', value)
    },
    {
      id: 'condition',
      label: 'Condition',
      options: [
        { value: '', label: 'All conditions' },
        { value: 'sellable', label: 'Sellable' },
        { value: 'damaged', label: 'Damaged' }
      ],
      value: filters.condition,
      onChange: (value) => setFilter('condition', value)
    }
  ]

  // Empty state configuration
  const emptyState = {
    icon: (
      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: 'No items found',
    description: hasActiveFilters ? 'Try adjusting your filters.' : 'No inventory items yet.',
    action: hasActiveFilters ? (
      <Button variant="ghost" onClick={clearFilters}>
        Clear filters
      </Button>
    ) : undefined
  }

  return (
    <Layout
      title="Inventory"
      navItems={navItems}
      managerViewingClient={isStaffViewing ? clientCode : null}
    >
      {/* Error alert */}
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        emptyState={emptyState}
        toolbar={
          <DataTableToolbar
            filters={filterConfig}
            actions={
              <Button variant="secondary" onClick={loadInventory}>
                Refresh
              </Button>
            }
          />
        }
      />

      {/* Item count */}
      {!loading && items.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {items.length} item{items.length !== 1 ? 's' : ''}
        </div>
      )}
    </Layout>
  )
}
