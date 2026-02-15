import { useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'

export default function ImageUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    originalImage,
    originalImageName,
    originalImageAspectRatio,
    setOriginalImage,
    setPipelineState,
  } = useAppStore()

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        useAppStore.getState().setError('Please upload an image file')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const img = new Image()
        img.onload = () => {
          const aspectRatio =
            img.width > 0 && img.height > 0 ? img.width / img.height : null
          setOriginalImage(dataUrl, file.name, aspectRatio)
        }
        img.onerror = () => {
          setOriginalImage(dataUrl, file.name, null)
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    },
    [setOriginalImage]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleClick = () => fileInputRef.current?.click()

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleGenerate = () => {
    if (originalImage) {
      setPipelineState('uploading')
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <AnimatePresence mode="wait">
        {!originalImage ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`
              relative w-full max-w-md aspect-[4/3] rounded-xl border-2 border-dashed
              flex flex-col items-center justify-center gap-3 cursor-pointer
              transition-all duration-200
              ${
                isDragging
                  ? 'border-accent-indigo bg-accent-indigo/10 scale-[1.02]'
                  : 'border-border hover:border-text-dim hover:bg-surface-1/50'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />

            {/* Upload Icon */}
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isDragging ? 'bg-accent-indigo/20' : 'bg-surface-2'
              }`}
            >
              <svg
                className={`w-6 h-6 ${isDragging ? 'text-accent-indigo' : 'text-text-muted'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>

            <div className="text-center px-4">
              <p className="text-text-main text-sm font-medium">
                {isDragging ? 'Drop image here' : 'Drag & drop an image'}
              </p>
              <p className="text-text-dim text-xs mt-1">
                or click to browse
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-md"
          >
            <div
              className="relative rounded-xl overflow-hidden border border-border bg-black"
              style={{
                aspectRatio:
                  originalImageAspectRatio && originalImageAspectRatio > 0
                    ? String(originalImageAspectRatio)
                    : '4 / 3',
              }}
            >
              <img
                src={originalImage}
                alt="Uploaded"
                className="w-full h-full object-contain"
              />

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOriginalImage(null, null)
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-bg/80 backdrop-blur-sm
                           border border-border flex items-center justify-center
                           hover:bg-error/20 hover:border-error/50 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="text-text-dim text-xs mt-2 text-center truncate">
              {originalImageName}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Button */}
      <AnimatePresence>
        {originalImage && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            onClick={handleGenerate}
            className="px-6 py-2.5 rounded-lg font-medium text-sm
                       bg-accent-indigo hover:bg-accent-indigo/80
                       text-white transition-colors duration-200
                       shadow-lg shadow-accent-indigo/20"
          >
            Generate 3D Splat
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
