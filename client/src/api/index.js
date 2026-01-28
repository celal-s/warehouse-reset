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

export const addProductPhoto = (productId, photoUrl, photoType = 'main') =>
  request(`/products/${productId}/photos`, {
    method: 'POST',
    body: JSON.stringify({ photo_url: photoUrl, photo_type: photoType })
  });

export const checkProductHasPhotos = (productId) => request(`/products/${productId}/has-photos`);

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

// Admin
export const getAdminDashboard = () => request('/admin/dashboard');

export const getActivityLog = (limit = 50) => request(`/admin/activity?limit=${limit}`);

export const getLocations = () => request('/admin/locations');

export const createLocation = (data) => request('/admin/locations', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const deleteLocation = (id) => request(`/admin/locations/${id}`, {
  method: 'DELETE'
});

export const importProducts = (file, clientCode, marketplace = 'us') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('client_code', clientCode);
  formData.append('marketplace', marketplace);

  return request('/admin/import', {
    method: 'POST',
    body: formData
  });
};

export const getAdminProducts = (page = 1, limit = 50) =>
  request(`/admin/products?page=${page}&limit=${limit}`);

export const getMarketplaces = () => request('/admin/marketplaces');

// User Management (Admin)
export const getUsers = () => request('/admin/users');

export const getUser = (id) => request(`/admin/users/${id}`);

export const createUser = (data) => request('/admin/users', {
  method: 'POST',
  body: JSON.stringify(data)
});

export const updateUser = (id, data) => request(`/admin/users/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(data)
});

export const resetUserPassword = (id, password) => request(`/admin/users/${id}/reset-password`, {
  method: 'POST',
  body: JSON.stringify({ password })
});

export const deleteUser = (id) => request(`/admin/users/${id}`, {
  method: 'DELETE'
});

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
