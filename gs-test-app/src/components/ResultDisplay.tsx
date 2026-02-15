import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'

export default function ResultDisplay() {
  const {
    enhancedImage,
    originalImage,
    screenshot,
    originalImageAspectRatio,
    setPipelineState,
    reset,
  } = useAppStore()
  const [expandedImage, setExpandedImage] = useState<{
    src: string
    label: string
  } | null>(null)

  if (!enhancedImage) return null

  const imageAspectRatio = useMemo(() => {
    if (!originalImageAspectRatio || originalImageAspectRatio <= 0) return '4 / 3'
    return String(originalImageAspectRatio)
  }, [originalImageAspectRatio])

  const handleDownload = () => {
    if (!enhancedImage) return
    const link = document.createElement('a')
    link.href = enhancedImage
    link.download = 'enhanced_view.png'
    // For cross-origin S3 URLs, open in a new tab instead
    if (enhancedImage.startsWith('http')) {
      link.target = '_blank'
    }
    link.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-xl font-semibold text-text-main"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          AI Enhanced View
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setPipelineState('viewing_splat')}
            className="px-4 py-2 rounded-lg text-sm font-medium
                       bg-surface-2 hover:bg-surface-2/80 border border-border
                       text-text-main transition-colors"
          >
            Back to 3D Viewer
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-lg text-sm font-medium
                       bg-accent-indigo hover:bg-accent-indigo/80
                       text-white transition-colors"
          >
            Download
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-medium
                       bg-surface-2 hover:bg-surface-2/80 border border-border
                       text-text-muted hover:text-text-main transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Original */}
        <div className="rounded-xl overflow-hidden border border-border bg-surface-1">
          {originalImage && (
            <img
              src={originalImage}
              alt="Original"
              onClick={() =>
                setExpandedImage({ src: originalImage, label: 'Original' })
              }
              className="w-full object-contain cursor-zoom-in bg-black"
              style={{ aspectRatio: imageAspectRatio }}
            />
          )}
          <div className="p-3 border-t border-border">
            <p className="text-text-dim text-xs font-medium uppercase tracking-wider">
              Original
            </p>
          </div>
        </div>

        {/* Screenshot */}
        <div className="rounded-xl overflow-hidden border border-border bg-surface-1">
          {screenshot && (
            <img
              src={screenshot}
              alt="3D View"
              onClick={() =>
                setExpandedImage({ src: screenshot, label: '3D Splat View' })
              }
              className="w-full object-contain cursor-zoom-in bg-black"
              style={{ aspectRatio: imageAspectRatio }}
            />
          )}
          <div className="p-3 border-t border-border">
            <p className="text-text-dim text-xs font-medium uppercase tracking-wider">
              3D Splat View
            </p>
          </div>
        </div>

        {/* Enhanced */}
        <div className="rounded-xl overflow-hidden border border-accent-indigo/30 bg-surface-1 ring-1 ring-accent-indigo/20">
          <img
            src={enhancedImage}
            alt="Enhanced"
            crossOrigin="anonymous"
            onClick={() =>
              setExpandedImage({ src: enhancedImage, label: 'AI Enhanced' })
            }
            className="w-full object-contain cursor-zoom-in bg-black"
            style={{ aspectRatio: imageAspectRatio }}
          />
          <div className="p-3 border-t border-accent-indigo/20">
            <p className="text-accent-indigo text-xs font-medium uppercase tracking-wider">
              AI Enhanced
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedImage(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-6xl max-h-[90vh] rounded-xl border border-border bg-surface-1 p-3"
            >
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full
                           bg-black/70 border border-border text-white
                           hover:bg-black transition-colors flex items-center justify-center"
                aria-label="Close full image"
              >
                ×
              </button>
              <img
                src={expandedImage.src}
                alt={expandedImage.label}
                className="w-full max-h-[82vh] object-contain rounded-lg bg-black"
              />
              <p className="text-text-dim text-xs mt-2 text-center uppercase tracking-wider">
                {expandedImage.label}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
