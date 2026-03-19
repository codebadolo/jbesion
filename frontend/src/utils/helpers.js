import { STATUS_COLORS } from './constants.js'

/**
 * Format a date string or Date object to DD/MM/YYYY.
 */
export function formatDate(date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Format a number as a French-locale currency string (MAD by default).
 */
export function formatMontant(amount, currency = 'MAD') {
  if (amount === null || amount === undefined || amount === '') return '—'
  const num = parseFloat(amount)
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: currency === 'MAD' ? 'MAD' : currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Return Tailwind CSS color classes for a given status string.
 * Returns an object: { bg, text, ring } tailwind classes.
 */
export function getStatusColor(status) {
  const color = STATUS_COLORS[status] || 'gray'

  const map = {
    gray: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      ring: 'ring-gray-500/20',
      dot: 'bg-gray-400',
    },
    yellow: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      ring: 'ring-yellow-600/20',
      dot: 'bg-yellow-400',
    },
    orange: {
      bg: 'bg-orange-50',
      text: 'text-orange-800',
      ring: 'ring-orange-600/20',
      dot: 'bg-orange-400',
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      ring: 'ring-blue-600/20',
      dot: 'bg-blue-400',
    },
    green: {
      bg: 'bg-green-50',
      text: 'text-green-800',
      ring: 'ring-green-600/20',
      dot: 'bg-green-500',
    },
    red: {
      bg: 'bg-red-50',
      text: 'text-red-800',
      ring: 'ring-red-600/20',
      dot: 'bg-red-500',
    },
  }

  return map[color] || map.gray
}

/**
 * Truncate a string to a max length, appending '…' if needed.
 */
export function truncate(str, maxLength = 40) {
  if (!str) return ''
  return str.length > maxLength ? str.slice(0, maxLength) + '…' : str
}

/**
 * Build a full name from a user object.
 */
export function getFullName(user) {
  if (!user) return '—'
  const parts = [user.first_name, user.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : user.username || user.email || '—'
}
