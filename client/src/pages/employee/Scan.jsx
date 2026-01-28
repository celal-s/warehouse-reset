import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import ScannerInput from '../../components/scanner/ScannerInput'
import PhotoUpload from '../../components/upload/PhotoUpload'
import { scanUPC, searchProducts, getClients, getLocations, createInventoryItem } from '../../api'

export default function EmployeeScan() {
  const [product, setProduct] = useState(null)
  const [clients, setClients] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Form state
  const [selectedClient, setSelectedClient] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState('sellable')
  const [locationId, setLocationId] = useState('')
  const [needsPhoto, setNeedsPhoto] = useState(false)
  const [photoUploaded, setPhotoUploaded] = useState(false)

  const [success, setSuccess] = useState(null)

  useEffect(() => {
    Promise.all([getClients(), getLocations()])
      .then(([clientsData, locationsData]) => {
        setClients(clientsData)
        setLocations(locationsData)
      })
      .catch(console.error)
  }, [])

  const handleScan = async (upc) => {
    setLoading(true)
    setError(null)
    setNotFound(false)
    setProduct(null)
    setSelectedClient(null)
    setNeedsPhoto(false)
    setPhotoUploaded(false)
    setSearchQuery(upc)

    try {
      // First try exact UPC match
      let result = await scanUPC(upc).catch(() => null)

      if (!result) {
        // Try general search
        const searchResults = await searchProducts(upc)
        if (Array.isArray(searchResults) && searchResults.length === 1) {
          result = searchResults[0]
        } else if (searchResults.length > 1) {
          // Multiple results - show list
          setError(`Multiple products found. Please refine your search.`)
          setLoading(false)
          return
        } else {
          setNotFound(true)
          setLoading(false)
          return
        }
      }

      setProduct(result)

      // If only one client owns this product, auto-select
      if (result.client_listings?.length === 1) {
        setSelectedClient(result.client_listings[0])
      }

      // Check if product needs photos
      const hasPhotos = result.has_photos || (result.photos && result.photos.length > 0)
      setNeedsPhoto(!hasPhotos)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddInventory = async () => {
    if (!product || !selectedClient) {
      setError('Please select a client')
      return
    }

    if (needsPhoto && !photoUploaded) {
      setError('Please upload a photo of the product first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await createInventoryItem({
        product_id: product.id,
        client_id: selectedClient.client_id,
        storage_location_id: locationId || null,
        quantity,
        condition
      })

      setSuccess(`Added ${quantity}x "${product.title}" for client ${selectedClient.client_code}`)

      // Reset form
      setProduct(null)
      setSelectedClient(null)
      setQuantity(1)
      setCondition('sellable')
      setLocationId('')
      setNeedsPhoto(false)
      setPhotoUploaded(false)

      // Clear success after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const navItems = [
    { to: '/employee/scan', label: 'Scan' },
    { to: '/employee/sort', label: 'Sort' }
  ]

  return (
    <Layout title="Scan Inventory" backLink="/" navItems={navItems}>
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

      {/* Scanner Input */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <ScannerInput onScan={handleScan} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Searching...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Not Found */}
      {notFound && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-yellow-800">Product Not Found</h3>
          <p className="mt-2 text-yellow-700">No product found for "{searchQuery}"</p>
          <p className="mt-1 text-sm text-yellow-600">Ask an admin to import the product.</p>
        </div>
      )}

      {/* Product Found */}
      {product && !loading && (
        <div className="bg-white rounded-lg shadow">
          {/* Product Info */}
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">{product.title}</h2>
            {product.upc && (
              <p className="text-sm text-gray-500">UPC: {product.upc}</p>
            )}

            {/* Product Photos */}
            {product.photos && product.photos.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {product.photos.map((photo) => (
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt="Product"
                    className="w-20 h-20 object-cover rounded-lg border"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Client Selection */}
          <div className="p-6 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Client *
            </label>
            {product.client_listings?.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {product.client_listings.map((listing) => (
                  <button
                    key={`${listing.client_id}-${listing.marketplace}`}
                    onClick={() => setSelectedClient(listing)}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      selectedClient?.client_id === listing.client_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-lg">{listing.client_code}</div>
                    <div className="text-xs text-gray-500">
                      {listing.sku && <div>SKU: {listing.sku}</div>}
                      {listing.marketplace && <div>Market: {listing.marketplace.toUpperCase()}</div>}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No client listings found for this product.</p>
            )}
          </div>

          {/* Photo Upload (if needed) */}
          {needsPhoto && (
            <div className="p-6 border-b bg-yellow-50">
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-medium text-yellow-800">Photo Required</h3>
                  <p className="text-sm text-yellow-700">
                    This is the first time this product is being added. Please take a photo.
                  </p>
                </div>
              </div>
              {!photoUploaded ? (
                <PhotoUpload
                  productId={product.id}
                  onUploadComplete={() => setPhotoUploaded(true)}
                />
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Photo uploaded successfully
                </div>
              )}
            </div>
          )}

          {/* Quantity & Condition */}
          <div className="p-6 border-b grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="sellable">Sellable</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
          </div>

          {/* Storage Location */}
          <div className="p-6 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Storage Location (optional)
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select location --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.label} ({loc.type})
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="p-6">
            <button
              onClick={handleAddInventory}
              disabled={!selectedClient || (needsPhoto && !photoUploaded) || loading}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Add to Inventory
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
