import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { importReturnBacklog } from '../../api'
import { managerNavItems } from '../../config/managerNav'

export default function ReturnImport() {
  const fileInputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    addFiles(selectedFiles)
  }

  const addFiles = (newFiles) => {
    const pdfFiles = newFiles.filter(file =>
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    )

    if (pdfFiles.length !== newFiles.length) {
      setError('Some files were skipped. Only PDF files are accepted.')
    } else {
      setError(null)
    }

    if (pdfFiles.length > 0) {
      setFiles(prev => {
        // Avoid duplicates by checking file names
        const existingNames = new Set(prev.map(f => f.name))
        const uniqueNewFiles = pdfFiles.filter(f => !existingNames.has(f.name))
        return [...prev, ...uniqueNewFiles]
      })
      setResults(null)
    }
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    setError(null)
    setResults(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (files.length === 0) {
      setError('Please select at least one PDF file to import')
      return
    }

    setImporting(true)
    setError(null)
    setResults(null)

    try {
      const result = await importReturnBacklog(files)
      setResults(result)
      // Clear files on success
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Layout title="Import Return Labels" navItems={managerNavItems}>
      <div className="max-w-2xl mx-auto">
        {/* Import Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Return Label PDFs</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Input / Dropzone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDF Files
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : files.length > 0
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <label className="cursor-pointer block">
                  {files.length > 0 ? (
                    <div className="flex items-center justify-center gap-2 text-green-700">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-gray-600">Click to select files or drag and drop</p>
                      <p className="text-sm text-gray-400 mt-1">PDF files only</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Selected Files List */}
            {files.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Selected Files ({files.length})
                  </label>
                  <button
                    type="button"
                    onClick={clearFiles}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear All
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-700 truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={files.length === 0 || importing}
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
                  Import Return Labels
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Import Results</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.total || 0}</div>
                <div className="text-sm text-blue-700">Total Files</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.successful || 0}</div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{results.failed || 0}</div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
            </div>

            {/* Success Details */}
            {results.results && results.results.filter(r => r.success).length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Successfully Imported</h3>
                <div className="max-h-32 overflow-y-auto bg-green-50 rounded-lg p-4">
                  <ul className="space-y-1 text-sm text-green-700">
                    {results.results.filter(r => r.success).map((result, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{result.filename}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Error Details */}
            {results.results && results.results.filter(r => !r.success).length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Failed Imports</h3>
                <div className="max-h-48 overflow-y-auto bg-red-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-red-700">
                    {results.results.filter(r => !r.success).map((result, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <span className="font-medium">{result.filename}</span>
                          {result.error && (
                            <p className="text-red-600">{result.error}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Link to view returns */}
            <Link
              to="/manager/returns"
              className="block w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center"
            >
              View All Returns
            </Link>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Import Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>- Select one or more PDF files containing return labels</li>
            <li>- The system will extract tracking information from each label</li>
            <li>- Duplicate labels (same tracking number) will be skipped</li>
            <li>- Returns will be created with "pending" status</li>
            <li>- You can review and complete returns from the Returns page</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
