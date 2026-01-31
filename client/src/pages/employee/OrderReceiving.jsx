import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { OrderStatusBadge, OrderProgressBar } from '../../components/orders'
import { getClients, searchOrdersForReceiving, getOrderForReceiving, submitOrderReceiving } from '../../api'

const employeeNavItems = [
  { to: '/employee/scan', label: 'Scan' },
  { to: '/employee/sort', label: 'Sort' },
  { to: '/employee/returns', label: 'Returns' },
  { to: '/employee/receiving', label: 'Receiving' }
]

export default function OrderReceiving() {
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Receiving form state
  const [goodUnits, setGoodUnits] = useState('')
  const [damagedUnits, setDamagedUnits] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [receivingResult, setReceivingResult] = useState(null)

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      const data = await getClients()
      setClients(data)
    } catch (err) {
      setError('Failed to load clients')
    }
  }

  const handleSearch = async () => {
    if (!selectedClientId) {
      setError('Please select a client first')
      return
    }
    if (!searchQuery.trim()) {
      setError('Please enter a search term')
      return
    }

    setSearching(true)
    setError(null)
    setSelectedOrder(null)

    try {
      const data = await searchOrdersForReceiving(selectedClientId, searchQuery)
      setOrders(data.orders || data)
      if ((data.orders || data).length === 0) {
        setError('No matching orders found')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectOrder = async (order) => {
    setLoading(true)
    try {
      const fullOrder = await getOrderForReceiving(order.id)
      setSelectedOrder(fullOrder)
      // Reset form
      setGoodUnits('')
      setDamagedUnits('')
      setTrackingNumber('')
      setNotes('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateSellableUnits = () => {
    if (!selectedOrder) return 0
    const good = parseInt(goodUnits) || 0
    return Math.floor(good / (selectedOrder.selling_bundle_count || 1))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedOrder) return

    const good = parseInt(goodUnits) || 0
    const damaged = parseInt(damagedUnits) || 0

    if (good === 0 && damaged === 0) {
      setError('Please enter at least one unit (good or damaged)')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await submitOrderReceiving(selectedOrder.id, {
        good_units: good,
        damaged_units: damaged,
        tracking_number: trackingNumber,
        notes
      })
      setReceivingResult(result)
      setShowSuccessModal(true)

      // Refresh the order
      const updatedOrder = await getOrderForReceiving(selectedOrder.id)
      setSelectedOrder(updatedOrder)

      // Reset form
      setGoodUnits('')
      setDamagedUnits('')
      setTrackingNumber('')
      setNotes('')

      // Refresh search results
      handleSearch()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const closeSuccessModal = () => {
    setShowSuccessModal(false)
    setReceivingResult(null)
  }

  return (
    <Layout title="Order Receiving" navItems={employeeNavItems}>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Search */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">1. Select Client</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {clients.map(client => (
                <label
                  key={client.id}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedClientId === client.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="client"
                    value={client.id}
                    checked={selectedClientId === client.id}
                    onChange={() => setSelectedClientId(client.id)}
                    className="sr-only"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{client.client_code}</div>
                    <div className="text-sm text-gray-500">{client.name}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">2. Search Orders</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by SKU, ASIN, PO#, or product title..."
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Search Results */}
          {orders.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">3. Select Order ({orders.length} found)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Line</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map(order => (
                      <tr
                        key={order.id}
                        onClick={() => handleSelectOrder(order)}
                        className={`cursor-pointer transition-colors ${
                          selectedOrder?.id === order.id
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-sm">{order.warehouse_order_line_id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-xs">{order.product_title}</div>
                          <div className="text-xs text-gray-500">{order.sku || order.asin}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">{order.expected_single_units}</td>
                        <td className="px-4 py-3 text-sm">{order.received_good_units + order.received_damaged_units}</td>
                        <td className="px-4 py-3"><OrderStatusBadge status={order.receiving_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Order Details & Receiving Form */}
        <div className="space-y-6">
          {selectedOrder ? (
            <>
              {/* Order Details */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Details</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Order Line</dt>
                    <dd className="font-mono">{selectedOrder.warehouse_order_line_id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">PO #</dt>
                    <dd>{selectedOrder.purchase_order_no || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Vendor</dt>
                    <dd>{selectedOrder.vendor || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 mb-1">Product</dt>
                    <dd className="font-medium">{selectedOrder.product_title}</dd>
                  </div>
                  {selectedOrder.sku && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">SKU</dt>
                      <dd className="font-mono">{selectedOrder.sku}</dd>
                    </div>
                  )}
                  {selectedOrder.asin && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">ASIN</dt>
                      <dd className="font-mono">{selectedOrder.asin}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Selling Bundle</dt>
                    <dd>{selectedOrder.selling_bundle_count} units/pack</dd>
                  </div>
                </dl>

                <div className="mt-4 pt-4 border-t">
                  <OrderProgressBar
                    received={selectedOrder.received_good_units}
                    expected={selectedOrder.expected_single_units}
                    damaged={selectedOrder.received_damaged_units}
                  />
                </div>

                {selectedOrder.notes_to_warehouse && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs font-medium text-yellow-800 mb-1">Notes from Client:</p>
                    <p className="text-sm text-yellow-700">{selectedOrder.notes_to_warehouse}</p>
                  </div>
                )}
              </div>

              {/* Receiving Form */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">4. Enter Receiving</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Good Units</label>
                      <input
                        type="number"
                        min="0"
                        value={goodUnits}
                        onChange={(e) => setGoodUnits(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Damaged Units</label>
                      <input
                        type="number"
                        min="0"
                        value={damagedUnits}
                        onChange={(e) => setDamagedUnits(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{calculateSellableUnits()}</div>
                    <div className="text-sm text-blue-600">Sellable Units</div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional notes..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit Receiving'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>Select an order to receive</p>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && receivingResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Receiving Submitted!</h3>
              <p className="text-gray-600 mb-4">
                Receiving ID: <span className="font-mono font-bold">{receivingResult.receiving_id}</span>
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Order status: <OrderStatusBadge status={receivingResult.status} />
              </p>
              <button
                onClick={closeSuccessModal}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
