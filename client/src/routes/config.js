/**
 * Frontend Route Configuration
 * Single source of truth for all client-side routes
 *
 * This config is used by:
 * - App.jsx to generate Route components
 * - Admin Navigation page to display frontend routes
 */

// Page component imports (lazy-loaded for code splitting if needed)
import Home from '../pages/Home'
import Login from '../pages/Login'
import EmployeeDashboard from '../pages/employee/Dashboard'
import EmployeeReceiving from '../pages/employee/Receiving'
import EmployeeReturns from '../pages/employee/Returns'
import EmployeeOrderReceiving from '../pages/employee/OrderReceiving'
import ClientDashboard from '../pages/client/Dashboard'
import ClientInventory from '../pages/client/Inventory'
import ClientItemDetail from '../pages/client/ItemDetail'
import ClientProducts from '../pages/client/Products'
import ClientProductDetail from '../pages/client/ProductDetail'
import ManagerDashboard from '../pages/manager/Dashboard'
import ManagerReceiving from '../pages/manager/Receiving'
import ManagerOrders from '../pages/manager/Orders'
import ManagerClients from '../pages/manager/Clients'
import ManagerImport from '../pages/manager/Import'
import ManagerLocations from '../pages/manager/Locations'
import ManagerProducts from '../pages/manager/Products'
import ManagerProductDetail from '../pages/manager/ProductDetail'
import ManagerProductNew from '../pages/manager/ProductNew'
import ManagerUsers from '../pages/manager/Users'
import ManagerReturns from '../pages/manager/Returns'
import ManagerReturnDetail from '../pages/manager/ReturnDetail'
import ManagerReturnImport from '../pages/manager/ReturnImport'
import ManagerUnmatchedReturns from '../pages/manager/UnmatchedReturns'
import ManagerInventoryDetail from '../pages/manager/InventoryDetail'
import AdminDashboard from '../pages/admin/Dashboard'
import AdminSystem from '../pages/admin/System'
import AdminStatistics from '../pages/admin/Statistics'
import AdminSchema from '../pages/admin/Schema'
import AdminDbBrowser from '../pages/admin/DbBrowser'
import AdminDbBrowserTable from '../pages/admin/DbBrowserTable'
import AdminDbBrowserRecord from '../pages/admin/DbBrowserRecord'
import AdminNavigation from '../pages/admin/Navigation'
import WarehouseOrders from '../pages/client/orders/WarehouseOrders'
import WarehouseOrderDetail from '../pages/client/orders/WarehouseOrderDetail'
import WarehouseOrderNew from '../pages/client/orders/WarehouseOrderNew'

/**
 * Route configuration organized by section
 * Each section can have:
 * - section: Display name for the section
 * - roles: Array of roles that can access these routes (null for public)
 * - routes: Array of route definitions
 *
 * Each route can have:
 * - path: The URL path (React Router format)
 * - component: The component to render
 * - description: Human-readable description
 * - roles: Override section-level roles for this specific route (optional)
 */
