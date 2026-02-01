import { useState, useCallback, useEffect } from 'react'
import WebcamCapture from './WebcamCapture'
import { getReceivingPhotoSignature } from '../../api'

export default function ReceivingPhotoSection({
  receivingId,
  photos = [],
  onPhotoAdded,
  onPhotoRemoved,
  disabled = false
}) {
  const [mode, setMode] = useState('camera') // 'camera' or 'file'
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [localPhotos, setLocalPhotos] = useState([])

  // Merge prop photos with local photos
  const allPhotos = [...photos, ...localPhotos]

  // Keyboard shortcut for capture
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && mode === 'camera' && !disabled && !uploading) {
        // Space to capture - handled by WebcamCapture component
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, disabled, uploading])

  const uploadToCloudinary = useCallback(async (blob) => {
    if (!receivingId) {
      setError('Receiving ID required for photo upload')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Get signature from server
      const sigData = await getReceivingPhotoSignature(receivingId)

      // Upload directly to Cloudinary
      const formData = new FormData()
      formData.append('file', blob)
      formData.append('api_key', sigData.apiKey)
      formData.append('timestamp', sigData.timestamp)
      formData.append('signature', sigData.signature)
      formData.append('folder', sigData.folder)
      formData.append('public_id', sigData.public_id)

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
        { method: 'POST', body: formData }
      )

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      const uploadResult = await uploadResponse.json()

      if (!uploadResult.secure_url) {
        throw new Error('Invalid response from Cloudinary')
      }

      const photoUrl = uploadResult.secure_url

      // Add to local photos state
      const newPhoto = {
        id: `local_${Date.now()}`,
        photo_url: photoUrl,
        uploaded_at: new Date().toISOString()
      }
      setLocalPhotos(prev => [...prev, newPhoto])

      // Notify parent
      onPhotoAdded?.(photoUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }, [receivingId, onPhotoAdded])

  const handleCapture = useCallback((blob) => {
    uploadToCloudinary(blob)
  }, [uploadToCloudinary])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }

    uploadToCloudinary(file)
  }, [uploadToCloudinary])

  const handleRemovePhoto = useCallback((photoUrl) => {
    // Remove from local photos
    setLocalPhotos(prev => prev.filter(p => p.photo_url !== photoUrl))
    // Notify parent
    onPhotoRemoved?.(photoUrl)
  }, [onPhotoRemoved])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Photos ({allPhotos.length})
        </label>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === 'camera'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Camera
          </button>
          <button
            type="button"
            onClick={() => setMode('file')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === 'file'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            File
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            &times;
          </button>
        </div>
      )}

      {mode === 'camera' ? (
        <WebcamCapture
          onCapture={handleCapture}
          disabled={disabled || uploading}
        />
      ) : (
        <label className="block">
          <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            uploading
              ? 'border-gray-300 bg-gray-50'
              : 'border-gray-300 hover:border-blue-500'
          }`}>
            {uploading ? (
              <div className="flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">Uploading...</p>
              </div>
            ) : (
              <>
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                </p>
                <p className="mt-1 text-xs text-gray-500">PNG, JPG up to 10MB</p>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            className="hidden"
          />
        </label>
      )}

      {/* Photo thumbnails */}
      {allPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {allPhotos.map((photo, index) => (
            <div key={photo.id || photo.photo_url || index} className="relative group">
              <img
                src={photo.photo_url}
                alt={`Receiving photo ${index + 1}`}
                className="w-full h-20 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => handleRemovePhoto(photo.photo_url)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Uploading photo...
        </div>
      )}
    </div>
  )
}
