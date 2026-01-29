/**
 * Express Route Introspector
 * Extracts all registered routes from an Express app at runtime
 */

/**
 * Extract roles from an authorize middleware function
 * The authorize middleware is created by: authorize('role1', 'role2', ...)
 * We can extract roles by examining the function's toString() or by storing metadata
 */
function extractRolesFromMiddleware(middleware) {
  if (!middleware) return null;

  const fnStr = middleware.toString();

  // Check if this is our authorize middleware (it checks req.user.role against roles array)
  if (fnStr.includes('roles.includes') || fnStr.includes('Insufficient permissions')) {
    // The authorize function closes over the roles array
    // We can try to extract it from the function string or check for a roles property
    if (middleware._roles) {
      return middleware._roles;
    }

    // Try to parse roles from the function body if they're visible
    // This won't work with the current implementation since roles are in closure
    // We'll need to enhance the authorize middleware to expose roles
  }

  return null;
}

/**
 * Get a descriptive name for a middleware function
 */
function getMiddlewareName(middleware) {
  if (!middleware) return 'anonymous';

  // Named function
  if (middleware.name) return middleware.name;

  const fnStr = middleware.toString();

  // Detect common middleware patterns
  if (fnStr.includes('Authorization header') || fnStr.includes('verifyToken')) {
    return 'authenticate';
  }
  if (fnStr.includes('roles.includes') || fnStr.includes('Insufficient permissions')) {
    return 'authorize';
  }

  return 'anonymous';
}

/**
 * Extract route information from a layer
 */
