import { motion } from 'framer-motion'
import { useAppStore } from '../store/appStore'

const stageLabels: Record<string, string> = {
  uploading: 'Uploading image...',
  generating_splat: 'Generating 3D Gaussian Splat',
  capturing: 'Capturing screenshot...',
  enhancing: 'Enhancing with AI',
}

const stageDescriptions: Record<string, string> = {
  uploading: 'Preparing your image for the pipeline',
  generating_splat:
    'SHARP model is converting your image into a 3D point cloud. This may take a few minutes.',
  capturing: 'Processing your camera angle',
  enhancing:
    'Qwen is enhancing the view using your original image as reference',
}

export default function ProcessingOverlay() {
  const { pipelineState, jobProgress } = useAppStore()
  const label = stageLabels[pipelineState]
  const description = stageDescriptions[pipelineState]

  if (!label) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-6 py-12"
    >
      {/* Animated orb */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-accent-indigo/20 animate-breathe" />
        <div className="absolute inset-2 rounded-full bg-accent-indigo/30 animate-breathe [animation-delay:0.3s]" />
        <div className="absolute inset-4 rounded-full bg-accent-indigo/40 animate-breathe [animation-delay:0.6s]" />
        <div className="absolute inset-[30%] rounded-full bg-accent-indigo animate-pulse" />
      </div>

      {/* Label */}
      <div className="text-center">
        <h3
          className="text-text-main text-lg font-semibold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {label}
        </h3>
        {description && (
          <p className="text-text-muted text-sm mt-1.5 max-w-xs">
            {description}
          </p>
        )}
      </div>

      {/* Progress text */}
      {jobProgress && (
        <motion.div
          key={jobProgress}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-3 py-1.5 rounded-md bg-surface-2 border border-border"
        >
          <p className="text-text-dim text-xs font-mono">{jobProgress}</p>
        </motion.div>
      )}
    </motion.div>
  )
}
