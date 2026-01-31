import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import LabelUpload from '../../components/upload/LabelUpload'
import { getClientInventoryItem, makeDecision } from '../../api'
import { useClientNavigation } from '../../hooks/useClientNavigation'

export default function ClientItemDetail() {
  const { clientCode, itemId } = useParams()
  const { navItems, isStaffViewing } = useClientNavigation()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  // Decision form state
  const [decision, setDecision] = useState('')
  const [shippingLabelUrl, setShippingLabelUrl] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadItem()
  }, [clientCode, itemId])

  const loadItem = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getClientInventoryItem(clientCode, itemId)
      setItem(data)
      // Pre-fill form if decision already made
      if (data.decision) {
        setDecision(data.decision)
        setShippingLabelUrl(data.shipping_label_url || '')
        setNotes(data.decision_notes || '')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitDecision = async (e) => {
    e.preventDefault()

    if (!decision) {
      setError('Please select a decision')
      return
    }

    if (decision === 'return' && !shippingLabelUrl) {
      setError('Please upload a shipping label for returns')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await makeDecision(clientCode, itemId, {
        decision,
        shipping_label_url: shippingLabelUrl || null,
        notes: notes || null
      })
      setSuccess('Decision submitted successfully!')
      // Reload item to reflect updated status
      await loadItem()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const managerViewingClient = isStaffViewing ? clientCode : null

  const decisionOptions = [
    { value: 'ship_to_fba', label: 'Ship to FBA', description: 'Send to Amazon fulfillment center' },
    { value: 'return', label: 'Return to Me', description: 'Ship back to your address' },
    { value: 'dispose', label: 'Dispose', description: 'Discard the item' },
    { value: 'keep_in_stock', label: 'Keep in Stock', description: 'Store for future use' },
    { value: 'other', label: 'Other', description: 'Specify in notes' }
  ]

  if (loading) {
    return (
      <Layout title="Item Details" navItems={navItems} managerViewingClient={managerViewingClient}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading item...</p>
        </div>
      </Layout>
    )
  }

  if (error && !item) {
    return (
      <Layout title="Item Details" navItems={navItems} managerViewingClient={managerViewingClient}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Item Details" navItems={navItems} managerViewingClient={managerViewingClient}>
      {/* Success message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Info */}
        <div className="bg-white rounded-lg shadow">
          {/* Two-Sided Photos */}
          {(item?.photos?.length > 0 || item?.inventory_photos?.length > 0 || item?.listing_image_url) && (
            <div className="p-6 border-b">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Photos</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Listing Photo */}
                <div>
                  <h4 className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Listing
                  </h4>
                  {item?.listing_image_url || item?.photos?.find(p => p.source === 'listing' || p.source === 'client_import') ? (
                    <img
                      src={item.listing_image_url || item.photos.find(p => p.source === 'listing' || p.source === 'client_import')?.url}
                      alt="Listing"
                      className="w-full aspect-square object-cover rounded-lg border"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-400">No listing photo</span>
                    </div>
                  )}
                </div>

                {/* Warehouse Photo */}
                <div>
                  <h4 className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Warehouse
                  </h4>
                  {item?.inventory_photos?.[0] || item?.photos?.find(p => p.source === 'warehouse') ? (
                    <img
                      src={item.inventory_photos?.[0]?.url || item.photos.find(p => p.source === 'warehouse')?.url || item.photos[0]?.url}
                      alt="Warehouse"
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                  ) : item?.photos?.[0] ? (
                    <img
                      src={item.photos[0].url}
                      alt="Product"
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-400">No warehouse photo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional inventory photos */}
              {item?.inventory_photos?.length > 1 && (
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Additional Item Photos</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {item.inventory_photos.slice(1).map((photo, idx) => (
                      <img
                        key={photo.id || idx}
                        src={photo.url}
                        alt={`Item photo ${idx + 2}`}
                        className="w-full aspect-square object-cover rounded border"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Product Details */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{item?.product_title}</h2>

            <dl className="space-y-3">
              {item?.upc && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">UPC</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.upc}</dd>
                </div>
              )}
              {item?.sku && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">SKU</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.sku}</dd>
                </div>
              )}
              {item?.asin && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">ASIN</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.asin}</dd>
                </div>
              )}
              {item?.fnsku && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">FNSKU</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.fnsku}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Quantity</dt>
                <dd className="text-sm font-medium text-gray-900">{item?.quantity}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Condition</dt>
                <dd>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item?.condition === 'sellable'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {item?.condition}
                  </span>
                </dd>
              </div>
              {item?.location_label && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Location</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.location_label}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item?.status === 'awaiting_decision'
                      ? 'bg-yellow-100 text-yellow-800'
                      : item?.status === 'decision_made'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item?.status?.replace(/_/g, ' ')}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Decision Form */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              {item?.status === 'processed' ? 'Decision (Processed)' : 'Make a Decision'}
            </h3>
            {item?.status === 'processed' && (
              <p className="text-sm text-gray-500 mt-1">This item has already been processed.</p>
            )}
          </div>

          <form onSubmit={handleSubmitDecision} className="p-6 space-y-6">
            {/* Decision Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What would you like to do with this item?
              </label>
              <div className="space-y-2">
                {decisionOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                      decision === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${item?.status === 'processed' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={option.value}
                      checked={decision === option.value}
                      onChange={(e) => setDecision(e.target.value)}
                      disabled={item?.status === 'processed'}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-500">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Shipping Label Upload (for returns) */}
            {decision === 'return' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipping Label (PDF) *
                </label>
                {shippingLabelUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-green-700">Label uploaded</span>
                    <a
                      href={shippingLabelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View
                    </a>
                    {item?.status !== 'processed' && (
                      <button
                        type="button"
                        onClick={() => setShippingLabelUrl('')}
                        className="text-sm text-red-600 hover:underline ml-auto"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <LabelUpload
                    inventoryItemId={itemId}
                    onUploadComplete={(url) => setShippingLabelUrl(url)}
                  />
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={item?.status === 'processed'}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="Add any additional instructions or notes..."
              />
            </div>

            {/* Submit Button */}
            {item?.status !== 'processed' && (
              <button
                type="submit"
                disabled={submitting || !decision}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting...' : item?.decision ? 'Update Decision' : 'Submit Decision'}
              </button>
            )}
          </form>
        </div>
      </div>

      {/* History Timeline */}
      {item?.history && item.history.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">History</h3>
          <div className="flow-root">
            <ul className="-mb-8">
              {item.history.map((event, idx) => (
                <li key={event.id || idx}>
                  <div className="relative pb-8">
                    {idx !== item.history.length - 1 && (
                      <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                    )}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                          event.action === 'received' ? 'bg-green-500' :
                          event.action === 'adjusted' ? 'bg-yellow-500' :
                          event.action === 'moved' ? 'bg-blue-500' :
                          event.action === 'condition_updated' ? 'bg-orange-500' :
                          event.action === 'photo_added' ? 'bg-purple-500' :
                          'bg-gray-500'
                        }`}>
                          {event.action === 'received' && (
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {event.action === 'adjusted' && (
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                          {event.action === 'moved' && (
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                          )}
                          {event.action === 'condition_updated' && (
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {event.action === 'photo_added' && (
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          {!['received', 'adjusted', 'moved', 'condition_updated', 'photo_added'].includes(event.action) && (
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium capitalize">{event.action.replace(/_/g, ' ')}</span>
                            {event.field_changed && (
                              <span className="text-gray-500">
                                {' - '}{event.field_changed}: {event.old_value} → {event.new_value}
                              </span>
                            )}
                            {event.quantity_change && (
                              <span className={event.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}>
                                {' '}{event.quantity_change > 0 ? '+' : ''}{event.quantity_change} units
                              </span>
                            )}
                          </p>
                          {event.reason && (
                            <p className="text-xs text-gray-500 mt-0.5">{event.reason}</p>
                          )}
                        </div>
                        <div className="whitespace-nowrap text-right text-xs text-gray-500">
                          {event.changed_at && new Date(event.changed_at).toLocaleDateString()}
                          <br />
                          {event.changed_at && new Date(event.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Layout>
  )
}
