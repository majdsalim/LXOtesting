import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Entity } from '@playcanvas/react'
import { Camera, Script } from '@playcanvas/react/components'
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs'
import { useApp, useParent, useSplat } from '@playcanvas/react/hooks'
import type { Asset, Entity as PcEntity } from 'playcanvas'
import { useAppStore } from '../store/appStore'

interface SplatSceneProps {
  url: string
  onLoadingChange: (isLoading: boolean) => void
}

function ManualGSplat({
  asset,
}: {
  asset: Asset
}) {
  const entity = useParent() as PcEntity & {
    gsplat?: unknown
    addComponent: (name: 'gsplat', data: { asset: Asset }) => void
    removeComponent: (name: 'gsplat') => void
  }

  useEffect(() => {
    if (entity.gsplat) {
      entity.removeComponent('gsplat')
    }

    entity.addComponent('gsplat', { asset })

    return () => {
      if (entity.gsplat) {
        entity.removeComponent('gsplat')
      }
    }
  }, [entity, asset])

  return null
}

function SplatScene({ url, onLoadingChange }: SplatSceneProps) {
  const { asset, loading, error } = useSplat(url)

  useEffect(() => {
    onLoadingChange(loading)
  }, [loading, onLoadingChange])

  useEffect(() => {
    if (error) {
      console.error('[SplatScene] Failed to load splat:', error)
    }
  }, [error])

  if (!asset) return null

  return (
    <Entity name="Splat" position={[0, 0, 0]} rotation={[0, 0, 180]}>
      <ManualGSplat asset={asset} />
    </Entity>
  )
}

function FrameCapture({
  requestId,
  onCaptured,
  onCaptureFailed,
}: {
  requestId: number
  onCaptured: (dataUrl: string) => void
  onCaptureFailed: (message: string) => void
}) {
  const app = useApp()

  useEffect(() => {
    if (requestId === 0) return

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return
      app.off('frameend', handleFrameEnd)
      onCaptureFailed('Capture timed out waiting for rendered frame.')
    }, 2000)

    const handleFrameEnd = () => {
      app.off('frameend', handleFrameEnd)
      window.clearTimeout(timeoutId)
      if (cancelled) return

      try {
        const canvas = app.graphicsDevice.canvas as HTMLCanvasElement
        const dataUrl = canvas.toDataURL('image/png')
        if (!dataUrl || dataUrl === 'data:,') {
          onCaptureFailed('Capture produced an empty image.')
          return
        }
        onCaptured(dataUrl)
      } catch (error) {
        onCaptureFailed(
          error instanceof Error ? error.message : 'Unknown capture error'
        )
      }
    }

    app.on('frameend', handleFrameEnd)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      app.off('frameend', handleFrameEnd)
    }
  }, [requestId, app, onCaptured, onCaptureFailed])

  return null
}

export default function SplatViewer() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureRequestId, setCaptureRequestId] = useState(0)
  const [isSplatLoading, setIsSplatLoading] = useState(true)

  const {
    plyBlobUrl,
    originalImageAspectRatio,
    setScreenshot,
    setPipelineState,
    setError,
  } = useAppStore()

  const viewerAspectRatio =
    originalImageAspectRatio && originalImageAspectRatio > 0
      ? originalImageAspectRatio
      : 16 / 9

  const handleRequestCapture = useCallback(() => {
    setError(null)
    setIsCapturing(true)
    setCaptureRequestId((prev) => prev + 1)
  }, [setError])

  const handleCaptured = useCallback(
    (dataUrl: string) => {
      setIsCapturing(false)
      setScreenshot(dataUrl)
      setPipelineState('capturing')
    },
    [setScreenshot, setPipelineState]
  )

  const handleCaptureFailed = useCallback(
    (message: string) => {
      setIsCapturing(false)
      setError(`Failed to capture view: ${message}`)
    },
    [setError]
  )

  useEffect(() => {
    setIsSplatLoading(true)
  }, [plyBlobUrl])

  if (!plyBlobUrl) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-4xl mx-auto"
    >
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
          onClick={handleRequestCapture}
          disabled={isCapturing || isSplatLoading}
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
          {isSplatLoading ? 'Loading Splat...' : isCapturing ? 'Capturing...' : 'Capture View'}
        </button>
      </div>

      <div
        className="relative w-full rounded-xl overflow-hidden border border-border bg-black"
        style={{
          aspectRatio: String(viewerAspectRatio),
          minHeight: '360px',
          maxHeight: '72vh',
        }}
      >
        <Application graphicsDeviceOptions={{ preserveDrawingBuffer: true, alpha: false }}>
          <Entity name="Camera" position={[0, 0, -2.2]}>
            <Camera clearColor="#0d0a09" nearClip={0.01} farClip={10000} />
            <Script
              script={CameraControls}
              moveSpeed={3}
              moveFastSpeed={6}
              moveSlowSpeed={1.5}
            />
          </Entity>
          <SplatScene
            url={plyBlobUrl}
            onLoadingChange={setIsSplatLoading}
          />
          <FrameCapture
            requestId={captureRequestId}
            onCaptured={handleCaptured}
            onCaptureFailed={handleCaptureFailed}
          />
        </Application>

        {isSplatLoading && (
          <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-accent-purple/30 border-t-accent-purple animate-spin" />
              <p className="text-sm text-text-main font-medium">
                Loading 3D Gaussian Splat...
              </p>
              <p className="text-xs text-text-dim">
                Downloading and preparing PLY from storage
              </p>
            </div>
          </div>
        )}
      </div>

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
