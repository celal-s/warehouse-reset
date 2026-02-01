import { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/Layout'
import { DataTable } from '../../components/DataTable'
import { Button, Alert, StatusBadge } from '../../components/ui'
import { getUsers, createUser, updateUser, resetUserPassword, deleteUser, getClients } from '../../api'
import { managerNavItems } from '../../config/managerNav'

export default function ManagerUsers() {
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'employee',
    client_code: ''
  })
  const [createLoading, setCreateLoading] = useState(false)

  // Edit modal
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editLoading, setEditLoading] = useState(false)

  // Reset password modal
  const [resetPasswordUser, setResetPasswordUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersData, clientsData] = await Promise.all([getUsers(), getClients()])
      setUsers(usersData)
      setClients(clientsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const showSuccessMessage = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setError(null)

    try {
      const data = { ...createForm }
      if (data.role !== 'client') {
        delete data.client_code
      }
      await createUser(data)
      showSuccessMessage('User created successfully')
      setShowCreateForm(false)
      setCreateForm({ email: '', password: '', name: '', role: 'employee', client_code: '' })
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setError(null)

    try {
      await updateUser(editingUser.id, editForm)
      showSuccessMessage('User updated successfully')
      setEditingUser(null)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setEditLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setResetLoading(true)
    setError(null)

    try {
      await resetUserPassword(resetPasswordUser.id, newPassword)
      showSuccessMessage('Password reset successfully')
      setResetPasswordUser(null)
      setNewPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setResetLoading(false)
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { is_active: !user.is_active })
      showSuccessMessage(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteUser = async (user) => {
    if (!confirm(`Are you sure you want to deactivate ${user.name}?`)) return

    try {
      await deleteUser(user.id)
      showSuccessMessage('User deactivated successfully')
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  // Column definitions for DataTable
  const columns = useMemo(() => [
    {
      id: 'user',
      header: 'User',
      accessorKey: 'name',
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900">{row.original.name}</div>
          <div className="text-sm text-gray-500">{row.original.email}</div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      accessorKey: 'role',
      enableSorting: false,
      cell: ({ row }) => <StatusBadge status={row.original.role} />,
    },
    {
      id: 'client',
      header: 'Client',
      accessorKey: 'client_code',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-gray-500">
          {row.original.client_code ? `${row.original.client_code} - ${row.original.client_name}` : '-'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'is_active',
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge status={row.original.is_active ? 'active' : 'inactive'} />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex gap-2">
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setEditingUser(user)
                setEditForm({
                  name: user.name,
                  role: user.role,
                  client_code: user.client_code || ''
                })
              }}
            >
              Edit
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-yellow-600 hover:text-yellow-800"
              onClick={() => setResetPasswordUser(user)}
            >
              Reset PW
            </Button>
            <Button
              variant="link"
              size="sm"
              className={user.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}
              onClick={() => handleToggleActive(user)}
            >
              {user.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        )
      },
    },
  ], [])

  return (
    <Layout title="User Management" navItems={managerNavItems}>
      {/* Success message */}
      {success && (
        <Alert variant="success" className="mb-6" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header with create button */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">All Users</h2>
        <Button
          variant={showCreateForm ? 'secondary' : 'primary'}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : 'Create User'}
        </Button>
      </div>

      {/* Create user form */}
      {showCreateForm && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="employee">Employee</option>
                  <option value="client">Client</option>
                </select>
              </div>
              {createForm.role === 'client' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Code *</label>
                  <select
                    value={createForm.client_code}
                    onChange={(e) => setCreateForm({ ...createForm, client_code: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.client_code}>
                        {client.client_code} - {client.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createLoading}
              >
                Create User
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Users DataTable */}
      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyState={{
          title: 'No users found',
          description: 'Create your first user above.'
        }}
        getRowId={(row) => row.id}
      />

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit User</h3>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="employee">Employee</option>
                  <option value="client">Client</option>
                </select>
              </div>
              {editForm.role === 'client' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Code</label>
                  <select
                    value={editForm.client_code}
                    onChange={(e) => setEditForm({ ...editForm, client_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.client_code}>
                        {client.client_code} - {client.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={editLoading}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Reset Password for {resetPasswordUser.name}
            </h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResetPasswordUser(null)
                    setNewPassword('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="warning"
                  loading={resetLoading}
                >
                  Reset Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
