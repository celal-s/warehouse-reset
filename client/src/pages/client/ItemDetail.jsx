import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import LabelUpload from '../../components/upload/LabelUpload'
import { getClientInventoryItem, makeDecision } from '../../api'

export default function ClientItemDetail() {
  const { clientCode, itemId } = useParams()
  const navigate = useNavigate()
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

  const navItems = [
    { to: `/client/${clientCode}`, label: 'Dashboard' },
    { to: `/client/${clientCode}/inventory`, label: 'Inventory' }
  ]

  const decisionOptions = [
    { value: 'ship_to_fba', label: 'Ship to FBA', description: 'Send to Amazon fulfillment center' },
    { value: 'return', label: 'Return to Me', description: 'Ship back to your address' },
    { value: 'dispose', label: 'Dispose', description: 'Discard the item' },
    { value: 'keep_in_stock', label: 'Keep in Stock', description: 'Store for future use' },
    { value: 'other', label: 'Other', description: 'Specify in notes' }
  ]

  if (loading) {
    return (
      <Layout title="Item Details" backLink={`/client/${clientCode}/inventory`} navItems={navItems}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading item...</p>
        </div>
      </Layout>
    )
  }

  if (error && !item) {
    return (
      <Layout title="Item Details" backLink={`/client/${clientCode}/inventory`} navItems={navItems}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Item Details" backLink={`/client/${clientCode}/inventory`} navItems={navItems}>
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
          {/* Photos */}
          {item?.photos && item.photos.length > 0 && (
            <div className="p-6 border-b">
              <div className="grid grid-cols-3 gap-2">
                {item.photos.map((photo, index) => (
                  <img
                    key={photo.id || index}
                    src={photo.url}
                    alt={`Product photo ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                ))}
              </div>
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
    </Layout>
  )
}
