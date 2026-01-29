const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const os = require('os');
const routeIntrospector = require('../utils/routeIntrospector');
const { getNavigationFormat: getFrontendRoutes } = require('../config/frontendRoutes');

// Only admin role can access these routes (system admin - developer only)

// Whitelist of browsable tables (exclude users for security)
const BROWSABLE_TABLES = [
  'products', 'inventory_items', 'clients', 'storage_locations',
  'client_product_listings', 'product_photos', 'marketplaces',
  'activity_log', 'returns', 'inventory_photos', 'inventory_history',
  'client_decisions'
];

// ==================== SERVER STATUS ====================

// Get server status and health metrics
router.get('/server-status', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const startTime = Date.now();

    // Database latency check
    const dbStart = Date.now();
    await db.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    // Database size
    const dbSizeResult = await db.query(`
      SELECT pg_database_size(current_database()) as size
    `);
    const dbSize = parseInt(dbSizeResult.rows[0].size);

    // Active connections
    const connectionsResult = await db.query(`
      SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
    `);
    const activeConnections = parseInt(connectionsResult.rows[0].count);

    // Top tables by row count
    const tablesResult = await db.query(`
      SELECT relname as table_name, n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
      LIMIT 10
    `);

    // Memory usage
    const memUsage = process.memoryUsage();

    res.json({
      server: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      },
      process: {
        pid: process.pid,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      database: {
        latency: dbLatency,
        size: dbSize,
        sizeFormatted: formatBytes(dbSize),
        activeConnections,
        topTables: tablesResult.rows
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== STATISTICS ====================

// Get analytics statistics
router.get('/statistics', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;

    // Parse period
    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '90d') days = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Items received over time
    const itemsOverTime = await db.query(`
      SELECT DATE(COALESCE(received_at, created_at)) as date,
             COUNT(*) as count
      FROM inventory_items
      WHERE COALESCE(received_at, created_at) >= $1
      GROUP BY DATE(COALESCE(received_at, created_at))
      ORDER BY date
    `, [startDate]);

    // Client comparison
    const clientComparison = await db.query(`
      SELECT c.client_code, c.name,
             COUNT(i.id) as total_items,
             SUM(i.quantity) as total_quantity
      FROM clients c
      LEFT JOIN inventory_items i ON c.id = i.client_id
        AND COALESCE(i.received_at, i.created_at) >= $1
      GROUP BY c.id, c.client_code, c.name
      ORDER BY total_items DESC
    `, [startDate]);

    // Condition breakdown
    const conditionBreakdown = await db.query(`
      SELECT condition, COUNT(*) as count
      FROM inventory_items
      WHERE COALESCE(received_at, created_at) >= $1
      GROUP BY condition
    `, [startDate]);

    // Status breakdown
    const statusBreakdown = await db.query(`
      SELECT status, COUNT(*) as count
      FROM inventory_items
      GROUP BY status
    `);

    // Top products
    const topProducts = await db.query(`
      SELECT p.id, p.title, p.upc,
             COUNT(i.id) as item_count,
             SUM(i.quantity) as total_quantity
      FROM products p
      JOIN inventory_items i ON p.id = i.product_id
      WHERE COALESCE(i.received_at, i.created_at) >= $1
      GROUP BY p.id, p.title, p.upc
      ORDER BY item_count DESC
      LIMIT 10
    `, [startDate]);

    // Returns statistics
    const returnsStats = await db.query(`
      SELECT status, COUNT(*) as count
      FROM returns
      WHERE created_at >= $1
      GROUP BY status
    `, [startDate]);

    // Activity summary
    const activitySummary = await db.query(`
      SELECT action, COUNT(*) as count
      FROM activity_log
      WHERE created_at >= $1
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `, [startDate]);

    res.json({
      period,
      days,
      startDate: startDate.toISOString(),
      itemsOverTime: itemsOverTime.rows,
      clientComparison: clientComparison.rows,
      conditionBreakdown: conditionBreakdown.rows,
      statusBreakdown: statusBreakdown.rows,
      topProducts: topProducts.rows,
      returnsStats: returnsStats.rows,
      activitySummary: activitySummary.rows
    });
  } catch (error) {
    next(error);
  }
});

// ==================== NAVIGATION ====================

// Get complete route map (dynamically generated)
router.get('/navigation', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Get frontend routes from config
    const frontendRoutes = getFrontendRoutes();

    // Introspect API routes from Express app
    const extractedRoutes = routeIntrospector.extractRoutes(req.app);
    const apiSections = routeIntrospector.formatForNavigation(extractedRoutes);

    res.json({
      routes: frontendRoutes,
      api: apiSections
    });
  } catch (error) {
    next(error);
  }
});