export const routeConfig = [
  {
    section: 'Public',
    roles: null,
    routes: [
      {
        path: '/',
        component: Home,
        description: 'Home page'
      },
      {
        path: '/login',
        component: Login,
        description: 'Login page'
      }
    ]
  },
  {
    section: 'Employee',
    roles: ['employee', 'manager', 'admin'],
    routes: [
      {
        path: '/employee',
        component: EmployeeDashboard,
        description: 'Employee dashboard'
      },
      {
        path: '/employee/receiving',
        component: EmployeeReceiving,
        description: 'Receive inventory'
      },
      {
        path: '/employee/orders',
        component: EmployeeOrderReceiving,
        description: 'Order receiving'
      },
      {
        path: '/employee/returns',
        component: EmployeeReturns,
        description: 'Process returns'
      }
    ]
  },
  {
    section: 'Client',
    roles: ['client', 'manager', 'admin'],
    routes: [
      {
        path: '/client/:clientCode',
        component: ClientDashboard,
        description: 'Client dashboard'
      },
      {
        path: '/client/:clientCode/inventory',
        component: ClientInventory,
        description: 'View inventory'
      },
      {
        path: '/client/:clientCode/inventory/:itemId',
        component: ClientItemDetail,
        description: 'Item details'
      },
      {
        path: '/client/:clientCode/products',
        component: ClientProducts,
        description: 'Product catalog'
      },
      {
        path: '/client/:clientCode/products/:productId',
        component: ClientProductDetail,
        description: 'Product details'
      },
      {
        path: '/client/:clientCode/orders',
        component: WarehouseOrders,
        description: 'Warehouse orders'
      },
      {
        path: '/client/:clientCode/orders/new',
        component: WarehouseOrderNew,
        description: 'Create warehouse order'
      },
      {
        path: '/client/:clientCode/orders/:orderId',
        component: WarehouseOrderDetail,
        description: 'Order details'
      }
    ]
  },
  {
    section: 'Manager',
    roles: ['manager', 'admin'],
    routes: [
      {
        path: '/manager',
        component: ManagerDashboard,
        description: 'Manager dashboard'
      },
      {
        path: '/manager/receiving',
        component: ManagerReceiving,
        description: 'Receiving history'
      },
      {
        path: '/manager/orders',
        component: ManagerOrders,
        description: 'All warehouse orders'
      },
      {
        path: '/manager/import',
        component: ManagerImport,
        description: 'Import products'
      },
      {
        path: '/manager/locations',
        component: ManagerLocations,
        description: 'Manage locations'
      },
      {
        path: '/manager/products',
        component: ManagerProducts,
        description: 'View all products'
      },
      {
        path: '/manager/products/new',
        component: ManagerProductNew,
        description: 'Create product'
      },
      {
        path: '/manager/products/:id',
        component: ManagerProductDetail,
        description: 'Product details'
      },
      {
        path: '/manager/users',
        component: ManagerUsers,
        description: 'User management'
      },
      {
        path: '/manager/returns',
        component: ManagerReturns,
        description: 'Returns management'
      },
      {
        path: '/manager/returns/import',
        component: ManagerReturnImport,
        description: 'Import returns'
      },
      {
        path: '/manager/returns/unmatched',
        component: ManagerUnmatchedReturns,
        description: 'Unmatched returns'
      },
      {
        path: '/manager/returns/:id',
        component: ManagerReturnDetail,
        description: 'Return details'
      },
      {
        path: '/manager/inventory/:id',
        component: ManagerInventoryDetail,
        description: 'Inventory item details',
        roles: ['employee', 'manager', 'admin']
      },
      {
        path: '/manager/clients',
        component: ManagerClients,
        description: 'Client management'
      }
    ]
  },
  {
    section: 'System Admin',
    roles: ['admin'],
    routes: [
      {
        path: '/admin',
        component: AdminDashboard,
        description: 'Admin dashboard'
      },
      {
        path: '/admin/system',
        component: AdminSystem,
        description: 'System status'
      },
      {
        path: '/admin/statistics',
        component: AdminStatistics,
        description: 'Analytics'
      },
      {
        path: '/admin/schema',
        component: AdminSchema,
        description: 'Database schema'
      },
      {
        path: '/admin/db-browser',
        component: AdminDbBrowser,
        description: 'Database browser'
      },
      {
        path: '/admin/db-browser/:table',
        component: AdminDbBrowserTable,
        description: 'Browse table'
      },
      {
        path: '/admin/db-browser/:table/:id',
        component: AdminDbBrowserRecord,
        description: 'View record'
      },
      {
        path: '/admin/navigation',
        component: AdminNavigation,
        description: 'Routes & API Docs'
      }
    ]
  }
]

/**
 * Get a flat list of all routes with their full configuration
 * Useful for generating Route components
 */
export function getFlatRoutes() {
  const routes = []
  for (const section of routeConfig) {
    for (const route of section.routes) {
      routes.push({
        ...route,
        section: section.section,
        roles: route.roles || section.roles
      })
    }
  }
  return routes
}

/**
 * Get route configuration formatted for the navigation API
 * This matches the format expected by the Navigation admin page
 */
export function getNavigationFormat() {
  return routeConfig.map(section => ({
    section: section.section,
    roles: section.roles,
    routes: section.routes.map(route => ({
      path: route.path,
      method: 'GET',
      description: route.description,
      roles: route.roles || section.roles
    }))
  }))
}

export default routeConfig
