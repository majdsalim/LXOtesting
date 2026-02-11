import type { ReactNode } from 'react'
import { useAppStore, type PipelineState } from '../store/appStore'

const steps: { key: PipelineState[]; label: string }[] = [
  { key: ['idle', 'uploading'], label: 'Upload' },
  { key: ['generating_splat'], label: 'Generate' },
  { key: ['viewing_splat', 'capturing'], label: '3D View' },
  { key: ['enhancing'], label: 'Enhance' },
  { key: ['result'], label: 'Result' },
]

function StepIndicator() {
  const { pipelineState } = useAppStore()

  const currentIdx = steps.findIndex((s) => s.key.includes(pipelineState))

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isActive = i === currentIdx
        const isCompleted = i < currentIdx
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${isActive ? 'bg-accent-indigo scale-125' : ''}
                  ${isCompleted ? 'bg-accent-indigo/50' : ''}
                  ${!isActive && !isCompleted ? 'bg-surface-2' : ''}
                `}
              />
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  isActive
                    ? 'text-text-main'
                    : isCompleted
                      ? 'text-text-muted'
                      : 'text-text-dim'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-6 h-px mx-2 transition-colors duration-300 ${
                  isCompleted ? 'bg-accent-indigo/30' : 'bg-surface-2'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-1/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-indigo to-accent-purple flex items-center justify-center">
            <span className="text-white text-xs font-bold">GS</span>
          </div>
          <div>
            <h1
              className="text-sm font-semibold text-text-main leading-none"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Gaussian Splat Test
            </h1>
            <p className="text-[10px] text-text-dim mt-0.5">Liquid XO</p>
          </div>
        </div>

        <StepIndicator />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
