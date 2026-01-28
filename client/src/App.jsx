import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Pages
import Home from './pages/Home'
import EmployeeScan from './pages/employee/Scan'
import EmployeeSort from './pages/employee/Sort'
import ClientDashboard from './pages/client/Dashboard'
import ClientInventory from './pages/client/Inventory'
import ClientItemDetail from './pages/client/ItemDetail'
import AdminDashboard from './pages/admin/Dashboard'
import AdminImport from './pages/admin/Import'
import AdminLocations from './pages/admin/Locations'
import AdminProducts from './pages/admin/Products'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home/Landing */}
        <Route path="/" element={<Home />} />

        {/* Employee Routes */}
        <Route path="/employee/scan" element={<EmployeeScan />} />
        <Route path="/employee/sort" element={<EmployeeSort />} />

        {/* Client Routes (with client code) */}
        <Route path="/client/:clientCode" element={<ClientDashboard />} />
        <Route path="/client/:clientCode/inventory" element={<ClientInventory />} />
        <Route path="/client/:clientCode/inventory/:itemId" element={<ClientItemDetail />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/import" element={<AdminImport />} />
        <Route path="/admin/locations" element={<AdminLocations />} />
        <Route path="/admin/products" element={<AdminProducts />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