// ==================== API DOCS ====================

// Get API documentation (dynamically generated)
router.get('/api-docs', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Introspect API routes from Express app
    const extractedRoutes = routeIntrospector.extractRoutes(req.app);
    const endpoints = routeIntrospector.formatForApiDocs(extractedRoutes);

    res.json({
      title: 'Warehouse Reset API',
      version: '1.0.0',
      description: 'API documentation for the Warehouse Reset system (auto-generated from route introspection)',
      baseUrl: '/api',
      authentication: {
        type: 'Bearer Token',
        description: 'Include Authorization header: Bearer <token>',
        endpoints: {
          login: {
            path: '/auth/login',
            method: 'POST',
            body: { email: 'string', password: 'string' },
            response: { token: 'string', user: 'object' }
          }
        }
      },
      roles: {
        admin: 'System administrator - full access to all features including system tools',
        manager: 'Warehouse manager - access to warehouse operations, users, imports',
        employee: 'Warehouse worker - scanning, sorting, returns processing',
        client: 'External client - view own inventory and products only'
      },
      endpoints
    });
  } catch (error) {
    next(error);
  }
});

// ==================== SCHEMA ====================

// Get full database schema
router.get('/schema', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Get all tables
    const tablesResult = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = [];

    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;

      // Get columns
      const columnsResult = await db.query(`
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = $1
        ORDER BY c.ordinal_position
      `, [tableName]);

      // Get primary key columns
      const pkResult = await db.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY'
      `, [tableName]);

      const pkColumns = pkResult.rows.map(r => r.column_name);

      // Get foreign keys
      const fkResult = await db.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'FOREIGN KEY'
      `, [tableName]);

      const fkMap = {};
      for (const fk of fkResult.rows) {
        fkMap[fk.column_name] = {
          table: fk.foreign_table,
          column: fk.foreign_column
        };
      }

      // Get row count
      const countResult = await db.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const rowCount = parseInt(countResult.rows[0].count);

      tables.push({
        name: tableName,
        rowCount,
        columns: columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default,
          maxLength: col.character_maximum_length,
          isPrimaryKey: pkColumns.includes(col.column_name),
          foreignKey: fkMap[col.column_name] || null
        }))
      });
    }

    // Build relationships for ERD
    const relationships = [];
    for (const table of tables) {
      for (const column of table.columns) {
        if (column.foreignKey) {
          relationships.push({
            from: { table: table.name, column: column.name },
            to: { table: column.foreignKey.table, column: column.foreignKey.column }
          });
        }
      }
    }

    res.json({
      tables,
      relationships,
      totalTables: tables.length,
      totalColumns: tables.reduce((sum, t) => sum + t.columns.length, 0)
    });
  } catch (error) {
    next(error);
  }
});

