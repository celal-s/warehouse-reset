import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { DataTable, DataTableToolbar, useDataTable } from '../../../components/DataTable'
import { Button, Alert } from '../../../components/ui'
import { OrderStatusBadge, OrderProgressBar } from '../../../components/orders'
import { getClientOrders } from '../../../api'
import { useClientNavigation } from '../../../hooks/useClientNavigation'

export default function WarehouseOrders() {
  const { clientCode } = useParams()
  const { navItems, isStaffViewing } = useClientNavigation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)

  const { filters, setFilter, clearFilters, hasActiveFilters } = useDataTable({
    defaultFilters: { status: '', search: '' },
    syncWithUrl: true
  })

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      const data = await getClientOrders(clientCode, params)
      setOrders(data.orders || data)
      setTotal(data.total || data.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [clientCode, filters])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const columns = useMemo(() => [
    {
      id: 'order_line_id',
      header: 'Order Line',
      accessorKey: 'warehouse_order_line_id',
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue()}</span>
      )
    },
    {
      id: 'product',
      header: 'Product',
      accessorKey: 'product_title',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900 truncate max-w-xs">{row.original.product_title}</div>
          <div className="text-xs text-gray-500">
            {row.original.sku && <span>SKU: {row.original.sku}</span>}
            {row.original.asin && <span className="ml-2">ASIN: {row.original.asin}</span>}
          </div>
        </div>
      )
    },
    {
      id: 'po',
      header: 'PO #',
      accessorKey: 'purchase_order_no',
      cell: ({ getValue }) => <span className="text-sm">{getValue() || '-'}</span>
    },
    {
      id: 'vendor',
      header: 'Vendor',
      accessorKey: 'vendor',
      cell: ({ getValue }) => <span className="text-sm text-gray-600">{getValue() || '-'}</span>
    },
    {
      id: 'expected',
      header: 'Expected',
      accessorKey: 'expected_single_units',
      cell: ({ getValue }) => <span className="text-sm font-medium">{getValue()}</span>
    },
    {
      id: 'progress',
      header: 'Progress',
      cell: ({ row }) => (
        <div className="w-40">
          <OrderProgressBar
            received={row.original.received_good_units}
            expected={row.original.expected_single_units}
            damaged={row.original.received_damaged_units}
          />
        </div>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'receiving_status',
      cell: ({ getValue }) => <OrderStatusBadge status={getValue()} />
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link
          to={`/client/${clientCode}/orders/${row.original.id}`}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          View
        </Link>
      )
    }
  ], [clientCode])

  // Status tabs
  const statusTabs = [
    { value: '', label: 'All' },
    { value: 'awaiting', label: 'Awaiting' },
    { value: 'partial', label: 'Partial' },
    { value: 'complete', label: 'Complete' }
  ]

  return (
    <Layout
      title="Warehouse Orders"
      navItems={navItems}
      managerViewingClient={isStaffViewing ? clientCode : null}
    >
      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6">
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter('status', tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.status === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        emptyState={{
          icon: <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
          title: 'No orders found',
          description: hasActiveFilters ? 'Try adjusting your filters' : 'No warehouse orders yet',
          action: hasActiveFilters ? <Button variant="ghost" onClick={clearFilters}>Clear filters</Button> : undefined
        }}
        toolbar={
          <DataTableToolbar
            searchPlaceholder="Search orders..."
            searchValue={filters.search}
            onSearchChange={(value) => setFilter('search', value)}
            actions={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={loadOrders}>Refresh</Button>
                <Link to={`/client/${clientCode}/orders/new`}>
                  <Button>New Order</Button>
                </Link>
              </div>
            }
          />
        }
      />

      {!loading && orders.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {orders.length} of {total} orders
        </div>
      )}
    </Layout>
  )
}
