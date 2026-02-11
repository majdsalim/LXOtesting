import { useCallback } from 'react'
import { submitJob, pollUntilComplete } from '../api/runpod'
import { prepareSHARPWorkflow, prepareQwenWorkflow } from '../utils/workflow'
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
 * 1. Upload image → SHARP workflow → get PLY
 * 2. Capture screenshot → Qwen workflow → get enhanced image
 */
export function useRunPodJob() {
  const store = useAppStore()

  /**
   * Step 1: Send the uploaded image through the SHARP workflow to generate a .ply file.
   */
  const generateSplat = useCallback(async () => {
    const { originalImage, originalImageName } = useAppStore.getState()
    if (!originalImage || !originalImageName) return

    try {
      store.setPipelineState('generating_splat')
      store.setJobProgress('Submitting to RunPod...')

      // Prepare the workflow with the image filename
      const uploadName = 'gs_input.png'
      const workflow = prepareSHARPWorkflow(uploadName)

      // Submit the job with the image
      const base64Data = stripDataUrlPrefix(originalImage)
      const result = await submitJob(workflow, [
        { name: uploadName, image: base64Data },
      ])

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
   * Step 2: Send the screenshot + original image through the Qwen workflow.
   */
  const enhanceScreenshot = useCallback(async () => {
    const { screenshot, originalImage } = useAppStore.getState()
    if (!screenshot || !originalImage) return

    try {
      store.setPipelineState('enhancing')
      store.setJobProgress('Submitting enhancement job...')

      const screenshotName = 'gs_screenshot.png'
      const originalName = 'gs_original.png'

      // Prepare Qwen workflow
      const workflow = prepareQwenWorkflow(screenshotName, originalName)

      // Upload both images
      const screenshotBase64 = stripDataUrlPrefix(screenshot)
      const originalBase64 = stripDataUrlPrefix(originalImage)

      const result = await submitJob(workflow, [
        { name: screenshotName, image: screenshotBase64 },
        { name: originalName, image: originalBase64 },
      ])

      store.setCurrentJobId(result.id)
      store.setJobProgress(`Enhancement job ${result.id} submitted. Waiting...`)

      // Poll until complete
      const completed = await pollUntilComplete(
        result.id,
        (status, attempt) => {
          store.setJobProgress(`Status: ${status} (poll #${attempt})`)
        }
      )

      // Extract the enhanced image
      const images = completed.output?.images
      if (images && images.length > 0) {
        const imgData = images[0].data
        const enhancedDataUrl = imgData.startsWith('data:')
          ? imgData
          : `data:image/png;base64,${imgData}`
        store.setEnhancedImage(enhancedDataUrl)
        store.setPipelineState('result')
        store.setJobProgress('')
      } else {
        throw new Error(
          'Enhancement completed but no image was returned. ' +
            (completed.output?.errors?.join('; ') || 'Unknown error')
        )
      }
    } catch (err) {
      console.error('enhanceScreenshot error:', err)
      store.setError(err instanceof Error ? err.message : String(err))
      store.setPipelineState('viewing_splat')
    }
  }, [store])

  return { generateSplat, enhanceScreenshot }
}