// Get single table schema
router.get('/schema/tables/:name', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name } = req.params;

    // Verify table exists
    const tableCheck = await db.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    `, [name]);

    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get columns with detailed info
    const columnsResult = await db.query(`
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position
    `, [name]);

    // Get indexes
    const indexesResult = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1
    `, [name]);

    // Get constraints
    const constraintsResult = await db.query(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = $1
    `, [name]);

    // Get sample data
    const sampleResult = await db.query(`SELECT * FROM "${name}" LIMIT 5`);

    res.json({
      name,
      columns: columnsResult.rows,
      indexes: indexesResult.rows,
      constraints: constraintsResult.rows,
      sampleData: sampleResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// ==================== DATABASE BROWSER ====================

// List browsable tables
router.get('/db-browser/tables', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const tables = [];

    for (const tableName of BROWSABLE_TABLES) {
      try {
        const countResult = await db.query(`SELECT COUNT(*) FROM "${tableName}"`);
        tables.push({
          name: tableName,
          rowCount: parseInt(countResult.rows[0].count)
        });
      } catch {
        // Table might not exist, skip it
      }
    }

    res.json({
      tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
      note: 'users table is excluded for security reasons'
    });
  } catch (error) {
    next(error);
  }
});

// Get table schema for browser
router.get('/db-browser/tables/:name/schema', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name } = req.params;

    if (!BROWSABLE_TABLES.includes(name)) {
      return res.status(403).json({ error: 'Table not browsable' });
    }

    const columnsResult = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [name]);

    res.json({
      table: name,
      columns: columnsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Browse table data with pagination, sorting, filtering
router.get('/db-browser/tables/:name/data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name } = req.params;

    if (!BROWSABLE_TABLES.includes(name)) {
      return res.status(403).json({ error: 'Table not browsable' });
    }

    const {
      page = 1,
      limit = 50,
      sortBy,
      sortOrder = 'asc',
      ...filters
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Get valid columns for the table
    const columnsResult = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `, [name]);
    const validColumns = columnsResult.rows.map(r => r.column_name);

    // Build query
    let sql = `SELECT * FROM "${name}"`;
    const params = [];
    let paramIndex = 1;

    // Apply filters
    const whereClauses = [];
    for (const [key, value] of Object.entries(filters)) {
      // Parse filter format: column_operator (e.g., status_equals, name_contains)
      const match = key.match(/^(.+?)_(equals|contains|starts_with|gt|lt|is_null)$/);
      if (match) {
        const [, column, operator] = match;
        if (validColumns.includes(column)) {
          switch (operator) {
            case 'equals':
              whereClauses.push(`"${column}" = $${paramIndex}`);
              params.push(value);
              paramIndex++;
              break;
            case 'contains':
              whereClauses.push(`"${column}"::text ILIKE $${paramIndex}`);
              params.push(`%${value}%`);
              paramIndex++;
              break;
            case 'starts_with':
              whereClauses.push(`"${column}"::text ILIKE $${paramIndex}`);
              params.push(`${value}%`);
              paramIndex++;
              break;
            case 'gt':
              whereClauses.push(`"${column}" > $${paramIndex}`);
              params.push(value);
              paramIndex++;
              break;
            case 'lt':
              whereClauses.push(`"${column}" < $${paramIndex}`);
              params.push(value);
              paramIndex++;
              break;
            case 'is_null':
              whereClauses.push(`"${column}" IS ${value === 'true' ? 'NULL' : 'NOT NULL'}`);
              break;
          }
        }
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await db.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Apply sorting (validate column)
    if (sortBy && validColumns.includes(sortBy)) {
      const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY "${sortBy}" ${order}`;
    } else {
      sql += ` ORDER BY id DESC`;
    }

    // Apply pagination
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    // Execute with timeout
    const result = await Promise.race([
      db.query(sql, params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      )
    ]);

    res.json({
      table: name,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      readOnly: true
    });
  } catch (error) {
    next(error);
  }
});

// Get single record
router.get('/db-browser/tables/:name/records/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, id } = req.params;

    if (!BROWSABLE_TABLES.includes(name)) {
      return res.status(403).json({ error: 'Table not browsable' });
    }

    const result = await db.query(`SELECT * FROM "${name}" WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({
      table: name,
      record: result.rows[0],
      readOnly: true
    });
  } catch (error) {
    next(error);
  }
});

// Helper function
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
