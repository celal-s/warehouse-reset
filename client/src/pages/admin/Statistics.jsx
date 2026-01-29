import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { getAdminStatistics } from '../../api'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/system', label: 'System' },
  { to: '/admin/statistics', label: 'Statistics' },
  { to: '/admin/schema', label: 'Schema' },
  { to: '/admin/db-browser', label: 'DB Browser' },
  { to: '/admin/navigation', label: 'Routes' },
  { to: '/admin/api-docs', label: 'API Docs' }
]

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6']

export default function AdminStatistics() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('7d')

  useEffect(() => {
    loadStats()
  }, [period])

  const loadStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAdminStatistics(period)
      setStats(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Transform data for charts
  const itemsData = stats?.itemsOverTime?.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: parseInt(item.count)
  })) || []

  const clientData = stats?.clientComparison?.filter(c => c.total_items > 0).map(client => ({
    name: client.client_code,
    items: parseInt(client.total_items) || 0,
    quantity: parseInt(client.total_quantity) || 0
  })) || []

  const conditionData = stats?.conditionBreakdown?.map(item => ({
    name: item.condition || 'Unknown',
    value: parseInt(item.count)
  })) || []

  const statusData = stats?.statusBreakdown?.map(item => ({
    name: item.status?.replace(/_/g, ' ') || 'Unknown',
    value: parseInt(item.count)
  })) || []

  return (
    <Layout title="Statistics" backLink="/admin" navItems={adminNavItems}>
      {/* Period Selector */}
      <div className="mb-6 flex items-center gap-4">
        <span className="text-sm text-gray-600">Period:</span>
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : stats && (
        <div className="space-y-6">
          {/* Items Over Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Items Received Over Time</h2>
            {itemsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={itemsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="#93C5FD" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No data for this period</p>
            )}
          </div>

          {/* Client Comparison and Condition Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client Comparison */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Items by Client</h2>
              {clientData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={clientData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="items" fill="#3B82F6" name="Items" />
                    <Bar dataKey="quantity" fill="#10B981" name="Quantity" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">No client data</p>
              )}
            </div>

            {/* Condition Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Condition Breakdown</h2>
              {conditionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={conditionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {conditionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">No condition data</p>
              )}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Status Breakdown</h2>
            {statusData.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statusData.map((item, index) => (
                  <div key={item.name} className="p-4 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-gray-600 capitalize">{item.name}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{item.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No status data</p>
            )}
          </div>

          {/* Top Products */}
          {stats.topProducts && stats.topProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Top Products</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">UPC</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stats.topProducts.map((product, index) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-medium">
                              {index + 1}
                            </span>
                            <span className="text-sm text-gray-900 truncate max-w-xs">{product.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">{product.upc || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {parseInt(product.item_count).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {parseInt(product.total_quantity).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity Summary */}
          {stats.activitySummary && stats.activitySummary.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Activity Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {stats.activitySummary.map((activity, index) => (
                  <div key={activity.action} className="p-3 rounded-lg bg-gray-50 text-center">
                    <p className="text-xs text-gray-500 mb-1 capitalize">{activity.action?.replace(/_/g, ' ')}</p>
                    <p className="text-xl font-bold text-gray-900">{parseInt(activity.count).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
