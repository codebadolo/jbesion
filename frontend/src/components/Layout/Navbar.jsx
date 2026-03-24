import React, { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { logoutUser, selectUser } from '../../store/authSlice.js'
import {
  fetchNotifications,
  markRead,
  markAllRead,
  selectNotifications,
  selectUnreadCount,
} from '../../store/notificationsSlice.js'
import { getFullName, formatDate } from '../../utils/helpers.js'
import { ROLE_LABELS } from '../../utils/constants.js'

const NOTIF_TYPE_ICONS = {
  SUBMITTED:              { color: 'text-blue-600',    bg: 'bg-blue-100'    },
  FAVORABLE:              { color: 'text-emerald-600', bg: 'bg-emerald-100' },
  APPROVED:               { color: 'text-green-600',  bg: 'bg-green-100'   },
  REJECTED:               { color: 'text-red-600',    bg: 'bg-red-100'     },
  CLARIFICATION_REQUEST:  { color: 'text-amber-600',  bg: 'bg-amber-100'   },
  CLARIFICATION_RESPONSE: { color: 'text-sky-600',    bg: 'bg-sky-100'     },
  IN_EXECUTION:           { color: 'text-purple-600', bg: 'bg-purple-100'  },
  DELIVERED:              { color: 'text-teal-600',   bg: 'bg-teal-100'    },
  BON_EMIS:               { color: 'text-violet-600', bg: 'bg-violet-100'  },
  BON_VALIDE:             { color: 'text-green-600',  bg: 'bg-green-100'   },
  BON_ANNULE:             { color: 'text-red-600',    bg: 'bg-red-100'     },
}

const NOTIF_TYPE_SYMBOL = {
  SUBMITTED:              '📋',
  FAVORABLE:              '✓',
  APPROVED:               '✓',
  REJECTED:               '✕',
  CLARIFICATION_REQUEST:  '?',
  CLARIFICATION_RESPONSE: '↩',
  IN_EXECUTION:           '▶',
  DELIVERED:              '✓',
  BON_EMIS:               '₣',
  BON_VALIDE:             '✓',
  BON_ANNULE:             '✕',
}

export default function Navbar({ onMenuClick, collapsed, onToggleCollapse }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector(selectUser)
  const notifications = useSelector(selectNotifications)
  const unreadCount = useSelector(selectUnreadCount)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // Fetch notifications on mount and poll every 30s
  useEffect(() => {
    if (!user) return
    dispatch(fetchNotifications())
    const interval = setInterval(() => dispatch(fetchNotifications()), 30000)
    return () => clearInterval(interval)
  }, [user, dispatch])

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNotifClick = (notif) => {
    if (!notif.is_read) dispatch(markRead(notif.id))
    setNotifOpen(false)
    if (notif.fiche_id && notif.fiche_type) {
      const path = notif.fiche_type === 'INTERNE'
        ? `/fiches-internes/${notif.fiche_id}`
        : `/fiches-externes/${notif.fiche_id}`
      navigate(path)
    }
  }

  const handleLogout = async () => {
    await dispatch(logoutUser())
    navigate('/login')
  }

  const initials = user
    ? ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      'U'
    : 'U'

  const avatarUrl = user?.avatar
    ? user.avatar.startsWith('http')
      ? user.avatar
      : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000'}${user.avatar}`
    : null

  const roleLabel = user ? ROLE_LABELS[user.role || user.role_code] || user.role || '' : ''

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left: hamburger (mobile) + title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={onMenuClick}
            aria-label="Ouvrir le menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          {/* Desktop sidebar toggle */}
          <button
            type="button"
            className="hidden lg:flex p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Développer le menu' : 'Réduire le menu'}
            title={collapsed ? 'Développer le menu' : 'Réduire le menu'}
          >
            {collapsed ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg" style={{ backgroundColor: '#37B6E9' }}>
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
            </div>
            <span className="hidden sm:block text-sm font-semibold text-gray-800 leading-tight">
              Gestion des Fiches<br />
              <span className="text-xs font-normal text-gray-500">de Besoins</span>
            </span>
          </div>
        </div>

        {/* Right: notifications + user menu */}
        <div className="flex items-center gap-2">

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white text-[10px] font-bold"
                style={{ backgroundColor: '#ef4444' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => dispatch(markAllRead())}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-400">Aucune notification</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const style = NOTIF_TYPE_ICONS[n.notification_type] || NOTIF_TYPE_ICONS.APPROVED
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleNotifClick(n)}
                          className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                        >
                          <div className={`flex-shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center ${style.bg}`}>
                            <span className={`text-xs font-bold ${style.color}`}>
                              {NOTIF_TYPE_SYMBOL[n.notification_type] || '✓'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-snug ${!n.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                              {n.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(n.created_at)}</p>
                          </div>
                          {!n.is_read && (
                            <span className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-8 w-8 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-200"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#37B6E9' }}>
                {initials}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-800 leading-tight">{getFullName(user)}</p>
              <p className="text-xs text-gray-500">{roleLabel}</p>
            </div>
            <svg className="h-4 w-4 text-gray-400 hidden sm:block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-52 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-gray-200 py-1">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{getFullName(user)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                  {roleLabel && (
                    <span className="mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: '#3475BB', backgroundColor: 'rgba(55,182,233,0.1)' }}>
                      {roleLabel}
                    </span>
                  )}
                </div>
                <Link
                  to="/profil"
                  onClick={() => setDropdownOpen(false)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  Mon profil
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                  </svg>
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>

        </div>{/* end right flex wrapper */}
      </div>
    </header>
  )
}
