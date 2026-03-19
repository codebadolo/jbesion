import React from 'react'
import { STATUS_LABELS } from '../../utils/constants.js'
import { getStatusColor } from '../../utils/helpers.js'

/**
 * Color-coded status badge.
 * Props:
 *   status  – one of the STATUS_LABELS keys
 *   size    – 'sm' | 'md' (default 'md')
 */
export default function StatusBadge({ status, size = 'md' }) {
  const label = STATUS_LABELS[status] || status || 'Inconnu'
  const colors = getStatusColor(status)

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset
        ${colors.bg} ${colors.text} ${colors.ring} ${sizeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
      {label}
    </span>
  )
}
