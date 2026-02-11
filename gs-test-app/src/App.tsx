import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Layout from './components/Layout'
import ImageUpload from './components/ImageUpload'
import SplatViewer from './components/SplatViewer'
import ProcessingOverlay from './components/ProcessingOverlay'
import ResultDisplay from './components/ResultDisplay'
import ErrorBanner from './components/ErrorBanner'
import { useAppStore } from './store/appStore'
import { useRunPodJob } from './hooks/useRunPodJob'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
}

function PipelineRouter() {
  const { pipelineState } = useAppStore()
  const { generateSplat, enhanceScreenshot } = useRunPodJob()

  // Trigger the SHARP workflow when pipeline enters 'uploading'
  useEffect(() => {
    if (pipelineState === 'uploading') {
      generateSplat()
    }
  }, [pipelineState, generateSplat])

  // Trigger the Qwen workflow when screenshot is captured
  useEffect(() => {
    if (pipelineState === 'capturing') {
      enhanceScreenshot()
    }
  }, [pipelineState, enhanceScreenshot])

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <ErrorBanner />

      <AnimatePresence mode="wait">
        {/* IDLE: Upload an image */}
        {pipelineState === 'idle' && (
          <motion.div
            key="idle"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center gap-8"
          >
            <div className="text-center">
              <h2
                className="text-2xl font-bold text-text-main"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Image to 3D Gaussian Splat
              </h2>
              <p className="text-text-muted text-sm mt-2 max-w-md">
                Upload an image to generate a 3D Gaussian Splat, explore it from
                any angle, then enhance your chosen view with AI.
              </p>
            </div>
            <ImageUpload />
          </motion.div>
        )}

        {/* UPLOADING / GENERATING_SPLAT: Processing */}
        {(pipelineState === 'uploading' ||
          pipelineState === 'generating_splat') && (
          <motion.div
            key="generating"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <ProcessingOverlay />
          </motion.div>
        )}

        {/* VIEWING_SPLAT: Interactive 3D viewer */}
        {pipelineState === 'viewing_splat' && (
          <motion.div
            key="viewing"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            <SplatViewer />
          </motion.div>
        )}

        {/* CAPTURING / ENHANCING: Processing the screenshot */}
        {(pipelineState === 'capturing' || pipelineState === 'enhancing') && (
          <motion.div
            key="enhancing"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <ProcessingOverlay />
          </motion.div>
        )}

        {/* RESULT: Show enhanced image */}
        {pipelineState === 'result' && (
          <motion.div
            key="result"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            <ResultDisplay />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <Layout>
      <PipelineRouter />
    </Layout>
  )
}
