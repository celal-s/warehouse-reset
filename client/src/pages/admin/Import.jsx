import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import { getClients, getMarketplaces, importProducts } from '../../api'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/import', label: 'Import' },
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/products', label: 'Products' }
]

export default function AdminImport() {
  const fileInputRef = useRef(null)
  const [clients, setClients] = useState([])
  const [marketplaces, setMarketplaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [file, setFile] = useState(null)
  const [clientCode, setClientCode] = useState('')
  const [marketplace, setMarketplace] = useState('us')

  // Results
  const [results, setResults] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [clientsData, marketplacesData] = await Promise.all([
        getClients(),
        getMarketplaces()
      ])
      setClients(clientsData)
      setMarketplaces(marketplacesData)
      if (clientsData.length > 0) {
        setClientCode(clientsData[0].client_code)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ]
      if (!validTypes.includes(selectedFile.type) &&
          !selectedFile.name.endsWith('.xlsx') &&
          !selectedFile.name.endsWith('.xls')) {
        setError('Please select a valid Excel file (.xlsx or .xls)')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
      setResults(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!file) {
      setError('Please select a file to import')
      return
    }

    if (!clientCode) {
      setError('Please select a client')
      return
    }

    setImporting(true)
    setError(null)
    setResults(null)

    try {
      const result = await importProducts(file, clientCode, marketplace)
      setResults(result)
      // Reset file input
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Layout title="Import Products" backLink="/" navItems={adminNavItems}>
      <div className="max-w-2xl mx-auto">
        {/* Import Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Excel File</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel File (.xlsx, .xls)
              </label>
              <div className="flex items-center gap-4">
                <label className="flex-1">
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                  }`}>
                    {file ? (
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{file.name}</span>
                      </div>
                    ) : (
                      <>
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-gray-600">Click to select file or drag and drop</p>
                        <p className="text-sm text-gray-400 mt-1">Excel files only (.xlsx, .xls)</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Client Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client
              </label>
              <select
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              >
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.client_code}>
                    {client.client_code} - {client.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Marketplace Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marketplace
              </label>
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              >
                {marketplaces.length > 0 ? (
                  marketplaces.map((mp) => (
                    <option key={mp.code} value={mp.code}>
                      {mp.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="us">US</option>
                    <option value="ca">Canada</option>
                    <option value="uk">UK</option>
                    <option value="de">Germany</option>
                    <option value="fr">France</option>
                  </>
                )}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!file || !clientCode || importing}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Importing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Import Products
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Import Results</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.imported || 0}</div>
                <div className="text-sm text-green-700">Imported</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.updated || 0}</div>
                <div className="text-sm text-blue-700">Updated</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{results.errors?.length || 0}</div>
                <div className="text-sm text-red-700">Errors</div>
              </div>
            </div>

            {/* Error Details */}
            {results.errors && results.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Error Details</h3>
                <div className="max-h-48 overflow-y-auto bg-red-50 rounded-lg p-4">
                  <ul className="space-y-1 text-sm text-red-700">
                    {results.errors.map((err, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{typeof err === 'string' ? err : err.message || JSON.stringify(err)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Import Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>- Excel file should have columns: SKU, UPC/EAN, Title, Description (optional)</li>
            <li>- First row should contain column headers</li>
            <li>- Products with matching UPC will be updated, new ones will be created</li>
            <li>- Client listing will be created for the selected client and marketplace</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
