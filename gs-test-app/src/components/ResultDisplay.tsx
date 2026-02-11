import { motion } from 'framer-motion'
import { useAppStore } from '../store/appStore'

export default function ResultDisplay() {
  const { enhancedImage, originalImage, screenshot, reset } = useAppStore()

  if (!enhancedImage) return null

  const handleDownload = () => {
    if (!enhancedImage) return
    const link = document.createElement('a')
    link.href = enhancedImage.startsWith('data:')
      ? enhancedImage
      : `data:image/png;base64,${enhancedImage}`
    link.download = 'enhanced_view.png'
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
              className="w-full aspect-[4/3] object-cover"
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
              className="w-full aspect-[4/3] object-cover"
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
            src={
              enhancedImage.startsWith('data:')
                ? enhancedImage
                : `data:image/png;base64,${enhancedImage}`
            }
            alt="Enhanced"
            className="w-full aspect-[4/3] object-cover"
          />
          <div className="p-3 border-t border-accent-indigo/20">
            <p className="text-accent-indigo text-xs font-medium uppercase tracking-wider">
              AI Enhanced
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
