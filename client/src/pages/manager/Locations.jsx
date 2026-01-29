import { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/Layout'
import { DataTable } from '../../components/DataTable'
import { Button, Alert, StatusBadge, Badge } from '../../components/ui'
import { getLocations, createLocation, deleteLocation } from '../../api'

const managerNavItems = [
  { to: '/manager', label: 'Dashboard' },
  { to: '/manager/import', label: 'Import' },
  { to: '/manager/locations', label: 'Locations' },
  { to: '/manager/products', label: 'Products' },
  { to: '/manager/users', label: 'Users' },
  { to: '/manager/returns', label: 'Returns' }
]

export default function ManagerLocations() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Form state
  const [newType, setNewType] = useState('pallet')
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    try {
      const data = await getLocations()
      setLocations(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()

    if (!newLabel.trim()) {
      setError('Please enter a label')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const created = await createLocation({ type: newType, label: newLabel.trim() })
      setLocations([...locations, created])
      setNewLabel('')
      setSuccess('Location created successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    // TODO: Replace confirm() with a custom modal component for better UX
    if (!confirm('Are you sure you want to delete this location?')) {
      return
    }

    setError(null)

    try {
      await deleteLocation(id)
      setLocations(locations.filter(loc => loc.id !== id))
      setSuccess('Location deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  // Define columns for DataTable
  const columns = useMemo(() => [
    {
      accessorKey: 'type',
      header: 'Type',
      enableSorting: false,
      cell: ({ row }) => <StatusBadge status={row.original.type} />
    },
    {
      accessorKey: 'label',
      header: 'Label',
      enableSorting: false,
      cell: ({ row }) => <span className="font-medium text-gray-900">{row.original.label}</span>
    },
    {
      accessorKey: 'item_count',
      header: 'Items',
      enableSorting: false,
      cell: ({ row }) => {
        const count = row.original.item_count || 0
        return (
          <Badge variant={count > 0 ? 'green' : 'gray'}>
            {count} items
          </Badge>
        )
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const location = row.original
        const hasItems = (location.item_count || 0) > 0
        return (
          <div className="text-right">
            <Button
              variant={hasItems ? 'secondary' : 'danger'}
              size="sm"
              disabled={hasItems}
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(location.id)
              }}
              title={hasItems ? 'Cannot delete location with items' : 'Delete location'}
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              }
            >
              Delete
            </Button>
          </div>
        )
      }
    }
  ], [])

  return (
    <Layout title="Manage Locations" navItems={managerNavItems}>
      {/* Success Message */}
      {success && (
        <Alert variant="success" className="mb-6" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Add New Location */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Add New Location</h2>

        <form onSubmit={handleCreate} className="flex flex-wrap gap-4">
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pallet">Pallet</option>
              <option value="box">Box</option>
            </select>
          </div>

          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g., P001, BOX-A1"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              loading={creating}
              disabled={!newLabel.trim()}
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Add Location
            </Button>
          </div>
        </form>
      </div>

      {/* Locations List */}
      <div className="mb-6">
        <DataTable
          columns={columns}
          data={locations}
          loading={loading}
          emptyState={{
            icon: (
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            title: 'No locations found',
            description: 'Add your first storage location above'
          }}
          toolbar={
            <h2 className="text-lg font-medium text-gray-900">Storage Locations</h2>
          }
        />
      </div>

      {/* Summary */}
      {!loading && locations.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pallets</p>
                <p className="text-xl font-bold text-gray-900">
                  {locations.filter(l => l.type === 'pallet').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Boxes</p>
                <p className="text-xl font-bold text-gray-900">
                  {locations.filter(l => l.type === 'box').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
