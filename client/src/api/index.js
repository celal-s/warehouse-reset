const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('auth_token');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    },
    ...options
  };

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

// Products
export const searchProducts = (query, clientId = null) =>
  request(`/products/search?q=${encodeURIComponent(query)}${clientId ? `&client_id=${clientId}` : ''}`);

export const scanUPC = (upc) => request(`/products/scan/${encodeURIComponent(upc)}`);

export const getProduct = (id) => request(`/products/${id}`);

export const createProduct = (data) => request('/products', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const addProductPhoto = (productId, photoUrl, photoType = 'main', photoSource = 'warehouse') =>
  request(`/products/${productId}/photos`, {
    method: 'POST',
    body: JSON.stringify({ photo_url: photoUrl, photo_type: photoType, photo_source: photoSource })
  });

export const checkProductHasPhotos = (productId) => request(`/products/${productId}/has-photos`);

export const getProductDetail = (id) => request(`/products/${id}/detail`);

export const getProductInventory = (id) => request(`/products/${id}/inventory`);

export const getProductHistory = (id) => request(`/products/${id}/history`);

export const updateProductObservations = (id, data) =>
  request(`/products/${id}/observations`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });

// Inventory
export const getInventory = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/inventory?${params}`);
};

export const getInventoryItem = (id) => request(`/inventory/${id}`);

export const createInventoryItem = (data) => request('/inventory', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const updateInventoryItem = (id, data) => request(`/inventory/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(data)
});

export const deleteInventoryItem = (id) => request(`/inventory/${id}`, {
  method: 'DELETE'
});

// Inventory receiving and management
export const receiveInventory = (data) => request('/inventory/receive', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const adjustInventory = (id, data) => request(`/inventory/${id}/adjust`, {
  method: 'POST',
  body: JSON.stringify(data)
});

export const moveInventory = (id, data) => request(`/inventory/${id}/move`, {
  method: 'POST',
  body: JSON.stringify(data)
});

export const updateInventoryCondition = (id, data) => request(`/inventory/${id}/condition`, {
  method: 'POST',
  body: JSON.stringify(data)
});

export const getInventoryHistory = (id) => request(`/inventory/${id}/history`);

export const addInventoryPhoto = (id, photoUrl, photoType = 'condition', notes = null) =>
  request(`/inventory/${id}/photos`, {
    method: 'POST',
    body: JSON.stringify({ photo_url: photoUrl, photo_type: photoType, notes })
  });

export const getInventoryPhotos = (id) => request(`/inventory/${id}/photos`);

// Clients
export const getClients = () => request('/clients');

export const getClient = (clientCode) => request(`/clients/${clientCode}`);

export const getClientDashboard = (clientCode) => request(`/clients/${clientCode}/dashboard`);

export const getClientInventory = (clientCode, filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/clients/${clientCode}/inventory?${params}`);
};

export const getClientInventoryItem = (clientCode, itemId) =>
  request(`/clients/${clientCode}/inventory/${itemId}`);

export const makeDecision = (clientCode, itemId, data) =>
  request(`/clients/${clientCode}/inventory/${itemId}/decision`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

// Client products (catalog)
export const getClientProducts = (clientCode) => request(`/clients/${clientCode}/products`);

export const getClientProduct = (clientCode, productId) =>
  request(`/clients/${clientCode}/products/${productId}`);

// Manager (Warehouse operations)
export const getManagerDashboard = () => request('/manager/dashboard');

export const getActivityLog = (limit = 50) => request(`/manager/activity?limit=${limit}`);

export const getLocations = () => request('/manager/locations');

export const createLocation = (data) => request('/manager/locations', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const deleteLocation = (id) => request(`/manager/locations/${id}`, {
  method: 'DELETE'
});

export const importProducts = (file, clientCode, marketplace = 'us') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('client_code', clientCode);
  formData.append('marketplace', marketplace);

  return request('/manager/import', {
    method: 'POST',
    body: formData
  });
};

export const getManagerProducts = (page = 1, limit = 50) =>
  request(`/manager/products?page=${page}&limit=${limit}`);

export const getMarketplaces = () => request('/manager/marketplaces');

// User Management (Manager)
export const getUsers = () => request('/manager/users');

export const getUser = (id) => request(`/manager/users/${id}`);

export const createUser = (data) => request('/manager/users', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const updateUser = (id, data) => request(`/manager/users/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(data)
});

export const resetUserPassword = (id, password) => request(`/manager/users/${id}/reset-password`, {
  method: 'POST',
  body: JSON.stringify({ password })
});

