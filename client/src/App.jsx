import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import EmployeeScan from './pages/employee/Scan'
import EmployeeSort from './pages/employee/Sort'
import ClientDashboard from './pages/client/Dashboard'
import ClientInventory from './pages/client/Inventory'
import ClientItemDetail from './pages/client/ItemDetail'
import ClientProducts from './pages/client/Products'
import ClientProductDetail from './pages/client/ProductDetail'
import AdminDashboard from './pages/admin/Dashboard'
import AdminImport from './pages/admin/Import'
import AdminLocations from './pages/admin/Locations'
import AdminProducts from './pages/admin/Products'
import AdminProductDetail from './pages/admin/ProductDetail'
import AdminProductNew from './pages/admin/ProductNew'
import AdminUsers from './pages/admin/Users'

// Components
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Home/Landing */}
          <Route path="/" element={<Home />} />

          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />

          {/* Employee Routes */}
          <Route path="/employee/scan" element={
            <ProtectedRoute allowedRoles={['admin', 'employee']}>
              <EmployeeScan />
            </ProtectedRoute>
          } />
          <Route path="/employee/sort" element={
            <ProtectedRoute allowedRoles={['admin', 'employee']}>
              <EmployeeSort />
            </ProtectedRoute>
          } />

          {/* Client Routes (with client code) */}
          <Route path="/client/:clientCode" element={
            <ProtectedRoute allowedRoles={['admin', 'client']}>
              <ClientDashboard />
            </ProtectedRoute>
          } />
          <Route path="/client/:clientCode/inventory" element={
            <ProtectedRoute allowedRoles={['admin', 'client']}>
              <ClientInventory />
            </ProtectedRoute>
          } />
          <Route path="/client/:clientCode/inventory/:itemId" element={
            <ProtectedRoute allowedRoles={['admin', 'client']}>
              <ClientItemDetail />
            </ProtectedRoute>
          } />
          <Route path="/client/:clientCode/products" element={
            <ProtectedRoute allowedRoles={['admin', 'client']}>
              <ClientProducts />
            </ProtectedRoute>
          } />
          <Route path="/client/:clientCode/products/:productId" element={
            <ProtectedRoute allowedRoles={['admin', 'client']}>
              <ClientProductDetail />
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/import" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminImport />
            </ProtectedRoute>
          } />
          <Route path="/admin/locations" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLocations />
            </ProtectedRoute>
          } />
          <Route path="/admin/products" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminProducts />
            </ProtectedRoute>
          } />
          <Route path="/admin/products/new" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminProductNew />
            </ProtectedRoute>
          } />
          <Route path="/admin/products/:id" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminProductDetail />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
