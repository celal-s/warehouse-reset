import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { managerNavItems } from '../../config/managerNav'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function ManagerReceiving() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [filters, setFilters] = useState({
    client_id: '',
    start_date: '',
    end_date: ''
  })
  const [clients, setClients] = useState([])

  useEffect(() => {
    loadClients()
    loadEntries()
  }, [page])

  const loadClients = async () => {
    try {
      const response = await fetch(`${API_BASE}/clients`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      }
    } catch (err) {
      console.error('Failed to load clients:', err)
    }
  }

  const loadEntries = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page, limit: 50 })
      if (filters.client_id) params.append('client_id', filters.client_id)
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)

      const response = await fetch(`${API_BASE}/manager/receiving?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      if (!response.ok) throw new Error('Failed to load receiving history')
      const data = await response.json()
      setEntries(data.entries || [])
      setPagination(data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    setPage(1)
    loadEntries()
  }

  return (
    <Layout title="Receiving History" navItems={managerNavItems}>
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={filters.client_id}
              onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.client_code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFilter}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No receiving entries found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Good</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Damaged</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receiver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{entry.receiving_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(entry.receiving_date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {entry.client_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{entry.product_title}</td>
                    <td className="px-6 py-4 text-sm text-green-600 font-medium">+{entry.received_good_units}</td>
                    <td className="px-6 py-4 text-sm text-red-600">
                      {entry.received_damaged_units > 0 ? `-${entry.received_damaged_units}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{entry.receiver_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
