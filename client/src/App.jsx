import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import EmployeeScan from './pages/employee/Scan'
import EmployeeSort from './pages/employee/Sort'
import EmployeeReturns from './pages/employee/Returns'
import ClientDashboard from './pages/client/Dashboard'
import ClientInventory from './pages/client/Inventory'
import ClientItemDetail from './pages/client/ItemDetail'
import ClientProducts from './pages/client/Products'
import ClientProductDetail from './pages/client/ProductDetail'

// Manager Pages (warehouse operations)
import ManagerDashboard from './pages/manager/Dashboard'
import ManagerImport from './pages/manager/Import'
import ManagerLocations from './pages/manager/Locations'
import ManagerProducts from './pages/manager/Products'
import ManagerProductDetail from './pages/manager/ProductDetail'
import ManagerProductNew from './pages/manager/ProductNew'
import ManagerUsers from './pages/manager/Users'
import ManagerReturns from './pages/manager/Returns'
import ManagerReturnDetail from './pages/manager/ReturnDetail'
import ManagerReturnImport from './pages/manager/ReturnImport'
import ManagerUnmatchedReturns from './pages/manager/UnmatchedReturns'

// System Admin Pages (developer only)
import AdminDashboard from './pages/admin/Dashboard'
import AdminSystem from './pages/admin/System'
import AdminStatistics from './pages/admin/Statistics'
import AdminSchema from './pages/admin/Schema'
import AdminDbBrowser from './pages/admin/DbBrowser'
import AdminDbBrowserTable from './pages/admin/DbBrowserTable'
import AdminDbBrowserRecord from './pages/admin/DbBrowserRecord'
import AdminNavigation from './pages/admin/Navigation'
import AdminApiDocs from './pages/admin/ApiDocs'

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
            <ProtectedRoute allowedRoles={['manager', 'admin', 'employee']}>
              <EmployeeScan />
            </ProtectedRoute>
          } />
          <Route path="/employee/sort" element={
            <ProtectedRoute allowedRoles={['manager', 'admin', 'employee']}>
              <EmployeeSort />
            </ProtectedRoute>
          } />
          <Route path="/employee/returns" element={
            <ProtectedRoute allowedRoles={['manager', 'admin', 'employee']}>
              <EmployeeReturns />
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

          {/* Manager Routes (warehouse operations - manager and admin) */}
          <Route path="/manager" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/manager/import" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerImport />
            </ProtectedRoute>
          } />
          <Route path="/manager/locations" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerLocations />
            </ProtectedRoute>
          } />
          <Route path="/manager/products" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerProducts />
            </ProtectedRoute>
          } />
          <Route path="/manager/products/new" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerProductNew />
            </ProtectedRoute>
          } />
          <Route path="/manager/products/:id" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerProductDetail />
            </ProtectedRoute>
          } />
          <Route path="/manager/users" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerUsers />
            </ProtectedRoute>
          } />
          <Route path="/manager/returns" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerReturns />
            </ProtectedRoute>
          } />
          <Route path="/manager/returns/import" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerReturnImport />
            </ProtectedRoute>
          } />
          <Route path="/manager/returns/unmatched" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerUnmatchedReturns />
            </ProtectedRoute>
          } />
          <Route path="/manager/returns/:id" element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerReturnDetail />
            </ProtectedRoute>
          } />

          {/* System Admin Routes (admin only - developer tools) */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/system" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSystem />
            </ProtectedRoute>
          } />
          <Route path="/admin/statistics" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminStatistics />
            </ProtectedRoute>
          } />
          <Route path="/admin/schema" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSchema />
            </ProtectedRoute>
          } />
          <Route path="/admin/db-browser" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDbBrowser />
            </ProtectedRoute>
          } />
          <Route path="/admin/db-browser/:table" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDbBrowserTable />
            </ProtectedRoute>
          } />
          <Route path="/admin/db-browser/:table/:id" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDbBrowserRecord />
            </ProtectedRoute>
          } />
          <Route path="/admin/navigation" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminNavigation />
            </ProtectedRoute>
          } />
          <Route path="/admin/api-docs" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminApiDocs />
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
