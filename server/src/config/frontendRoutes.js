/**
 * Frontend Route Configuration (Server-side copy)
 *
 * This mirrors the client-side route config for use by the admin API.
 * When routes change in the client, this file should be updated too.
 *
 * Note: In a production setup, you might:
 * - Generate this from the client config at build time
 * - Use a shared JSON file
 * - Have the client send its config to the server at startup
 */

const frontendRouteConfig = [
  {
    section: 'Public',
    roles: null,
    routes: [
      {
        path: '/',
        component: 'Home',
        description: 'Home page'
      },
      {
        path: '/login',
        component: 'Login',
        description: 'Login page'
      }
    ]
  },
  {
    section: 'Employee',
    roles: ['employee', 'manager', 'admin'],
    routes: [
      {
        path: '/employee/scan',
        component: 'EmployeeScan',
        description: 'Scan products'
      },
      {
        path: '/employee/sort',
        component: 'EmployeeSort',
        description: 'Sort inventory'
      },
      {
        path: '/employee/returns',
        component: 'EmployeeReturns',
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
        component: 'ClientDashboard',
        description: 'Client dashboard'
      },
      {
        path: '/client/:clientCode/inventory',
        component: 'ClientInventory',
        description: 'View inventory'
      },
      {
        path: '/client/:clientCode/inventory/:itemId',
        component: 'ClientItemDetail',
        description: 'Item details'
      },
      {
        path: '/client/:clientCode/products',
        component: 'ClientProducts',
        description: 'Product catalog'
      },
      {
        path: '/client/:clientCode/products/:productId',
        component: 'ClientProductDetail',
        description: 'Product details'
      }
    ]
  },
  {
    section: 'Manager',
    roles: ['manager', 'admin'],
    routes: [
      {
        path: '/manager',
        component: 'ManagerDashboard',
        description: 'Manager dashboard'
      },
      {
        path: '/manager/import',
        component: 'ManagerImport',
        description: 'Import products'
      },
      {
        path: '/manager/locations',
        component: 'ManagerLocations',
        description: 'Manage locations'
      },
      {
        path: '/manager/products',
        component: 'ManagerProducts',
        description: 'View all products'
      },
      {
        path: '/manager/products/new',
        component: 'ManagerProductNew',
        description: 'Create product'
      },
      {
        path: '/manager/products/:id',
        component: 'ManagerProductDetail',
        description: 'Product details'
      },
      {
        path: '/manager/users',
        component: 'ManagerUsers',
        description: 'User management'
      },
      {
        path: '/manager/returns',
        component: 'ManagerReturns',
        description: 'Returns management'
      },
      {
        path: '/manager/returns/import',
        component: 'ManagerReturnImport',
        description: 'Import returns'
      },
      {
        path: '/manager/returns/unmatched',
        component: 'ManagerUnmatchedReturns',
        description: 'Unmatched returns'
      },
      {
        path: '/manager/returns/:id',
        component: 'ManagerReturnDetail',
        description: 'Return details'
      },
      {
        path: '/manager/inventory/:id',
        component: 'ManagerInventoryDetail',
        description: 'Inventory item details',
        roles: ['employee', 'manager', 'admin']
      }
    ]
  },
  {
    section: 'System Admin',
    roles: ['admin'],
    routes: [
      {
        path: '/admin',
        component: 'AdminDashboard',
        description: 'Admin dashboard'
      },
      {
        path: '/admin/system',
        component: 'AdminSystem',
        description: 'System status'
      },
      {
        path: '/admin/statistics',
        component: 'AdminStatistics',
        description: 'Analytics'
      },
      {
        path: '/admin/schema',
        component: 'AdminSchema',
        description: 'Database schema'
      },
      {
        path: '/admin/db-browser',
        component: 'AdminDbBrowser',
        description: 'Database browser'
      },
      {
        path: '/admin/db-browser/:table',
        component: 'AdminDbBrowserTable',
        description: 'Browse table'
      },
      {
        path: '/admin/db-browser/:table/:id',
        component: 'AdminDbBrowserRecord',
        description: 'View record'
      },
      {
        path: '/admin/navigation',
        component: 'AdminNavigation',
        description: 'Routes & API Docs'
      }
    ]
  }
];

/**
 * Get route configuration formatted for the navigation API
 */
function getNavigationFormat() {
  return frontendRouteConfig.map(section => ({
    section: section.section,
    roles: section.roles,
    routes: section.routes.map(route => ({
      path: route.path,
      method: 'GET',
      description: route.description,
      roles: route.roles || section.roles
    }))
  }));
}

module.exports = {
  frontendRouteConfig,
  getNavigationFormat
};
