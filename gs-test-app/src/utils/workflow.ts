import sharpWorkflowJson from '../workflows/Gaussiansplt_simple_sharp.json'
import qwenWorkflowJson from '../workflows/Gaussiansplt_simple_qwen.json'

type WorkflowJson = Record<string, Record<string, unknown>>

/**
 * Prepare the SHARP workflow for submission.
 * Sets the LoadImage node (213) to use the uploaded image filename.
 */
export function prepareSHARPWorkflow(
  imageName: string
): Record<string, unknown> {
  const workflow = JSON.parse(JSON.stringify(sharpWorkflowJson)) as WorkflowJson

  // Node 213 is the LoadImage node ("to sharp input image")
  if (workflow['213']?.inputs) {
    ;(workflow['213'].inputs as Record<string, unknown>).image = imageName
  }

  return workflow
}

/**
 * Prepare the Qwen workflow for submission.
 * Sets both LoadImage nodes:
 * - Node 229 ("to qwen input image") = the screenshot to fix (image1)
 * - Node 213 ("to sharp input image") = the original reference (image2)
 */
export function prepareQwenWorkflow(
  screenshotName: string,
  originalName: string
): Record<string, unknown> {
  const workflow = JSON.parse(JSON.stringify(qwenWorkflowJson)) as WorkflowJson

  // Node 229 = screenshot (image1 - the splat view to enhance)
  if (workflow['229']?.inputs) {
    ;(workflow['229'].inputs as Record<string, unknown>).image = screenshotName
  }

  // Node 213 = original reference (image2)
  if (workflow['213']?.inputs) {
    ;(workflow['213'].inputs as Record<string, unknown>).image = originalName
  }

  return workflow
}
