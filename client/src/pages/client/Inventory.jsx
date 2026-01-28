import { useState, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getClientInventory } from '../../api'

export default function ClientInventory() {
  const { clientCode } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state from URL params
  const statusFilter = searchParams.get('status') || ''
  const conditionFilter = searchParams.get('condition') || ''

  useEffect(() => {
    loadInventory()
  }, [clientCode, statusFilter, conditionFilter])

  const loadInventory = async () => {
    setLoading(true)
    setError(null)
    try {
      const filters = {}
      if (statusFilter) filters.status = statusFilter
      if (conditionFilter) filters.condition = conditionFilter
      const data = await getClientInventory(clientCode, filters)
      setItems(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    setSearchParams(newParams)
  }

  const getStatusBadge = (status) => {
    const styles = {
      awaiting_decision: 'bg-yellow-100 text-yellow-800',
      decision_made: 'bg-blue-100 text-blue-800',
      processed: 'bg-green-100 text-green-800'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.replace(/_/g, ' ') || 'unknown'}
      </span>
    )
  }

  const getConditionBadge = (condition) => {
    const styles = {
      sellable: 'bg-green-100 text-green-800',
      damaged: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[condition] || 'bg-gray-100 text-gray-800'}`}>
        {condition}
      </span>
    )
  }

  const getDecisionBadge = (decision) => {
    if (!decision) return null
    const styles = {
      ship_to_fba: 'bg-purple-100 text-purple-800',
      return: 'bg-orange-100 text-orange-800',
      dispose: 'bg-red-100 text-red-800',
      keep_in_stock: 'bg-blue-100 text-blue-800',
      other: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[decision] || 'bg-gray-100 text-gray-800'}`}>
        {decision.replace(/_/g, ' ')}
      </span>
    )
  }

  const navItems = [
    { to: `/client/${clientCode}`, label: 'Dashboard' },
    { to: `/client/${clientCode}/inventory`, label: 'Inventory' }
  ]

  return (
    <Layout title="Inventory" backLink={`/client/${clientCode}`} navItems={navItems}>
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="awaiting_decision">Awaiting Decision</option>
              <option value="decision_made">Decision Made</option>
              <option value="processed">Processed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select
              value={conditionFilter}
              onChange={(e) => updateFilter('condition', e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All conditions</option>
              <option value="sellable">Sellable</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadInventory}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading inventory...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No items found</h3>
          <p className="mt-1 text-gray-500">
            {statusFilter || conditionFilter ? 'Try adjusting your filters.' : 'No inventory items yet.'}
          </p>
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
                  UPC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Condition
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Decision
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
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
                      <div className="font-medium text-gray-900 truncate max-w-xs">
                        {item.product_title}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.upc || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4">
                    {getConditionBadge(item.condition)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="px-6 py-4">
                    {getDecisionBadge(item.decision)}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/client/${clientCode}/inventory/${item.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Item count */}
      {!loading && items.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {items.length} item{items.length !== 1 ? 's' : ''}
        </div>
      )}
    </Layout>
  )
}
