import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, Alert, Card } from '../../../components/ui'
import { OrderStatusBadge, OrderProgressBar, ReceivingHistoryTable } from '../../../components/orders'
import { getClientOrder, cancelClientOrder } from '../../../api'
import { useClientNavigation } from '../../../hooks/useClientNavigation'

export default function WarehouseOrderDetail() {
  const { clientCode, orderId } = useParams()
  const { navItems, isStaffViewing } = useClientNavigation()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [clientCode, orderId])

  const loadOrder = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getClientOrder(clientCode, orderId)
      setOrder(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelClientOrder(clientCode, orderId)
      await loadOrder()
      setShowCancelConfirm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatCurrency = (value) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  if (loading) {
    return (
      <Layout title="Order Details" navItems={navItems} managerViewingClient={isStaffViewing ? clientCode : null}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading order...</p>
        </div>
      </Layout>
    )
  }

  if (error && !order) {
    return (
      <Layout title="Order Details" navItems={navItems} managerViewingClient={isStaffViewing ? clientCode : null}>
        <Alert variant="error">{error}</Alert>
      </Layout>
    )
  }

  const canCancel = order?.receiving_status === 'awaiting' && order?.received_good_units === 0

  return (
    <Layout
      title="Order Details"
      navItems={navItems}
      managerViewingClient={isStaffViewing ? clientCode : null}
    >
      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Header with status and actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Order Line: <span className="font-mono">{order?.warehouse_order_line_id}</span>
            </h2>
            <OrderStatusBadge status={order?.receiving_status} />
          </div>
          {order?.purchase_order_no && (
            <p className="text-sm text-gray-500 mt-1">PO: {order.purchase_order_no}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={`/client/${clientCode}/orders`}>
            <Button variant="secondary">Back to Orders</Button>
          </Link>
          {canCancel && (
            <Button variant="danger" onClick={() => setShowCancelConfirm(true)}>
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Order?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowCancelConfirm(false)}>
                Keep Order
              </Button>
              <Button variant="danger" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Card */}
        <Card title="Receiving Progress">
          <div className="mb-6">
            <OrderProgressBar
              received={order?.received_good_units || 0}
              expected={order?.expected_single_units || 0}
              damaged={order?.received_damaged_units || 0}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{order?.expected_single_units || 0}</div>
              <div className="text-sm text-gray-500">Expected</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{order?.received_good_units || 0}</div>
              <div className="text-sm text-gray-500">Good Received</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{order?.received_damaged_units || 0}</div>
              <div className="text-sm text-gray-500">Damaged</div>
            </div>
          </div>
          {order?.expected_sellable_units && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Expected Sellable Units</span>
                <span className="text-lg font-semibold text-blue-600">{order.expected_sellable_units}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Product Info Card */}
        <Card title="Product Information">
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Product</dt>
              <dd className="text-sm font-medium text-gray-900 text-right max-w-xs truncate">
                {order?.product_title || '-'}
              </dd>
            </div>
            {order?.sku && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">SKU</dt>
                <dd className="text-sm font-mono text-gray-900">{order.sku}</dd>
              </div>
            )}
            {order?.asin && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">ASIN</dt>
                <dd className="text-sm font-mono text-gray-900">{order.asin}</dd>
              </div>
            )}
            {order?.fnsku && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">FNSKU</dt>
                <dd className="text-sm font-mono text-gray-900">{order.fnsku}</dd>
              </div>
            )}
            {order?.upc && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">UPC</dt>
                <dd className="text-sm font-mono text-gray-900">{order.upc}</dd>
              </div>
            )}
            {order?.marketplace && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Marketplace</dt>
                <dd className="text-sm text-gray-900 uppercase">{order.marketplace}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Bundle Configuration Card */}
        <Card title="Bundle Configuration">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {order?.purchase_bundle_count || 1}
              </div>
              <div className="text-xs text-gray-500">Units per Purchase Pack</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {order?.purchase_order_quantity || 0}
              </div>
              <div className="text-xs text-gray-500">PO Quantity (Packs)</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {order?.selling_bundle_count || 1}
              </div>
              <div className="text-xs text-gray-500">Units per Selling Pack</div>
            </div>
          </div>
        </Card>

        {/* Order Details Card */}
        <Card title="Order Details">
          <dl className="space-y-3">
            {order?.vendor && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Vendor</dt>
                <dd className="text-sm font-medium text-gray-900">{order.vendor}</dd>
              </div>
            )}
            {order?.total_cost != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Total Cost</dt>
                <dd className="text-sm font-medium text-gray-900">{formatCurrency(order.total_cost)}</dd>
              </div>
            )}
            {order?.unit_cost != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Unit Cost</dt>
                <dd className="text-sm font-medium text-gray-900">{formatCurrency(order.unit_cost)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900">{formatDate(order?.created_at)}</dd>
            </div>
            {order?.last_received_at && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Last Received</dt>
                <dd className="text-sm text-gray-900">{formatDate(order.last_received_at)}</dd>
              </div>
            )}
          </dl>
          {order?.notes && (
            <div className="mt-4 pt-4 border-t">
              <dt className="text-sm text-gray-500 mb-1">Notes</dt>
              <dd className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{order.notes}</dd>
            </div>
          )}
        </Card>
      </div>

      {/* Receiving History */}
      <div className="mt-6">
        <Card title="Receiving History">
          <ReceivingHistoryTable entries={order?.receiving_history || []} />
        </Card>
      </div>
    </Layout>
  )
}