export const deleteUser = (id) => request(`/manager/users/${id}`, {
  method: 'DELETE'
});

// System Admin (developer only)
export const getAdminServerStatus = () => request('/admin/server-status');

export const getAdminStatistics = (period = '7d') => request(`/admin/statistics?period=${period}`);

export const getAdminRoutes = () => request('/admin/routes');

export const getAdminSchema = () => request('/admin/schema');

export const getAdminSchemaTable = (tableName) => request(`/admin/schema/tables/${tableName}`);

export const getAdminDbTables = () => request('/admin/db-browser/tables');

export const getAdminDbTableSchema = (tableName) => request(`/admin/db-browser/tables/${tableName}/schema`);

export const getAdminDbTableData = (tableName, params = {}) => {
  const queryParams = new URLSearchParams(params);
  return request(`/admin/db-browser/tables/${tableName}/data?${queryParams}`);
};

export const getAdminDbRecord = (tableName, id) => request(`/admin/db-browser/tables/${tableName}/records/${id}`);

// Upload
export const getPhotoSignature = (productId) => request('/upload/signature/photo', {
  method: 'POST',
  body: JSON.stringify({ product_id: productId })
});

export const getLabelSignature = (inventoryItemId) => request('/upload/signature/label', {
  method: 'POST',
  body: JSON.stringify({ inventory_item_id: inventoryItemId })
});

export const getUploadConfig = () => request('/upload/config');

// Auth
export const login = (email, password) => request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});

export const signup = (data) => request('/auth/signup', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const getMe = () => request('/auth/me');

// Returns
export const getReturns = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/returns?${params}`);
};

export const getReturn = (id) => request(`/returns/${id}`);

export const getPendingReturns = () => request('/returns/pending');

export const getUnmatchedReturns = () => request('/returns/unmatched');

export const createReturn = (data) => request('/returns', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const updateReturn = (id, data) => request(`/returns/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(data)
});

export const shipReturn = (id, data) => request(`/returns/${id}/ship`, {
  method: 'POST',
  body: JSON.stringify(data)
});

export const completeReturn = (id) => request(`/returns/${id}/complete`, {
  method: 'POST'
});

export const assignReturnProduct = (id, productId) => request(`/returns/${id}/assign-product`, {
  method: 'POST',
  body: JSON.stringify({ product_id: productId })
});

export const importReturnBacklog = (files) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  return request('/returns/import-backlog', {
    method: 'POST',
    body: formData
  });
};

// Warehouse Orders (Client)
export const getClientOrders = (clientCode, filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/clients/${clientCode}/warehouse-orders?${params}`);
};

export const createClientOrder = (clientCode, data) => request(`/clients/${clientCode}/warehouse-orders`, {
  method: 'POST',
  body: JSON.stringify(data)
});

export const getClientOrder = (clientCode, orderId) =>
  request(`/clients/${clientCode}/warehouse-orders/${orderId}`);

export const updateClientOrder = (clientCode, orderId, data) =>
  request(`/clients/${clientCode}/warehouse-orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

export const cancelClientOrder = (clientCode, orderId) =>
  request(`/clients/${clientCode}/warehouse-orders/${orderId}`, {
    method: 'DELETE'
  });

// Warehouse Orders (Employee Receiving)
export const searchOrdersForReceiving = (clientId, query) =>
  request(`/warehouse-orders/search?client_id=${clientId}&q=${encodeURIComponent(query)}`);

export const getOrderForReceiving = (orderId) =>
  request(`/warehouse-orders/${orderId}`);

export const submitOrderReceiving = (orderId, data) =>
  request(`/warehouse-orders/${orderId}/receive`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

// Receiving Photos
export const getReceivingPhotoSignature = (receivingId) => request('/upload/signature/receiving', {
  method: 'POST',
  body: JSON.stringify({ receiving_id: receivingId })
});

export const addReceivingPhoto = (receivingId, photoUrl, receivingLogId = null, photoType = 'receiving', notes = null) =>
  request('/warehouse-orders/receiving-photos', {
    method: 'POST',
    body: JSON.stringify({
      receiving_id: receivingId,
      receiving_log_id: receivingLogId,
      photo_url: photoUrl,
      photo_type: photoType,
      notes
    })
  });

export const getReceivingPhotos = (receivingId) =>
  request(`/warehouse-orders/receiving-photos/${receivingId}`);

// Employee Dashboard
export const getEmployeeDashboard = () => request('/warehouse-orders/employee/dashboard')

export const getTodaysReceiving = (clientId) =>
  request(`/warehouse-orders/todays-receiving${clientId ? `?client_id=${clientId}` : ''}`)