function extractRouteInfo(layer, basePath = '') {
  const routes = [];

  if (layer.route) {
    // This is a route layer
    const path = basePath + layer.route.path;
    const methods = Object.keys(layer.route.methods)
      .filter(m => layer.route.methods[m])
      .map(m => m.toUpperCase());

    // Extract middleware info from the route stack
    const middleware = [];
    let roles = null;

    for (const handler of layer.route.stack) {
      const name = getMiddlewareName(handler.handle);
      middleware.push(name);

      // Check for roles in authorize middleware
      if (name === 'authorize' && handler.handle._roles) {
        roles = handler.handle._roles;
      }
    }

    routes.push({
      path,
      methods,
      middleware,
      roles
    });
  } else if (layer.name === 'router' && layer.handle.stack) {
    // This is a router middleware
    const routerBasePath = basePath + (layer.regexp.source === '^\\/?$' ? '' :
      layer.regexp.source
        .replace('\\/?', '')
        .replace('(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\^/g, '')
        .replace(/\$/g, '')
        .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param'));

    for (const routerLayer of layer.handle.stack) {
      routes.push(...extractRouteInfo(routerLayer, routerBasePath));
    }
  }

  return routes;
}

/**
 * Parse the mount path from a router's regexp
 */
function parseMountPath(regexp) {
  if (!regexp) return '';

  const source = regexp.source;

  // Handle root path
  if (source === '^\\/?$' || source === '^\\/?(?=\\/|$)') {
    return '';
  }

  // Extract the path from the regexp
  let path = source
    .replace(/^\^/, '')
    .replace(/\\\/\?(?:\(\?=\\\/\|\$\))?$/, '')
    .replace(/\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/')
    .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param');

  return path;
}

/**
 * Extract all routes from an Express application
 * @param {Express} app - The Express application instance
 * @returns {Object} Routes organized by mount path
 */
function extractRoutes(app) {
  if (!app || !app._router || !app._router.stack) {
    return { routes: [], byPrefix: {} };
  }

  const allRoutes = [];

  for (const layer of app._router.stack) {
    if (layer.route) {
      // Direct route on app
      const routes = extractRouteInfo(layer, '');
      allRoutes.push(...routes);
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      // Mounted router
      const mountPath = parseMountPath(layer.regexp);

      for (const routerLayer of layer.handle.stack) {
        const routes = extractRouteInfo(routerLayer, mountPath);
        allRoutes.push(...routes);
      }
    }
  }

  // Group routes by prefix
  const byPrefix = {};
  for (const route of allRoutes) {
    // Extract prefix (first two path segments or first segment for short paths)
    const segments = route.path.split('/').filter(Boolean);
    let prefix = '/';
    if (segments.length >= 2) {
      prefix = '/' + segments.slice(0, 2).join('/');
    } else if (segments.length === 1) {
      prefix = '/' + segments[0];
    }

    if (!byPrefix[prefix]) {
      byPrefix[prefix] = [];
    }
    byPrefix[prefix].push(route);
  }

  return {
    routes: allRoutes,
    byPrefix
  };
}

/**
 * Format routes for the Navigation API response
 * @param {Object} extractedRoutes - Output from extractRoutes()
 * @returns {Array} Formatted route sections for API response
 */
function formatForNavigation(extractedRoutes) {
  const sections = [];
  const prefixNames = {
    '/api/auth': 'Auth',
    '/api/products': 'Products',
    '/api/inventory': 'Inventory',
    '/api/clients': 'Clients',
    '/api/manager': 'Manager',
    '/api/admin': 'System Admin',
    '/api/upload': 'Upload',
    '/api/returns': 'Returns',
    '/api/health': 'Health'
  };

  // Sort prefixes for consistent ordering
  const sortedPrefixes = Object.keys(extractedRoutes.byPrefix).sort();

  for (const prefix of sortedPrefixes) {
    const routes = extractedRoutes.byPrefix[prefix];
    const sectionName = prefixNames[prefix] || prefix.replace('/api/', '').replace(/^\w/, c => c.toUpperCase());

    const formattedRoutes = routes.map(route => ({
      path: route.path,
      method: route.methods.join(', '),
      methods: route.methods,
      roles: route.roles,
      middleware: route.middleware.filter(m => m !== 'anonymous'),
      description: generateDescription(route)
    }));

    // Sort routes: first by path, then by method
    formattedRoutes.sort((a, b) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      return a.method.localeCompare(b.method);
    });

    sections.push({
      section: sectionName,
      prefix,
      routes: formattedRoutes
    });
  }

  return sections;
}

/**
 * Generate a description for a route based on its path and method
 */
function generateDescription(route) {
  const method = route.methods[0];
  const path = route.path;

  // Extract the resource name from path
  const segments = path.split('/').filter(Boolean);
  const resource = segments.find(s => !s.startsWith(':') && s !== 'api') || 'resource';
  const hasParam = path.includes(':');
  const paramName = segments.find(s => s.startsWith(':'))?.replace(':', '') || 'id';

  // Generate description based on common REST patterns
  const descriptions = {
    GET: hasParam ? `Get ${resource} by ${paramName}` : `List ${resource}`,
    POST: `Create ${resource}`,
    PUT: `Update ${resource}`,
    PATCH: `Partial update ${resource}`,
    DELETE: `Delete ${resource}`
  };

  return descriptions[method] || `${method} ${resource}`;
}

/**
 * Format routes for the API Docs response
 * @param {Object} extractedRoutes - Output from extractRoutes()
 * @returns {Object} Formatted endpoints for API docs
 */
function formatForApiDocs(extractedRoutes) {
  const endpoints = {};

  const prefixNames = {
    '/api/auth': 'auth',
    '/api/products': 'products',
    '/api/inventory': 'inventory',
    '/api/clients': 'clients',
    '/api/manager': 'manager',
    '/api/admin': 'admin',
    '/api/upload': 'upload',
    '/api/returns': 'returns'
  };

  for (const [prefix, routes] of Object.entries(extractedRoutes.byPrefix)) {
    const sectionKey = prefixNames[prefix] || prefix.replace('/api/', '');
    if (!sectionKey || sectionKey === 'health') continue;

    endpoints[sectionKey] = {};

    for (const route of routes) {
      for (const method of route.methods) {
        // Use path relative to /api for cleaner display
        const displayPath = route.path.replace('/api', '');
        const key = `${method} ${displayPath}`;

        endpoints[sectionKey][key] = {
          description: generateDescription({ ...route, methods: [method] }),
          auth: formatAuth(route)
        };
      }
    }
  }

  return endpoints;
}

/**
 * Format authentication/authorization info for display
 */
function formatAuth(route) {
  if (!route.middleware || route.middleware.length === 0) {
    return 'None (public)';
  }

  if (route.middleware.includes('authenticate') && route.roles) {
    return route.roles.join(', ');
  }

  if (route.middleware.includes('authenticate')) {
    return 'Any authenticated user';
  }

  return 'None (public)';
}

module.exports = {
  extractRoutes,
  formatForNavigation,
  formatForApiDocs,
  extractRolesFromMiddleware,
  getMiddlewareName
};
