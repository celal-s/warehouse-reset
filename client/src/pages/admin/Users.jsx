import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { getUsers, createUser, updateUser, resetUserPassword, deleteUser, getClients } from '../../api'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/import', label: 'Import' },
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/users', label: 'Users' }
]

export default function AdminUsers() {
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

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-800',
      employee: 'bg-blue-100 text-blue-800',
      client: 'bg-green-100 text-green-800'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[role] || 'bg-gray-100 text-gray-800'}`}>
        {role}
      </span>
    )
  }

  const getStatusBadge = (isActive) => {
    return isActive ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Inactive
      </span>
    )
  }

  return (
    <Layout title="User Management" backLink="/admin" navItems={adminNavItems}>
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
          <button onClick={() => setError(null)} className="float-right text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Header with create button */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">All Users</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showCreateForm ? 'Cancel' : 'Create User'}
        </button>
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
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {createLoading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">No users found</h3>
          <p className="mt-1 text-gray-500">Create your first user above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.client_code ? `${user.client_code} - ${user.client_name}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(user.is_active)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingUser(user)
                          setEditForm({
                            name: user.name,
                            role: user.role,
                            client_code: user.client_code || ''
                          })
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setResetPasswordUser(user)}
                        className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`text-sm font-medium ${user.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
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
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordUser(null)
                    setNewPassword('')
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400"
                >
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
