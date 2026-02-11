import { useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Entity } from '@playcanvas/react'
import { Camera, GSplat, Script } from '@playcanvas/react/components'
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs'
import { useSplat } from '@playcanvas/react/hooks'
import { useAppStore } from '../store/appStore'

interface SplatSceneProps {
  url: string
}

function SplatScene({ url }: SplatSceneProps) {
  const { asset } = useSplat(url)

  if (!asset) {
    return null
  }

  return (
    <Entity name="Splat" position={[0, 0, 0]}>
      <GSplat asset={asset} />
    </Entity>
  )
}

export default function SplatViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const { plyBlobUrl, setScreenshot, setPipelineState } = useAppStore()

  const handleScreenshot = useCallback(() => {
    // Find the canvas element inside our container
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) {
      console.error('Could not find PlayCanvas canvas element')
      return
    }

    setIsCapturing(true)

    // Small delay to ensure the current frame is rendered
    requestAnimationFrame(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png')
        setScreenshot(dataUrl)
        setPipelineState('capturing')
      } catch (err) {
        console.error('Failed to capture screenshot:', err)
        useAppStore.getState().setError('Failed to capture screenshot')
      } finally {
        setIsCapturing(false)
      }
    })
  }, [setScreenshot, setPipelineState])

  if (!plyBlobUrl) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-lg font-semibold text-text-main"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            3D Gaussian Splat
          </h2>
          <p className="text-text-dim text-xs mt-0.5">
            Orbit, pan, and zoom to find a new angle. Then capture it.
          </p>
        </div>

        <button
          onClick={handleScreenshot}
          disabled={isCapturing}
          className="px-5 py-2.5 rounded-lg font-medium text-sm
                     bg-accent-purple hover:bg-accent-purple/80
                     text-white transition-colors duration-200
                     shadow-lg shadow-accent-purple/20
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
            />
          </svg>
          {isCapturing ? 'Capturing...' : 'Capture View'}
        </button>
      </div>

      {/* Viewer */}
      <div
        ref={containerRef}
        className="splat-canvas relative w-full rounded-xl overflow-hidden border border-border bg-black"
        style={{ height: '500px' }}
      >
        <Application
          graphicsDeviceOptions={{ antialias: false }}
        >
          <Entity name="Camera" position={[0, 1, 3]}>
            <Camera clearColor={[0.05, 0.04, 0.035, 1]} />
            <Script script={CameraControls} />
          </Entity>
          <SplatScene url={plyBlobUrl} />
        </Application>
      </div>

      {/* Controls hint */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <span className="text-text-dim text-xs flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono">
            LMB
          </kbd>
          Orbit
        </span>
        <span className="text-text-dim text-xs flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono">
            RMB
          </kbd>
          Pan
        </span>
        <span className="text-text-dim text-xs flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono">
            Scroll
          </kbd>
          Zoom
        </span>
      </div>
    </motion.div>
  )
}
