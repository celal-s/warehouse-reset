import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { managerNavItems } from '../../config/managerNav'

export default function ManagerClients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/manager/clients', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      if (!response.ok) throw new Error('Failed to load clients')
      const data = await response.json()
      setClients(data.clients || data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Client Management" navItems={managerNavItems}>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No clients found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div key={client.id || client.client_code} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-700 font-bold text-lg">{client.client_code}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{client.name || client.client_code}</h3>
                  <p className="text-sm text-gray-500">Client #{client.id}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">{client.total_orders || 0}</div>
                  <div className="text-xs text-gray-500">Orders</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-yellow-600">{client.pending_orders || 0}</div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-600">{client.received_units || 0}</div>
                  <div className="text-xs text-gray-500">Units Received</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-600">{client.damaged_units || 0}</div>
                  <div className="text-xs text-gray-500">Damaged</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  to={`/client/${client.client_code}`}
                  className="flex-1 text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  View Portal
                </Link>
                <Link
                  to={`/client/${client.client_code}/orders`}
                  className="flex-1 text-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Orders
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
