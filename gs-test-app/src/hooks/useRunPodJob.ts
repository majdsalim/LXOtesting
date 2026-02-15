import { useCallback } from 'react'
import { submitInputJob, pollUntilComplete } from '../api/runpod'
import { enhanceWithFal } from '../api/fal'
import { useAppStore } from '../store/appStore'

/**
 * Extracts the base64 data from a data URL.
 * "data:image/png;base64,ABC123" → "ABC123"
 */
function stripDataUrlPrefix(dataUrl: string): string {
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1]
  }
  return dataUrl
}

/**
 * Hook that manages the full pipeline:
 * 1. Upload image → direct SHARP endpoint → get PLY
 * 2. Capture screenshot → fal.ai Qwen endpoint → get enhanced image
 */
export function useRunPodJob() {
  const store = useAppStore()

  /**
   * Step 1: Send uploaded image to direct SHARP endpoint to generate a .ply file.
   */
  const generateSplat = useCallback(async () => {
    const { originalImage, originalImageName } = useAppStore.getState()
    if (!originalImage || !originalImageName) return

    try {
      store.setPipelineState('generating_splat')
      store.setJobProgress('Submitting to SHARP endpoint...')

      const base64Data = stripDataUrlPrefix(originalImage)
      const result = await submitInputJob({
        mode: 'sharp_predict',
        image_base64: base64Data,
        image_name: originalImageName || 'gs_input.png',
      })

      store.setCurrentJobId(result.id)
      store.setJobProgress(`Job ${result.id} submitted. Waiting...`)

      // Poll until complete
      const completed = await pollUntilComplete(
        result.id,
        (status, attempt) => {
          store.setJobProgress(`Status: ${status} (poll #${attempt})`)
        }
      )

      // Extract PLY file from the response
      const files = completed.output?.files
      const images = completed.output?.images

      // Look for .ply file in files output
      const plyFile = files?.find((f) => f.filename.endsWith('.ply'))

      if (plyFile) {
        store.setPlyData(plyFile.data)
        store.setPipelineState('viewing_splat')
        store.setJobProgress('')
      } else if (images && images.length > 0) {
        // Fallback: maybe the PLY is returned as an "image" (handler treats all files the same)
        const plyImage = images.find((img) => img.filename.endsWith('.ply'))
        if (plyImage) {
          store.setPlyData(plyImage.data)
          store.setPipelineState('viewing_splat')
          store.setJobProgress('')
        } else {
          throw new Error(
            'Workflow completed but no .ply file was found in the output. ' +
              `Got ${images.length} image(s) and ${files?.length ?? 0} file(s).`
          )
        }
      } else {
        throw new Error(
          'Workflow completed but produced no outputs. ' +
            (completed.output?.errors?.join('; ') || 'Unknown error')
        )
      }
    } catch (err) {
      console.error('generateSplat error:', err)
      store.setError(err instanceof Error ? err.message : String(err))
      store.setPipelineState('idle')
    }
  }, [store])

  /**
   * Step 2: Send screenshot + original image to fal.ai Qwen endpoint.
   */
  const enhanceScreenshot = useCallback(async () => {
    const { screenshot, originalImage } = useAppStore.getState()
    if (!screenshot || !originalImage) return

    try {
      store.setPipelineState('enhancing')
      store.setJobProgress('Submitting enhancement job')

      const { imageUrl } = await enhanceWithFal(screenshot, originalImage)
      store.setEnhancedImage(imageUrl)
      store.setPipelineState('result')
      store.setJobProgress('')
    } catch (err) {
      console.error('enhanceScreenshot error:', err)
      store.setError(err instanceof Error ? err.message : String(err))
      store.setPipelineState('viewing_splat')
    }
  }, [store])

  return { generateSplat, enhanceScreenshot }
}
