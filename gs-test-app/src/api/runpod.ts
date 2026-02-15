const API_KEY = import.meta.env.VITE_RUNPOD_API_KEY as string
const ENDPOINT_ID = import.meta.env.VITE_RUNPOD_ENDPOINT_ID as string
const BASE_URL = `https://api.runpod.ai/v2/${ENDPOINT_ID}`

export interface RunPodImage {
  filename: string
  type: 'base64' | 's3_url'
  data: string
}

export interface RunPodFile {
  filename: string
  type: 'base64' | 's3_url'
  data: string
}

export interface RunPodJobResult {
  id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  output?: {
    images?: RunPodImage[]
    files?: RunPodFile[]
    errors?: string[]
    error?: string
    status?: string
  }
  error?: string
}

export interface SubmitJobResponse {
  id: string
  status: string
}

export interface HealthResponse {
  jobs: {
    completed: number
    failed: number
    inProgress: number
    inQueue: number
  }
  workers: {
    idle: number
    running: number
    throttled: number
  }
}

/**
 * Submit an async job to the RunPod serverless endpoint.
 */
export async function submitJob(
  workflow: Record<string, unknown>,
  images?: Array<{ name: string; image: string }>
): Promise<SubmitJobResponse> {
  const response = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { workflow, images },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`RunPod API error (${response.status}): ${text}`)
  }

  return response.json()
}

/**
 * Submit a generic async job to the RunPod serverless endpoint.
 * Useful for non-Comfy handlers such as direct SHARP inference.
 */
export async function submitInputJob(
  input: Record<string, unknown>
): Promise<SubmitJobResponse> {
  const response = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`RunPod API error (${response.status}): ${text}`)
  }

  return response.json()
}

/**
 * Get the status of a job.
 */
export async function getJobStatus(jobId: string): Promise<RunPodJobResult> {
  const response = await fetch(`${BASE_URL}/status/${jobId}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`RunPod status error (${response.status}): ${text}`)
  }

  return response.json()
}

/**
 * Poll a job until it completes or fails.
 * Calls onProgress with status updates.
 */
export async function pollUntilComplete(
  jobId: string,
  onProgress?: (status: string, attempt: number) => void,
  intervalMs = 3000,
  maxAttempts = 300
): Promise<RunPodJobResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getJobStatus(jobId)
    onProgress?.(result.status, i + 1)

    if (result.status === 'COMPLETED') return result
    if (result.status === 'FAILED') {
      throw new Error(result.error || result.output?.error || 'Job failed')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Job timed out after ${maxAttempts} attempts`)
}

/**
 * Check endpoint health.
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BASE_URL}/health`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`)
  }

  return response.json()
}
