import { create } from 'zustand'

export type PipelineState =
  | 'idle'
  | 'uploading'
  | 'generating_splat'
  | 'viewing_splat'
  | 'capturing'
  | 'enhancing'
  | 'result'

export interface AppState {
  // Pipeline state
  pipelineState: PipelineState
  setPipelineState: (state: PipelineState) => void

  // Original uploaded image
  originalImage: string | null // base64 data URL
  originalImageName: string | null
  originalImageAspectRatio: number | null
  setOriginalImage: (
    data: string | null,
    name: string | null,
    aspectRatio?: number | null
  ) => void

  // SHARP workflow result - PLY file
  plyData: string | null // base64 encoded PLY
  plyBlobUrl: string | null
  setPlyData: (data: string | null) => void

  // Screenshot from the 3D viewer
  screenshot: string | null // base64 data URL
  setScreenshot: (data: string | null) => void

  // Qwen workflow result - enhanced image
  enhancedImage: string | null // base64 data URL
  setEnhancedImage: (data: string | null) => void

  // Job tracking
  currentJobId: string | null
  setCurrentJobId: (id: string | null) => void
  jobProgress: string
  setJobProgress: (msg: string) => void

  // Error state
  error: string | null
  setError: (error: string | null) => void

  // Reset everything
  reset: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  pipelineState: 'idle',
  setPipelineState: (state) => set({ pipelineState: state, error: null }),

  originalImage: null,
  originalImageName: null,
  originalImageAspectRatio: null,
  setOriginalImage: (data, name, aspectRatio = null) =>
    set({
      originalImage: data,
      originalImageName: name,
      originalImageAspectRatio: aspectRatio,
    }),

  plyData: null,
  plyBlobUrl: null,
  setPlyData: (data) => {
    // Revoke previous blob URL if any (only revoke blob: URLs, not S3 URLs)
    const prev = get().plyBlobUrl
    if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)

    if (data) {
      // If data is already a URL (S3 presigned URL), use it directly
      if (data.startsWith('http://') || data.startsWith('https://')) {
        set({ plyData: data, plyBlobUrl: data })
      } else {
        // Assume base64 — convert to blob URL for PlayCanvas
        const binary = atob(data)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        set({ plyData: data, plyBlobUrl: url })
      }
    } else {
      set({ plyData: null, plyBlobUrl: null })
    }
  },

  screenshot: null,
  setScreenshot: (data) => set({ screenshot: data }),

  enhancedImage: null,
  setEnhancedImage: (data) => set({ enhancedImage: data }),

  currentJobId: null,
  setCurrentJobId: (id) => set({ currentJobId: id }),
  jobProgress: '',
  setJobProgress: (msg) => set({ jobProgress: msg }),

  error: null,
  setError: (error) => set({ error }),

  reset: () => {
    const prev = get().plyBlobUrl
    if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
    set({
      pipelineState: 'idle',
      originalImage: null,
      originalImageName: null,
      originalImageAspectRatio: null,
      plyData: null,
      plyBlobUrl: null,
      screenshot: null,
      enhancedImage: null,
      currentJobId: null,
      jobProgress: '',
      error: null,
    })
  },
}))
