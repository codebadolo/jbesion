import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { selectToasts, dismissToast, markRead } from '../../store/notificationsSlice.js'

const TYPE_STYLES = {
  SUBMITTED:              { bg: 'bg-blue-600',    icon: '📋' },
  FAVORABLE:              { bg: 'bg-emerald-600', icon: '✓'  },
  APPROVED:               { bg: 'bg-green-600',   icon: '✓'  },
  REJECTED:               { bg: 'bg-red-600',     icon: '✕'  },
  CLARIFICATION_REQUEST:  { bg: 'bg-amber-500',   icon: '?'  },
  CLARIFICATION_RESPONSE: { bg: 'bg-sky-600',     icon: '↩'  },
  IN_EXECUTION:           { bg: 'bg-purple-600',  icon: '▶'  },
  DELIVERED:              { bg: 'bg-teal-600',    icon: '✓'  },
}

function Toast({ notif }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const style = TYPE_STYLES[notif.notification_type] || TYPE_STYLES.APPROVED

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => dispatch(dismissToast(notif._toastId)), 6000)
    return () => clearTimeout(timer)
  }, [dispatch, notif._toastId])

  const handleClick = () => {
    dispatch(markRead(notif.id))
    if (notif.fiche_id && notif.fiche_type) {
      const path = notif.fiche_type === 'INTERNE'
        ? `/fiches-internes/${notif.fiche_id}`
        : `/fiches-externes/${notif.fiche_id}`
      navigate(path)
    }
  }

  return (
    <div
      onClick={handleClick}
      className="flex items-start gap-3 bg-white rounded-xl shadow-lg ring-1 ring-gray-200 p-4 cursor-pointer hover:shadow-xl transition-all duration-200 animate-slide-in max-w-sm w-full"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${style.bg}`}>
        {style.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
          {notif.message}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Maintenant</p>
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); dispatch(dismissToast(notif._toastId)) }}
        className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useSelector(selectToasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <Toast key={t._toastId} notif={t} />
      ))}
    </div>
  )
}
