import React from 'react'

/**
 * Centered loading spinner.
 * Props:
 *   fullScreen – boolean, fills the viewport
 *   message    – optional text below the spinner
 *   size       – 'sm' | 'md' | 'lg'
 */
export default function LoadingSpinner({ fullScreen = false, message, size = 'md' }) {
  const sizeMap = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  }

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`animate-spin rounded-full border-blue-600 border-t-transparent ${sizeMap[size]}`}
        role="status"
        aria-label="Chargement..."
      />
      {message && (
        <p className="text-sm text-gray-500 font-medium">{message}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  )
}
