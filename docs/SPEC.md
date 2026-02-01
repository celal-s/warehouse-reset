# Warehouse RESET — Full Technical Spec Sheet

**Purpose:** Use this document as the authoritative spec when creating or extending modules. It describes the full app structure, APIs, data models, and conventions.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Repository Layout](#2-repository-layout)
3. [Backend (Server)](#3-backend-server)
4. [Database Schema](#4-database-schema)
5. [API Reference (Detailed)](#5-api-reference-detailed)
6. [Frontend (Client)](#6-frontend-client)
7. [Deployment](#7-deployment)
8. [Key Concepts & Data Flow](#8-key-concepts--data-flow)
9. [Adding New Modules — Checklist](#9-adding-new-modules--checklist)

---

## 1. Overview

| Item | Detail |
|------|--------|
| **App name** | ShipFifty Warehouse RESET |
| **Domain** | Inventory, returns, and warehouse order receiving management |
| **Stack** | React 18 (Vite 5) + Express 4 + PostgreSQL |
| **Hosting** | Render (API + static site + Postgres) |
| **Auth** | JWT Bearer; roles: `admin`, `manager`, `employee`, `client` |
| **Public signup** | Disabled (403); users created via Manager/Admin |

### Role hierarchy

- **admin** — Full access; DB browser, schema, statistics, server status, route introspection; can create any role.
- **manager** — Dashboard, import, locations, products, users, returns; can create `employee` and `client`; client-scoped access via clientCode.
- **employee** — Scan, sort, returns processing, order receiving; read locations; no user management.
- **client** — Own client only: dashboard, inventory, products, warehouse orders; decision on inventory items (e.g. return label upload).

---

## 2. Repository Layout

```
warehouse-reset/
├── client/                          # Vite + React SPA
│   ├── index.html
│   ├── package.json                 # react, react-router-dom, @tanstack/react-table, @tremor/react, @xyflow/react, recharts, tailwind
│   ├── vite.config.js                # dev proxy /api → localhost:3001
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/
│   │   └── _redirects                # SPA fallback (e.g. Netlify)
│   └── src/
│       ├── main.jsx
│       ├── index.css
│       ├── App.jsx                   # BrowserRouter, AuthProvider, routes from config
│       ├── api/
│       │   └── index.js               # Single API client: request(), all API functions
│       ├── context/
│       │   └── AuthContext.jsx       # user, token, login, logout, isAuthenticated
│       ├── hooks/
│       │   └── useClientNavigation.js
│       ├── routes/
│       │   └── config.js              # routeConfig[], getFlatRoutes(), getNavigationFormat()
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── ProtectedRoute.jsx
│       │   ├── BackButton.jsx
│       │   ├── DataTable/            # DataTable, ColumnHeader, Empty, Pagination, Toolbar, useDataTable
│       │   ├── orders/               # BundleConfigForm, OrderProgressBar, OrderStatusBadge, ReceivingHistoryTable
│       │   ├── scanner/
│       │   │   └── ScannerInput.jsx
│       │   ├── upload/               # LabelUpload.jsx, PhotoUpload.jsx
│       │   └── ui/                   # Alert, Badge, Button, Card, Input, Select, Spinner, index.js
│       └── pages/                    # See §6 — by role (Home, Login, employee/, client/, manager/, admin/)
├── server/
│   ├── package.json                 # express, pg, bcrypt, jsonwebtoken, multer, cloudinary, pdf-parse, xlsx, cors, dotenv
│   ├── .env.example
│   ├── src/
│   │   ├── index.js                  # Express app, CORS, JSON, route mount, errorHandler, runMigrations, startServer
│   │   ├── config/
│   │   │   └── frontendRoutes.js     # Server copy of frontend route config (for admin /routes)
│   │   ├── db/
│   │   │   ├── index.js              # pg Pool, query(), connection string from DATABASE_URL
│   │   │   ├── migrate.js            # Base schema (run manually)
│   │   │   ├── seed.js               # Marketplaces, clients, admin user
│   │   │   └── importInventoryFiles.js
│   │   ├── middleware/
│   │   │   ├── auth.js               # authenticate, authorize(...roles)
│   │   │   ├── clientIsolation.js    # req.client from :clientCode
│   │   │   └── errorHandler.js       # validation→400, not_found→404, else 500
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── products.js
│   │   │   ├── inventory.js
│   │   │   ├── clients.js
│   │   │   ├── manager.js
│   │   │   ├── admin.js
│   │   │   ├── upload.js
│   │   │   ├── returns.js
│   │   │   └── warehouseOrders.js    # clientRoutes + employeeRoutes
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── activityService.js
│   │   │   ├── cloudinaryService.js   # (Cloudinary used directly in upload routes)
│   │   │   ├── importService.js
│   │   │   ├── inventoryService.js
│   │   │   ├── returnLabelParser.js
│   │   │   ├── returnsService.js
│   │   │   └── searchService.js
│   │   ├── scripts/
│   │   │   ├── importReturnBacklog.js
│   │   │   └── importWarehouseOrders.js
│   │   └── utils/
│   │       └── routeIntrospector.js   # extractRoutes, formatForNavigation, formatForApiDocs
│   └── scripts/
│       └── cleanup-duplicate-products.js
├── render.yaml                       # warehouse-api, warehouse-frontend, warehouse-db
├── full-receiving-implementation/    # Reference CSVs + Google Apps Script (Code.gs, ReceivingInterface.html)
├── inventory files/                  # xlsx picklists
├── return-labels/                   # PDFs (reference/import)
├── update.md
├── users.md
└── docs/
    └── SPEC.md                       # This file
```

---

## 3. Backend (Server)

### 3.1 Entry point: `server/src/index.js`

- **Port:** `process.env.PORT || 3001`
- **Middleware:** `cors()`, `express.json({ limit: '10mb' })`
- **Health:** `GET /api/health` → `{ status: 'ok', timestamp: ISO }`
- **Route mount order:** products, inventory, clients, manager, admin, upload, auth, returns, warehouse-orders (client), warehouse-orders (employee)
- **Error:** Single `errorHandler` after routes
- **Startup:** `db.query('SELECT 1')` → `runMigrations()` (additive DDL) → `app.listen()`

### 3.2 Database layer: `server/src/db/index.js`

- **Driver:** `pg`; `Pool` from `process.env.DATABASE_URL`
- **SSL:** `rejectUnauthorized: false` when `NODE_ENV === 'production'`
- **Export:** `query(text, params)`, `pool`

### 3.3 Middleware

| Middleware | File | Behavior |
|------------|------|----------|
| **authenticate** | `auth.js` | `Authorization: Bearer <token>` → `authService.verifyToken` → `req.user` (id, email, role, client_id). 401 if missing/invalid. |
| **authorize(...roles)** | `auth.js` | Requires `req.user`; 403 if `req.user.role` not in `roles`. Exposes `_roles` for introspection. |
| **clientIsolation** | `clientIsolation.js` | Param `clientCode` → load client → `req.client` (id, client_code, name, email). 400 if no code, 404 if not found. |
| **checkClientAccess** | `clients.js` | If `req.user.role === 'client'` and `req.user.client_id !== req.client.id` → 403. |
| **errorHandler** | `errorHandler.js` | `err.type === 'validation'` → 400; `err.type === 'not_found'` → 404; else 500 (message hidden in production). |

### 3.4 Auth service: `server/src/services/authService.js`

- **hashPassword(password)** — bcrypt, 10 rounds
- **comparePassword(password, hash)** — bcrypt compare
- **generateToken(user)** — JWT sign with `JWT_SECRET`, 7d expiry; payload: `{ id, email, role, client_id }`
- **verifyToken(token)** — JWT verify; returns decoded payload

**Note:** `JWT_SECRET` must be set in production (add to `.env.example` and Render if not already).

### 3.5 Environment variables (server)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `JWT_SECRET` | Yes (prod) | Secret for signing/verifying JWTs |
| `CLOUDINARY_CLOUD_NAME` | For uploads | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | For uploads | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | For uploads | Cloudinary API secret (used for signed uploads) |
| `PORT` | No | Server port (default 3001) |
| `NODE_ENV` | No | `production` hides error details in 500 responses |

### 3.6 Services summary

| Service | File | Purpose |
|---------|------|---------|
| authService | authService.js | Password hash/compare (bcrypt), JWT sign/verify |
| activityService | activityService.js | log(entityType, entityId, action, actorType, actorIdentifier, details); getRecentActivity; getActivityByEntity |
| inventoryService | inventoryService.js | receiveInventory, adjustInventory, moveInventory, updateCondition; uses transactions; auto-matches pre_receipt returns on receive |
| returnsService | returnsService.js | createReturn, getReturns, getPendingReturns, getUnmatchedReturns, getReturn, updateReturn, shipReturn, completeReturn, assignProduct, findMatchingReturns; import backlog (PDF filenames) |
| returnLabelParser | returnLabelParser.js | parseFilename(filename) → asin, orderNumber, quantity, carrier, isDamaged, productNameHint; used for return backlog import |
| searchService | searchService.js | searchProducts(q, clientId), searchByUPC(upc) — products with client_listings, photos |
| importService | importService.js | Product/catalog import from uploaded file (xlsx/csv) |
| cloudinaryService | cloudinaryService.js | (Cloudinary used directly in upload routes for signed params) |

---

## 4. Database Schema

Base schema is in `server/src/db/migrate.js`. Additive migrations run on app start in `server/src/index.js` (e.g. new columns, `returns`, `warehouse_orders`, `receiving_log`, `inventory_photos`, `inventory_history`, `client_order_sequences`, indexes).

### 4.1 Core tables (column-level)

**clients**
- `id` SERIAL PK, `client_code` VARCHAR(10) UNIQUE NOT NULL, `name` VARCHAR(255), `email` VARCHAR(255), `created_at`

**marketplaces**
- `id` SERIAL PK, `code` VARCHAR(10) UNIQUE NOT NULL, `name` VARCHAR(100), `domain` VARCHAR(50) (e.g. amazon.com, amazon.co.uk)

**users**
- `id` SERIAL PK, `email` UNIQUE NOT NULL, `password_hash` NOT NULL, `name` NOT NULL, `role` CHECK (admin, manager, employee, client), `client_id` FK→clients, `is_active` BOOLEAN DEFAULT true, `created_at`

**products**
- `id` SERIAL PK, `upc` TEXT, `title` VARCHAR(500) NOT NULL, `warehouse_notes` TEXT, `warehouse_condition` VARCHAR(50), `created_at`, `updated_at`

**product_photos**
- `id` SERIAL PK, `product_id` FK→products CASCADE, `photo_url` VARCHAR(500), `photo_type` DEFAULT 'main', `photo_source` DEFAULT 'warehouse', `uploaded_at`

**client_product_listings**
- `id` SERIAL PK, `product_id` FK→products, `client_id` FK→clients, `marketplace_id` FK→marketplaces, `sku`, `asin`, `fnsku`, `image_url`, `created_at`, UNIQUE(product_id, client_id, marketplace_id)

**storage_locations**
- `id` SERIAL PK, `type` VARCHAR(50), `label` VARCHAR(100) UNIQUE, `created_at`

**inventory_items**
- `id` SERIAL PK, `product_id` FK→products, `client_id` FK→clients, `storage_location_id` FK→storage_locations, `listing_id` FK→client_product_listings (nullable), `quantity` NOT NULL DEFAULT 1, `condition` DEFAULT 'sellable', `status` DEFAULT 'awaiting_decision', `client_decision`, `decision_notes`, `received_at`, `received_by` FK→users, `condition_notes`, `lot_number`, `created_at`, `updated_at`

**inventory_photos**
- `id` SERIAL PK, `inventory_item_id` FK→inventory_items CASCADE, `photo_url`, `photo_type` DEFAULT 'condition', `notes`, `uploaded_at`, `uploaded_by` FK→users

**inventory_history**
- `id` SERIAL PK, `inventory_item_id` FK→inventory_items CASCADE, `action`, `field_changed`, `old_value`, `new_value`, `quantity_change`, `changed_at`, `changed_by` FK→users, `reason`

**client_decisions**
- `id` SERIAL PK, `inventory_item_id` FK→inventory_items CASCADE, `decision`, `shipping_label_url`, `notes`, `decided_at`

**activity_log**
- `id` SERIAL PK, `entity_type`, `entity_id`, `action`, `actor_type`, `actor_identifier`, `details` JSONB, `created_at`

**returns**
- `id` SERIAL PK, `product_id` FK→products, `inventory_item_id` FK→inventory_items, `client_id` FK→clients, `quantity` DEFAULT 1, `return_type` ('post_receipt'|'pre_receipt'), `status` ('pending'|'matched'|'shipped'|'completed'|'cancelled'|'unmatched'), `label_url`, `label_uploaded_at`, `carrier`, `tracking_number`, `return_by_date`, `source_identifier`, `parsed_product_name`, `match_confidence`, `client_notes`, `warehouse_notes`, `created_at`, `created_by`, `shipped_at`, `shipped_by`, `completed_at`, `import_batch_id`, `original_filename`

**warehouse_orders**
- `id` SERIAL PK, `warehouse_order_line_id` VARCHAR(50) UNIQUE NOT NULL, `client_id` FK→clients CASCADE, `warehouse_order_date`, `purchase_order_date`, `purchase_order_no`, `vendor`, `marketplace_id` FK→marketplaces, `sku`, `asin`, `fnsku`, `product_title` NOT NULL, `product_id` FK→products, `listing_id` FK→client_product_listings, `is_hazmat` DEFAULT false, `photo_link`, `purchase_bundle_count` DEFAULT 1, `purchase_order_quantity` NOT NULL, `selling_bundle_count` DEFAULT 1, `expected_single_units`, `expected_sellable_units`, `total_cost`, `unit_cost`, `receiving_status` ('awaiting'|'partial'|'complete'|'extra_units'|'cancelled'), `received_good_units`, `received_damaged_units`, `received_sellable_units`, `first_received_date`, `last_received_date`, `notes_to_warehouse`, `warehouse_notes`, `created_at`, `created_by`, `updated_at`

**receiving_log**
- `id` SERIAL PK, `receiving_id` VARCHAR(20) UNIQUE NOT NULL, `receiving_date`, `warehouse_order_id` FK→warehouse_orders, `warehouse_order_line_id`, `client_id`, `purchase_order_no`, `vendor`, `sku`, `asin`, `product_title`, `received_good_units`, `received_damaged_units`, `selling_bundle_count`, `sellable_units`, `tracking_number`, `notes`, `receiver_id` FK→users, `receiver_name`, `created_at`

**client_order_sequences**
- `client_id` PK FK→clients CASCADE, `next_sequence` DEFAULT 1 (used to generate `warehouse_order_line_id` per client)

### 4.2 Seed data (`server/src/db/seed.js`)

- **Marketplaces:** us (amazon.com), ca (amazon.ca), uk (amazon.co.uk), au (amazon.com.au)
- **Clients:** 258, 412, 561 (names/emails as in seed)
- **Admin user:** email `admin@shipfifty.com`, password `admin123`, role `admin`

---

## 5. API Reference (Detailed)

Base URL: `/api`. All authenticated routes expect `Authorization: Bearer <token>` unless noted.

### 5.1 Auth — `/api/auth`

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | `/login` | No | `{ email, password }` | `{ token, user }` — user: id, email, name, role, client_id, client_code |
| POST | `/signup` | No | — | 403 (disabled) |
| GET | `/me` | Yes | — | User object: id, email, name, role, client_id, client_code, is_active, created_at |

### 5.2 Products — `/api/products`

All require authenticate. Manager/employee for write.

| Method | Path | Roles | Request | Response |
|--------|------|-------|---------|----------|
| GET | `/search?q=&client_id=` | Any | — | Array of products with client_listings, display_image_url |
| GET | `/scan/:upc` | Any | — | Single product or 404 |
| GET | `/:id` | Any | — | Product with client_listings (client_code, sku, asin, fnsku, marketplace, amazon_url), photos |
| GET | `/:id/detail` | Any | — | Product + listings + inventory_summary + photos |
| GET | `/:id/inventory` | Any | — | Array of inventory items for product |
| GET | `/:id/history` | Any | — | History entries |
| GET | `/:id/has-photos` | Any | — | Boolean |
| PATCH | `/:id/observations` | manager, employee, admin | `{ warehouse_notes?, warehouse_condition? }` | Updated product |
| POST | `/` | manager, admin, employee | `{ upc?, title }` | Created product |
| POST | `/:id/photos` | manager, admin, employee | `{ photo_url, photo_type?, photo_source? }` | — |

### 5.3 Inventory — `/api/inventory`

Query params for `GET /`: `client_id`, `status`, `location_id`, `condition`.

| Method | Path | Roles | Request | Response |
|--------|------|-------|---------|----------|
| GET | `/` | Any | — | Array of inventory items (with product, client, location, listing, photos, history) |
| GET | `/:id` | Any | — | Single item with decision_history, history, inventory_photos |
| POST | `/` | manager, employee, admin | `{ product_id, client_id?, listing_id?, storage_location_id?, quantity?, condition?, new_location? }` — listing_id OR (product_id+client_id) | Created item |
| PATCH | `/:id` | manager, employee, admin | Partial body (e.g. quantity, condition, status, storage_location_id) | Updated item |
| DELETE | `/:id` | manager, employee, admin | — | — |
| POST | `/receive` | manager, employee, admin | Same as POST `/` (listing_id OR product_id+client_id; quantity, condition, storage_location_id, notes, lot_number, new_location) | Created item (may have matched_return_id) |
| POST | `/:id/adjust` | manager, employee, admin | `{ quantity_change, reason }` | Updated item |
| POST | `/:id/move` | manager, employee, admin | `{ storage_location_id?, new_location?, reason }` | Updated item |
| POST | `/:id/condition` | manager, employee, admin | `{ condition, condition_notes? }` | Updated item |
| GET | `/:id/history` | Any | — | Array of history rows |
| POST | `/:id/photos` | manager, employee, admin | `{ photo_url, photo_type?, notes? }` | — |
| GET | `/:id/photos` | Any | — | Array of photos |

### 5.4 Clients — `/api/clients`

Routes under `/:clientCode` use clientIsolation + checkClientAccess (clients see only their own).

| Method | Path | Roles | Request | Response |
|--------|------|-------|---------|----------|
| GET | `/` | manager, employee, admin | — | Array of clients |
| GET | `/:clientCode` | Any (client only own) | — | req.client |
| GET | `/:clientCode/dashboard` | Any (client only own) | — | Stats: total_items, pending_decisions, decided, processed, sellable_items, damaged_items, total_quantity, decision_breakdown |
| GET | `/:clientCode/inventory` | Any (client only own) | Query: status, condition | Array of inventory items |
| GET | `/:clientCode/inventory/:itemId` | Any (client only own) | — | Single item with full detail |
| POST | `/:clientCode/inventory/:itemId/decision` | Any (client only own) | `{ decision, shipping_label_url?, notes? }` | — |
| GET | `/:clientCode/products` | Any (client only own) | — | Client product catalog (listings) |
| GET | `/:clientCode/products/:productId` | Any (client only own) | — | Product detail for client |

### 5.5 Warehouse orders (client) — `/api/clients/:clientCode/warehouse-orders`

Uses same client resolution as clients routes (resolveClient + client access).

| Method | Path | Roles | Request | Response |
|--------|------|-------|---------|----------|
| GET | `/` | client (own), manager, admin | Query: status, limit, offset | Array of orders (with receiving_log if detail) |
| POST | `/` | client (own), manager, admin | Single object or array: `purchase_order_date?, purchase_order_no?, vendor?, marketplace_id?, sku?, asin?, fnsku?, product_title, product_id?, listing_id?, is_hazmat?, photo_link?, purchase_bundle_count?, purchase_order_quantity, selling_bundle_count?, total_cost?, unit_cost?, notes_to_warehouse?` | `{ message, orders }` created |
| GET | `/:id` | client (own), manager, admin | — | Order with receiving history |
| PUT | `/:id` | client (own), manager, admin | Same fields as create (partial ok for update) | Updated order |
| DELETE | `/:id` | client (own), manager, admin | — | Cancel (receiving_status = cancelled) |

### 5.6 Warehouse orders (employee) — `/api/warehouse-orders`

| Method | Path | Roles | Request | Response |
|--------|------|-------|---------|----------|
| GET | `/search?client_id=&q=` | employee, manager, admin | — | Matching orders |
| GET | `/:id` | employee, manager, admin | — | Order detail with receiving_log |
| POST | `/:id/receive` | employee, manager, admin | `{ received_good_units?, received_damaged_units?, sellable_units?, tracking_number?, notes? }` — updates order and inserts receiving_log | Updated order + receiving record |

### 5.7 Manager — `/api/manager`

| Method | Path | Roles | Request | Response |
|--------|------|-------|---------|----------|
| GET | `/dashboard` | manager, admin | — | Dashboard stats |
| GET | `/activity?limit=` | manager, admin | — | activity_log rows |
| GET | `/locations` | manager, admin, employee | — | storage_locations |
| POST | `/locations` | manager, admin | `{ type, label }` | Created location |
| DELETE | `/locations/:id` | manager, admin | — | — |
| POST | `/import` | manager, admin | multipart `file`, `client_code`, `marketplace` | Import result |
| GET | `/products?page=&limit=` | manager, admin | — | Paginated products |
| GET | `/marketplaces` | manager, admin | — | marketplaces |
| GET | `/diagnostics/duplicates` | manager, admin | — | Duplicate report |
| POST | `/diagnostics/cleanup` | manager, admin | — | Cleanup result |
| GET | `/users` | manager, admin | — | Users list |
| GET | `/users/:id` | manager, admin | — | User detail |
| POST | `/users` | manager, admin | `{ email, password, name, role, client_code? }` — client_code required for role=client; manager can only create employee/client | Created user |
| PATCH | `/users/:id` | manager, admin | `{ name?, role?, is_active?, client_code? }` — cannot deactivate self | Updated user |
| POST | `/users/:id/reset-password` | manager, admin | `{ password }` | — |
| DELETE | `/users/:id` | manager, admin | — | — |

### 5.8 Admin — `/api/admin`

All admin only.

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/server-status` | — | Health/env info |
| GET | `/statistics?period=` | — | Analytics |
| GET | `/routes` | — | Introspected API + frontend routes (routeIntrospector + frontendRoutes) |
| GET | `/schema` | — | DB schema overview |
| GET | `/schema/tables/:name` | — | Single table schema |
| GET | `/db-browser/tables` | — | Table list |
| GET | `/db-browser/tables/:name/schema` | — | Table columns |
| GET | `/db-browser/tables/:name/data` | — | Paginated rows (query params) |
| GET | `/db-browser/tables/:name/records/:id` | — | Single row |

### 5.9 Upload — `/api/upload`

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | `/signature/photo` | Yes | `{ product_id }` | Cloudinary upload params: signature, timestamp, cloudName, apiKey, folder, public_id |
| POST | `/signature/label` | Yes | `{ inventory_item_id }` | Same with folder `warehouse/labels`, resource_type raw |
| GET | `/config` | No | — | cloudName, apiKey (for client-side uploads) |

### 5.10 Returns — `/api/returns`

| Method | Path | Roles | Request | Response |
|--------|------|-------|---------|----------|
| GET | `/` | Any | Query: status, client_id, urgent, product_id, limit, offset | Filtered returns |
| GET | `/pending` | manager, employee, admin | — | Pending returns |
| GET | `/unmatched` | manager, admin | — | Unmatched returns |
| GET | `/:id` | Any | — | Return detail |
| POST | `/` | manager, employee, admin | `{ product_id?, quantity?, label_url?, carrier?, tracking_number?, return_by_date?, source_identifier?, parsed_product_name?, client_notes?, warehouse_notes? }` — creates pre_receipt | Created return |
| PATCH | `/:id` | manager, employee, admin | Partial body | Updated return |
| POST | `/:id/ship` | manager, employee, admin | `{ tracking_number?, carrier? }` | Shipped return |
| POST | `/:id/complete` | manager, admin | — | Completed return |
| POST | `/:id/assign-product` | manager, admin | `{ product_id }` | Return linked to product |
| POST | `/import-backlog` | manager, admin | multipart `files[]` (PDFs) | Import result (returnLabelParser used on filenames) |

---

## 6. Frontend (Client)

### 6.1 Build and dev

- **Tool:** Vite 5, `@vitejs/plugin-react`, React 18.
- **Dev:** `npm run dev` — port 5173; proxy `/api` → `http://localhost:3001`.
- **Build:** `npm run build` → `client/dist`.
- **Env:** `VITE_API_URL` — production API base (set in Render for static site).

### 6.2 Routing

- **Config:** `client/src/routes/config.js` — `routeConfig` array: sections (Public, Employee, Client, Manager, System Admin), each with `roles` and `routes` (path, component, description; optional route-level `roles`).
- **Helpers:** `getFlatRoutes()`, `getNavigationFormat()` (for admin page).
- **App.jsx:** Renders `<Route>` from `getFlatRoutes()`; no `roles` → public; with `roles` → wrapped in `<ProtectedRoute allowedRoles={route.roles}>`. Fallback `*` → `<Navigate to="/" />`.
- **ProtectedRoute:** Uses `useAuth()`; loading → spinner; !isAuthenticated → redirect to `/login` (state.from); allowedRoles and role not in list → redirect by role (admin→`/admin`, manager→`/manager`, employee→`/employee/scan`, client→`/client/${user.client_code}`).

### 6.3 Auth context

- **AuthContext:** Provider holds `user`, `token` (synced to `localStorage` key `auth_token`), `loading`, `login`, `signup`, `logout`, `isAuthenticated`. On mount, if token present, `fetchCurrentUser()` (GET /auth/me). Invalid token clears storage and user.
- **useAuth():** Returns context; throws if used outside AuthProvider.

### 6.4 API layer: `client/src/api/index.js`

- **request(endpoint, options):** `fetch(API_BASE + endpoint)` with JSON headers and `Authorization: Bearer` from localStorage; no Content-Type when body is FormData. On !response.ok, parse JSON and throw. Returns `response.json()`.
- **API_BASE:** `import.meta.env.VITE_API_URL || '/api'`.
- Exports: all functions used by the app (products, inventory, clients, manager/users, admin, upload, auth, returns, warehouse orders client + employee). Naming matches backend (e.g. getClientOrder, submitOrderReceiving).

### 6.5 Pages (by role)

- **Public:** Home, Login.
- **Employee:** employee/Scan, Sort, Returns, OrderReceiving.
- **Client:** client/Dashboard, Inventory, ItemDetail, Products, ProductDetail; client/orders/WarehouseOrders, WarehouseOrderDetail, WarehouseOrderNew.
- **Manager:** manager/Dashboard, Import, Locations, Products, ProductDetail, ProductNew, Users, Returns, ReturnDetail, ReturnImport, UnmatchedReturns, InventoryDetail (also allowed for employee).
- **Admin:** admin/Dashboard, System, Statistics, Schema, DbBrowser, DbBrowserTable, DbBrowserRecord, Navigation.

### 6.6 Components

- **Layout:** Layout.jsx.
- **Auth:** ProtectedRoute.jsx.
- **Nav:** BackButton.jsx.
- **Data:** DataTable (DataTable.jsx, DataTableColumnHeader, DataTableEmpty, DataTablePagination, DataTableToolbar, useDataTable.js), index.js.
- **Orders:** orders/BundleConfigForm, OrderProgressBar, OrderStatusBadge, ReceivingHistoryTable, index.js.
- **Scanner:** scanner/ScannerInput.jsx.
- **Upload:** upload/LabelUpload.jsx, PhotoUpload.jsx.
- **UI:** ui/Alert, Badge, Button, Card, Input, Select, Spinner, index.js.

### 6.7 Hooks

- **useClientNavigation:** `useParams().clientCode`, `useAuth().user`; returns `navItems` (dashboard, products, inventory, orders), `isStaffViewing`, `clientCode`.

### 6.8 Styling

- Tailwind CSS; tailwind.config.js, postcss.config.js. Dependencies: @tanstack/react-table, @tremor/react, @xyflow/react, recharts.

---

## 7. Deployment

**render.yaml:**

- **warehouse-api:** type web, runtime node, buildCommand `cd server && npm install`, startCommand `cd server && npm start`. Env: DATABASE_URL (from DB), CLOUDINARY_*, NODE_ENV=production. Plan free.
- **warehouse-frontend:** type web, runtime static, buildCommand `cd client && npm install && npm run build`, staticPublishPath `client/dist`, rewrite `/*` → `/index.html`. Env: VITE_API_URL (API URL). Plan free.
- **warehouse-db:** Postgres, plan free.

Ensure `JWT_SECRET` is set for the API in production.

---

## 8. Key Concepts & Data Flow

- **Client isolation:** Client-scoped routes use `:clientCode` → clientIsolation loads `req.client`; checkClientAccess ensures client users only access `req.client.id === req.user.client_id`.
- **Listing vs product+client:** A product can have multiple client_product_listings (per client and marketplace). Inventory can be tied to a specific listing via `listing_id`; if null, legacy behavior uses product_id+client_id. Receiving and product creation often use `listing_id` OR (product_id + client_id).
- **Return types:** `pre_receipt` — return created before inventory received; when matching inventory is received, returnsService can auto-match. `post_receipt` — return tied to existing inventory.
- **Return status flow:** pending → matched (when linked to inventory) → shipped → completed; or unmatched (e.g. backlog import without product match).
- **Warehouse order receiving_status:** awaiting | partial | complete | extra_units | cancelled. Employee receiving updates warehouse_orders and inserts receiving_log rows; first_received_date / last_received_date updated.
- **Activity log:** activityService.log(entityType, entityId, action, actorType, actorIdentifier, details). Used for returns, inventory, users.
- **Cloudinary:** Direct browser upload; frontend gets signed params from /upload/signature/photo or /signature/label, then uploads to Cloudinary; backend stores resulting URL in product_photos, client_decisions (label), or returns (label_url).

---

## 9. Adding New Modules — Checklist

Use this when adding a feature or module.

1. **Backend**
   - [ ] New tables/columns: add in migrate.js and/or startup migrations in index.js.
   - [ ] New route file under `server/src/routes`; mount in `index.js` with correct path.
   - [ ] Use `authenticate` and `authorize(roles)`; for client-scoped paths use `clientIsolation` and `checkClientAccess` (or equivalent).
   - [ ] Business logic in `server/src/services`; route handlers stay thin.
   - [ ] New scripts under `server/src/scripts` or `server/src/db`; document in README or this spec.

2. **Frontend**
   - [ ] New page under `client/src/pages`; add route in `client/src/routes/config.js` (section, roles, path, component, description).
   - [ ] New API calls in `client/src/api/index.js` using `request()`.
   - [ ] Shared UI in `client/src/components` (or ui/ or feature folder).
   - [ ] Role-only access: set `roles` on route; ProtectedRoute and backend `authorize` enforce.

3. **Auth**
   - [ ] New role: add to DB role check, `authorize()` usages, and frontend `routeConfig`; update ProtectedRoute redirect logic if needed.

4. **Config sync**
   - [ ] If new frontend routes should appear in admin “Routes & API Docs”, update `server/src/config/frontendRoutes.js` to match `client/src/routes/config.js` (or adopt shared source later).

5. **Environment**
   - [ ] New secrets: add to `server/.env.example` and Render env; for client use `VITE_*` and `import.meta.env`.

6. **Spec**
   - [ ] Update this SPEC.md with new endpoints, tables, and data flow notes.
