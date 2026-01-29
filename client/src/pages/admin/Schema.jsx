import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '../../components/Layout'
import { getAdminSchema } from '../../api'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/system', label: 'System' },
  { to: '/admin/statistics', label: 'Statistics' },
  { to: '/admin/schema', label: 'Schema' },
  { to: '/admin/db-browser', label: 'DB Browser' },
  { to: '/admin/navigation', label: 'Routes' },
  { to: '/admin/api-docs', label: 'API Docs' }
]

const TYPE_COLORS = {
  integer: 'bg-blue-100 text-blue-800',
  bigint: 'bg-blue-100 text-blue-800',
  smallint: 'bg-blue-100 text-blue-800',
  'character varying': 'bg-green-100 text-green-800',
  text: 'bg-green-100 text-green-800',
  boolean: 'bg-purple-100 text-purple-800',
  timestamp: 'bg-yellow-100 text-yellow-800',
  'timestamp without time zone': 'bg-yellow-100 text-yellow-800',
  date: 'bg-yellow-100 text-yellow-800',
  numeric: 'bg-pink-100 text-pink-800',
  decimal: 'bg-pink-100 text-pink-800',
  json: 'bg-orange-100 text-orange-800',
  jsonb: 'bg-orange-100 text-orange-800'
}

function getTypeColor(type) {
  return TYPE_COLORS[type] || 'bg-gray-100 text-gray-800'
}

// Custom node for ERD diagram
function TableNode({ data }) {
  return (
    <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200 min-w-[200px]">
      <div className="px-3 py-2 bg-blue-600 text-white font-medium rounded-t-lg flex items-center justify-between">
        <span>{data.label}</span>
        <span className="text-xs bg-blue-500 px-2 py-0.5 rounded">{data.rowCount} rows</span>
      </div>
      <div className="divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
        {data.columns?.slice(0, 10).map((col) => (
          <div key={col.name} className="px-3 py-1 text-xs flex items-center gap-2">
            {col.isPrimaryKey && (
              <span className="text-yellow-500" title="Primary Key">PK</span>
            )}
            {col.foreignKey && (
              <span className="text-blue-500" title={`FK -> ${col.foreignKey.table}`}>FK</span>
            )}
            <span className="font-mono flex-1 truncate">{col.name}</span>
            <span className={`px-1 rounded text-[10px] ${getTypeColor(col.type)}`}>
              {col.type.replace('character varying', 'varchar').replace('without time zone', '')}
            </span>
          </div>
        ))}
        {data.columns?.length > 10 && (
          <div className="px-3 py-1 text-xs text-gray-500 italic">
            +{data.columns.length - 10} more columns
          </div>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { tableNode: TableNode }

export default function AdminSchema() {
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('tree') // 'tree' or 'erd'
  const [search, setSearch] = useState('')
  const [expandedTables, setExpandedTables] = useState(new Set())

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    loadSchema()
  }, [])

  const loadSchema = async () => {
    try {
      const data = await getAdminSchema()
      setSchema(data)

      // Generate ERD nodes and edges
      const erdNodes = data.tables.map((table, index) => {
        const cols = Math.floor(index / 4)
        const row = index % 4
        return {
          id: table.name,
          type: 'tableNode',
          position: { x: cols * 280, y: row * 280 },
          data: {
            label: table.name,
            columns: table.columns,
            rowCount: table.rowCount
          }
        }
      })

      const erdEdges = data.relationships.map((rel, index) => ({
        id: `edge-${index}`,
        source: rel.from.table,
        target: rel.to.table,
        label: `${rel.from.column} -> ${rel.to.column}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6366F1' }
      }))

      setNodes(erdNodes)
      setEdges(erdEdges)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleTable = (tableName) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const filteredTables = useMemo(() => {
    if (!schema?.tables) return []
    if (!search) return schema.tables
    const searchLower = search.toLowerCase()
    return schema.tables.filter(
      table =>
        table.name.toLowerCase().includes(searchLower) ||
        table.columns.some(col => col.name.toLowerCase().includes(searchLower))
    )
  }, [schema, search])

  return (
    <Layout title="Database Schema" backLink="/admin" navItems={adminNavItems}>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('tree')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'tree' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tree View
          </button>
          <button
            onClick={() => setView('erd')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'erd' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ERD Diagram
          </button>
        </div>

        {/* Search */}
        {view === 'tree' && (
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tables or columns..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {/* Stats */}
        {schema && (
          <div className="flex gap-4 text-sm text-gray-600 ml-auto">
            <span>{schema.totalTables} tables</span>
            <span>{schema.totalColumns} columns</span>
            <span>{schema.relationships?.length || 0} relationships</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : view === 'tree' ? (
        /* Tree View */
        <div className="space-y-2">
          {filteredTables.map((table) => (
            <div key={table.name} className="bg-white rounded-lg shadow">
              <button
                onClick={() => toggleTable(table.name)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedTables.has(table.name) ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-mono font-medium text-gray-900">{table.name}</span>
                  <span className="text-sm text-gray-500">({table.columns.length} columns)</span>
                </div>
                <span className="text-sm text-gray-500">{table.rowCount.toLocaleString()} rows</span>
              </button>

              {expandedTables.has(table.name) && (
                <div className="border-t px-4 py-2">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left py-1">Column</th>
                        <th className="text-left py-1">Type</th>
                        <th className="text-left py-1">Nullable</th>
                        <th className="text-left py-1">Keys</th>
                        <th className="text-left py-1">Default</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {table.columns.map((col) => (
                        <tr key={col.name} className="text-sm">
                          <td className="py-2 font-mono">{col.name}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor(col.type)}`}>
                              {col.type}
                              {col.maxLength && `(${col.maxLength})`}
                            </span>
                          </td>
                          <td className="py-2">
                            {col.nullable ? (
                              <span className="text-gray-400">NULL</span>
                            ) : (
                              <span className="text-red-600 font-medium">NOT NULL</span>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              {col.isPrimaryKey && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                                  PK
                                </span>
                              )}
                              {col.foreignKey && (
                                <span
                                  className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium cursor-help"
                                  title={`References ${col.foreignKey.table}.${col.foreignKey.column}`}
                                >
                                  FK -&gt; {col.foreignKey.table}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 text-xs text-gray-500 font-mono max-w-[200px] truncate">
                            {col.default || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ERD Diagram */
        <div className="bg-white rounded-lg shadow" style={{ height: '600px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </div>
      )}
    </Layout>
  )
}
