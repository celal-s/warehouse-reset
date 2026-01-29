import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { getInventory, getLocations, updateInventoryItem } from '../../api'

export default function EmployeeSort() {
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('awaiting_decision')

  useEffect(() => {
    loadData()
  }, [filter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [itemsData, locationsData] = await Promise.all([
        getInventory({ status: filter || undefined }),
        getLocations()
      ])
      setItems(itemsData)
      setLocations(locationsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLocationChange = async (itemId, locationId) => {
    try {
      await updateInventoryItem(itemId, {
        storage_location_id: locationId || null
      })
      // Update local state
      setItems(items.map(item =>
        item.id === itemId
          ? { ...item, location_id: locationId, location_label: locations.find(l => l.id == locationId)?.label }
          : item
      ))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleConditionChange = async (itemId, condition) => {
    try {
      await updateInventoryItem(itemId, { condition })
      setItems(items.map(item =>
        item.id === itemId ? { ...item, condition } : item
      ))
    } catch (err) {
      setError(err.message)
    }
  }

  const navItems = [
    { to: '/employee/scan', label: 'Scan' },
    { to: '/employee/sort', label: 'Sort' },
    { to: '/employee/returns', label: 'Returns' }
  ]

  return (
    <Layout title="Sort Inventory" backLink="/" navItems={navItems}>
      {/* Filter */}
      <div className="mb-6 flex gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All items</option>
          <option value="awaiting_decision">Awaiting decision</option>
          <option value="decision_made">Decision made</option>
          <option value="processed">Processed</option>
        </select>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No items found
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Condition
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {item.photos?.[0] && (
                        <img
                          src={item.photos[0].url}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div>
                        <div className="font-medium text-gray-900 truncate max-w-xs">
                          {item.product_title}
                        </div>
                        {item.upc && (
                          <div className="text-xs text-gray-500">UPC: {item.upc}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {item.client_code}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={item.condition}
                      onChange={(e) => handleConditionChange(item.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded border ${
                        item.condition === 'sellable'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      <option value="sellable">Sellable</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={item.location_id || ''}
                      onChange={(e) => handleLocationChange(item.id, e.target.value)}
                      className="text-sm px-2 py-1 border rounded"
                    >
                      <option value="">-- None --</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.status === 'awaiting_decision'
                        ? 'bg-yellow-100 text-yellow-800'
                        : item.status === 'decision_made'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.status?.replace('_', ' ') || 'unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
