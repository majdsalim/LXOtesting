const FAL_API_KEY = import.meta.env.VITE_FAL_API_KEY as string
const FAL_QWEN_ENDPOINT =
  (import.meta.env.VITE_FAL_QWEN_ENDPOINT as string) ||
  'https://fal.run/fal-ai/qwen-image-edit-2509-lora'

interface FalLoraConfig {
  path: string
}

interface FalQwenRequest {
  prompt: string
  num_inference_steps: number
  guidance_scale: number
  num_images: number
  enable_safety_checker: boolean
  output_format: 'png' | 'jpeg' | 'webp'
  image_urls: string[]
  negative_prompt: string
  acceleration: 'regular'
  loras: FalLoraConfig[]
}

interface FalImageResult {
  url?: string
}

interface FalQwenResponse {
  images?: FalImageResult[]
}

const FAL_GAUSSIAN_PROMPT =
  '高斯泼溅,参考图2的场景图，修复图1的场景图透视并修复空白区域'

const FAL_LORAS: FalLoraConfig[] = [
  {
    path: 'https://huggingface.co/dx8152/Qwen-Image-Edit-2511-Gaussian-Splash/resolve/main/%E9%AB%98%E6%96%AF%E6%B3%BC%E6%BA%85-Sharp.safetensors',
  },
  {
    path: 'https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors',
  },
]

function extractImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const response = payload as FalQwenResponse
  const firstImage = response.images?.[0]
  if (!firstImage) return null
  return firstImage.url || null
}

export async function enhanceWithFal(
  capturedImageUrl: string,
  originalImageUrl: string
): Promise<{ imageUrl: string }> {
  if (!FAL_API_KEY) {
    throw new Error('Missing VITE_FAL_API_KEY in environment variables.')
  }

  const requestBody: FalQwenRequest = {
    prompt: FAL_GAUSSIAN_PROMPT,
    num_inference_steps: 10,
    guidance_scale: 1,
    num_images: 1,
    enable_safety_checker: true,
    output_format: 'png',
    image_urls: [capturedImageUrl, originalImageUrl],
    negative_prompt: ' ',
    acceleration: 'regular',
    loras: FAL_LORAS,
  }

  const response = await fetch(FAL_QWEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`fal.ai API error (${response.status}): ${text}`)
  }

  const payload = (await response.json()) as unknown
  const imageUrl = extractImageUrl(payload)
  if (!imageUrl) {
    throw new Error(
      `fal.ai response did not include images[0].url. Response: ${JSON.stringify(payload)}`
    )
  }

  return { imageUrl }
}
