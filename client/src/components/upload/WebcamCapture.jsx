import { useState, useRef, useEffect, useCallback } from 'react'

export default function WebcamCapture({ onCapture, disabled = false }) {
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [isActive, setIsActive] = useState(false)
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // Get available video devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permission first to get device labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
        tempStream.getTracks().forEach(track => track.stop())

        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = allDevices.filter(device => device.kind === 'videoinput')
        setDevices(videoDevices)
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId)
        }
      } catch (err) {
        // Permission denied or no camera - handled when user clicks start
        console.log('Could not enumerate devices:', err.message)
      }
    }
    getDevices()
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(selectedDeviceId && { deviceId: { exact: selectedDeviceId } })
        }
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      setIsActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a webcam or document camera.')
      } else {
        setError(`Camera error: ${err.message}`)
      }
    }
  }, [selectedDeviceId])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsActive(false)
  }, [stream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        onCapture?.(blob)
      }
    }, 'image/jpeg', 0.85)
  }, [onCapture])

  const handleDeviceChange = async (e) => {
    const newDeviceId = e.target.value
    setSelectedDeviceId(newDeviceId)

    // If camera is active, restart with new device
    if (isActive) {
      stopCamera()
      // Small delay to ensure stream is fully stopped
      setTimeout(async () => {
        try {
          const constraints = {
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              deviceId: { exact: newDeviceId }
            }
          }
          const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
          setStream(mediaStream)
          setIsActive(true)
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
          }
        } catch (err) {
          setError(`Failed to switch camera: ${err.message}`)
        }
      }, 100)
    }
  }

  if (error) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-3 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!isActive) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p className="mt-2 text-sm text-gray-600">Document Camera / Webcam</p>

        {devices.length > 1 && (
          <select
            value={selectedDeviceId || ''}
            onChange={handleDeviceChange}
            className="mt-3 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${devices.indexOf(device) + 1}`}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={startCamera}
          disabled={disabled}
          className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
        >
          Start Camera
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center justify-between">
            {devices.length > 1 && (
              <select
                value={selectedDeviceId || ''}
                onChange={handleDeviceChange}
                className="px-2 py-1 text-xs bg-white/20 text-white border border-white/30 rounded focus:outline-none"
              >
                {devices.map(device => (
                  <option key={device.deviceId} value={device.deviceId} className="text-black">
                    {device.label || `Camera ${devices.indexOf(device) + 1}`}
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-2 ml-auto">
              <button
                onClick={stopCamera}
                className="px-3 py-1.5 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                Stop
              </button>
              <button
                onClick={capturePhoto}
                disabled={disabled}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-500 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Capture
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Position item in view and click Capture, or use keyboard shortcut (Space)
      </p>
    </div>
  )
}
