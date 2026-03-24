import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  fetchNotifications,
  markRead,
  markAllRead,
  selectNotifications,
  selectUnreadCount,
  selectNotificationsLoading,
  selectNotificationsPagination,
} from '../../store/notificationsSlice.js'
import { formatDate } from '../../utils/helpers.js'

// ── Config par type ──────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  SUBMITTED: {
    label: 'Besoin soumis',
    dot:   'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
      </svg>
    ),
  },
  FAVORABLE: {
    label: 'Avis favorable',
    dot:   'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
  },
  APPROVED: {
    label: 'Accord pour exécution',
    dot:   'bg-green-500',
    badge: 'bg-green-100 text-green-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
  },
  REJECTED: {
    label: 'Rejeté',
    dot:   'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    ),
  },
  CLARIFICATION_REQUEST: {
    label: 'Clarification demandée',
    dot:   'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
      </svg>
    ),
  },
  CLARIFICATION_RESPONSE: {
    label: 'Clarification fournie',
    dot:   'bg-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
      </svg>
    ),
  },
  IN_EXECUTION: {
    label: 'En cours d\'exécution',
    dot:   'bg-purple-500',
    badge: 'bg-purple-100 text-purple-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
    ),
  },
  DELIVERED: {
    label: 'Livré / Réceptionné',
    dot:   'bg-teal-500',
    badge: 'bg-teal-100 text-teal-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
  },
  BON_EMIS: {
    label: 'Bon de paiement émis',
    dot:   'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  BON_VALIDE: {
    label: 'Bon de paiement validé',
    dot:   'bg-green-500',
    badge: 'bg-green-100 text-green-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
  },
  BON_ANNULE: {
    label: 'Bon de paiement annulé',
    dot:   'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    ),
  },
}

const FALLBACK_CFG = {
  label: 'Notification',
  dot:   'bg-gray-400',
  badge: 'bg-gray-100 text-gray-600',
  icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  ),
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function NotificationsPage() {
  const dispatch    = useDispatch()
  const navigate    = useNavigate()
  const items       = useSelector(selectNotifications)
  const unreadCount = useSelector(selectUnreadCount)
  const loading     = useSelector(selectNotificationsLoading)
  const pagination  = useSelector(selectNotificationsPagination)

  const [filterRead,   setFilterRead]   = useState('')          // '' | 'false' | 'true'
  const [filterType,   setFilterType]   = useState('')
  const [filterFiche,  setFilterFiche]  = useState('')
  const [page,         setPage]         = useState(1)
  const [pageSize,     setPageSize]     = useState(20)

  const load = useCallback(() => {
    const params = { page, page_size: pageSize }
    if (filterRead)  params.is_read          = filterRead
    if (filterType)  params.notification_type = filterType
    if (filterFiche) params.fiche_type        = filterFiche
    dispatch(fetchNotifications(params))
  }, [dispatch, page, pageSize, filterRead, filterType, filterFiche])

  useEffect(() => { load() }, [load])

  const handleClick = (notif) => {
    if (!notif.is_read) dispatch(markRead(notif.id))
    if (notif.fiche_id && notif.fiche_type) {
      navigate(
        notif.fiche_type === 'INTERNE'
          ? `/fiches-internes/${notif.fiche_id}`
          : `/fiches-externes/${notif.fiche_id}`
      )
    }
  }

  const handleMarkAllRead = async () => {
    await dispatch(markAllRead())
    load()
  }

  const resetFilters = () => {
    setFilterRead('')
    setFilterType('')
    setFilterFiche('')
    setPage(1)
  }

  const hasFilters = filterRead || filterType || filterFiche

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.count} notification{pagination.count !== 1 ? 's' : ''}
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* ── Filtres ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterRead}
          onChange={(e) => { setFilterRead(e.target.value); setPage(1) }}
          className="form-input w-44"
        >
          <option value="">Toutes (lues / non lues)</option>
          <option value="false">Non lues seulement</option>
          <option value="true">Lues seulement</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
          className="form-input w-52"
        >
          <option value="">Tous les types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={filterFiche}
          onChange={(e) => { setFilterFiche(e.target.value); setPage(1) }}
          className="form-input w-44"
        >
          <option value="">Fiches internes & externes</option>
          <option value="INTERNE">Fiches internes</option>
          <option value="EXTERNE">Fiches externes</option>
        </select>

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Liste ───────────────────────────────────────────────── */}
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-20">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-20 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <p className="text-gray-500 font-medium">Aucune notification</p>
          {hasFilters && (
            <button onClick={resetFilters} className="mt-2 text-sm text-blue-600 hover:underline">
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((notif) => {
            const cfg = TYPE_CONFIG[notif.notification_type] || FALLBACK_CFG
            const fichePath = notif.fiche_id && notif.fiche_type
              ? (notif.fiche_type === 'INTERNE'
                  ? `/fiches-internes/${notif.fiche_id}`
                  : `/fiches-externes/${notif.fiche_id}`)
              : null

            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={[
                  'group flex items-start gap-4 rounded-xl border px-5 py-4 transition-all cursor-pointer',
                  notif.is_read
                    ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    : 'border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:shadow-sm',
                ].join(' ')}
              >
                {/* Dot indicator */}
                <div className="relative flex-shrink-0 mt-0.5">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white ${cfg.dot}`}>
                    {cfg.icon}
                  </div>
                  {!notif.is_read && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      {notif.fiche_type && notif.fiche_id && (
                        <span className="text-xs font-mono text-gray-400">
                          {notif.fiche_type === 'INTERNE' ? 'FI' : 'FE'}-{String(notif.fiche_id).padStart(5, '0')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatDate(notif.created_at)}
                    </span>
                  </div>

                  <p className={`mt-1.5 text-sm leading-relaxed ${notif.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                    {notif.message}
                  </p>

                  {notif.sender_detail && (
                    <p className="mt-1 text-xs text-gray-400">
                      De : {notif.sender_detail?.first_name} {notif.sender_detail?.last_name}
                    </p>
                  )}

                  {fichePath && (
                    <p className="mt-2 text-xs text-blue-600 group-hover:underline">
                      Voir la fiche →
                    </p>
                  )}
                </div>

                {/* Mark read button */}
                {!notif.is_read && (
                  <button
                    type="button"
                    title="Marquer comme lu"
                    onClick={(e) => { e.stopPropagation(); dispatch(markRead(notif.id)) }}
                    className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────── */}
      {pagination.num_pages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Afficher</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="form-input py-1 w-20"
            >
              {[10, 20, 50].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>par page — {pagination.count} au total</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              ← Préc.
            </button>
            {Array.from({ length: pagination.num_pages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pagination.num_pages || Math.abs(p - page) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === '…' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={[
                      'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                      p === page
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(pagination.num_pages, p + 1))}
              disabled={page === pagination.num_pages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Suiv. →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
