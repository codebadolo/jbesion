import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  validateFiche,
  respondClarification,
  selectFichesLoading,
} from '../../store/fichesSlice.js'
import { formatDate, getFullName } from '../../utils/helpers.js'
import { ROLE_LABELS, CLARIFICATION_STATUSES } from '../../utils/constants.js'

const VALIDATION_STATUS_CONFIG = {
  FAVORABLE: {
    label: 'Favorable',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: 'check',
  },
  APPROVED: {
    label: 'Approuvé',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
    icon: 'check',
  },
  REJECTED: {
    label: 'Rejeté',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    icon: 'x',
  },
  CLARIFICATION_REQUESTED: {
    label: 'Clarification demandée',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    icon: 'question',
  },
  CLARIFICATION_RESPONDED: {
    label: 'Clarification fournie',
    dot: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    icon: 'reply',
  },
}

function ValidationIcon({ type, className }) {
  if (type === 'check') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    )
  }
  if (type === 'x') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    )
  }
  if (type === 'question') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
      </svg>
    )
  }
  if (type === 'reply') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
      </svg>
    )
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-white" />
}

/**
 * Shows the full validation history and the appropriate action form.
 *
 * Props:
 *   fiche       – the fiche object (must include validation_history array)
 *   canValidate – boolean: show approve/reject/clarification form
 *   type        – 'interne' | 'externe'
 *   userRole    – current user's role
 *   onSuccess   – callback after successful action
 */
export default function ValidationSection({
  fiche,
  canValidate = false,
  type = 'interne',
  userRole,
  onSuccess,
}) {
  const dispatch = useDispatch()
  const isLoading = useSelector(selectFichesLoading)

  const [action, setAction] = useState('approve')
  const [comment, setComment] = useState('')
  const [clarificationResponse, setClarificationResponse] = useState('')
  const [error, setError] = useState(null)

  const validations = fiche?.validation_history || []
  const ficheStatus = fiche?.status || ''

  const canRespondClarification =
    CLARIFICATION_STATUSES.includes(ficheStatus) &&
    (userRole === 'MANAGER' || userRole === 'ADMIN')

  const canRequestClarification =
    (ficheStatus === 'PENDING_DAF' && userRole === 'DAF') ||
    (ficheStatus === 'PENDING_DIRECTOR' && (userRole === 'DIRECTOR' || userRole === 'DAF'))

  // Manager's approve button label
  const approveLabel =
    ficheStatus === 'PENDING_MANAGER' ? 'Marquer Favorable' : 'Approuver'

  const handleValidate = async (e) => {
    e.preventDefault()
    setError(null)

    if ((action === 'reject' || action === 'request_clarification') && !comment.trim()) {
      setError(
        action === 'reject'
          ? 'Veuillez préciser le motif du rejet.'
          : 'Veuillez saisir votre demande de clarification.',
      )
      return
    }

    try {
      await dispatch(
        validateFiche({
          id: fiche.id,
          type,
          data: { action, commentaire: comment },
        }),
      ).unwrap()
      setComment('')
      setAction('approve')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Erreur lors de la validation.')
    }
  }

  const handleRespondClarification = async (e) => {
    e.preventDefault()
    setError(null)

    if (!clarificationResponse.trim()) {
      setError('Veuillez saisir votre réponse.')
      return
    }

    try {
      await dispatch(
        respondClarification({
          id: fiche.id,
          type,
          data: { commentaire: clarificationResponse },
        }),
      ).unwrap()
      setClarificationResponse('')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Erreur lors de la réponse.')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── History ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Historique complet
        </h3>

        {validations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
            <svg className="mx-auto h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
            <p className="text-sm text-gray-400">Aucune action de validation pour le moment</p>
          </div>
        ) : (
          <ol className="relative border-l-2 border-gray-200 ml-3 space-y-4">
            {validations.map((v, idx) => {
              const cfg = VALIDATION_STATUS_CONFIG[v.status] || {
                label: v.status_display || v.status,
                dot: 'bg-gray-400',
                badge: 'bg-gray-100 text-gray-600',
                icon: null,
              }
              const validatorName = getFullName(v.validator_detail) || '—'
              const roleLabel =
                ROLE_LABELS[v.role_at_validation] || v.role_at_validation || '—'

              return (
                <li key={v.id || idx} className="ml-5 relative">
                  <span
                    className={`absolute -left-[1.65rem] top-3 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white ${cfg.dot}`}
                  >
                    <ValidationIcon type={cfg.icon} className="h-3 w-3 text-white" />
                  </span>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {validatorName}
                          <span className="ml-1.5 text-xs font-normal text-gray-500">
                            ({roleLabel})
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(v.date_validation)}
                        </span>
                      </div>
                    </div>
                    {v.commentaire && (
                      <p className="mt-2 text-sm text-gray-600 italic border-l-2 border-gray-300 pl-3 whitespace-pre-wrap">
                        "{v.commentaire}"
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* ── Clarification response form (Manager) ───────────────── */}
      {canRespondClarification && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <h3 className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
            <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            Répondre à la demande de clarification
          </h3>
          <p className="text-xs text-amber-700 mb-4">
            Une clarification a été demandée. Répondez au nom du collaborateur pour que la fiche reprenne son circuit de validation.
          </p>
          <form onSubmit={handleRespondClarification} className="space-y-3">
            <textarea
              value={clarificationResponse}
              onChange={(e) => setClarificationResponse(e.target.value)}
              rows={4}
              placeholder="Fournissez les informations demandées ici..."
              className="form-input resize-none"
              required
            />
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{ backgroundColor: '#d97706' }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Envoi...
                  </span>
                ) : (
                  'Envoyer la réponse'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Validation form (DAF / DG / Manager) ────────────────── */}
      {canValidate && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
            </svg>
            Votre décision
          </h3>

          <form onSubmit={handleValidate} className="space-y-4">
            {/* Action radio buttons */}
            <div className={`grid gap-2 ${canRequestClarification ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {/* Approve / Favorable */}
              <label
                className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-3 py-2.5 transition-colors
                  ${action === 'approve'
                    ? 'border-green-400 bg-green-50 ring-1 ring-green-400'
                    : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <input
                  type="radio" name="action" value="approve"
                  checked={action === 'approve'}
                  onChange={() => setAction('approve')}
                  className="accent-green-600"
                />
                <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className={`text-sm font-medium ${action === 'approve' ? 'text-green-800' : 'text-gray-700'}`}>
                  {approveLabel}
                </span>
              </label>

              {/* Request clarification (only for DAF/DG) */}
              {canRequestClarification && (
                <label
                  className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-3 py-2.5 transition-colors
                    ${action === 'request_clarification'
                      ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
                      : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                  <input
                    type="radio" name="action" value="request_clarification"
                    checked={action === 'request_clarification'}
                    onChange={() => setAction('request_clarification')}
                    className="accent-amber-600"
                  />
                  <svg className="h-4 w-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                  <span className={`text-sm font-medium ${action === 'request_clarification' ? 'text-amber-800' : 'text-gray-700'}`}>
                    Clarification
                  </span>
                </label>
              )}

              {/* Reject */}
              <label
                className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-3 py-2.5 transition-colors
                  ${action === 'reject'
                    ? 'border-red-400 bg-red-50 ring-1 ring-red-400'
                    : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <input
                  type="radio" name="action" value="reject"
                  checked={action === 'reject'}
                  onChange={() => setAction('reject')}
                  className="accent-red-600"
                />
                <svg className="h-4 w-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                <span className={`text-sm font-medium ${action === 'reject' ? 'text-red-800' : 'text-gray-700'}`}>
                  Rejeter
                </span>
              </label>
            </div>

            {/* Comment */}
            <div>
              <label className="form-label">
                {action === 'approve' ? 'Commentaire (optionnel)' : 'Commentaire'}
                {action !== 'approve' && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={
                  action === 'reject'
                    ? 'Veuillez préciser le motif du rejet...'
                    : action === 'request_clarification'
                    ? 'Décrivez précisément les informations manquantes...'
                    : 'Commentaire optionnel...'
                }
                className="form-input resize-none"
                required={action !== 'approve'}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className={`btn-primary ${
                  action === 'reject'
                    ? '!bg-red-600 hover:!bg-red-700 focus:!ring-red-500'
                    : action === 'request_clarification'
                    ? '!bg-amber-600 hover:!bg-amber-700 focus:!ring-amber-500'
                    : ''
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Traitement...
                  </span>
                ) : action === 'approve' ? (
                  `Confirmer — ${approveLabel}`
                ) : action === 'reject' ? (
                  'Confirmer le rejet'
                ) : (
                  'Envoyer la demande de clarification'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
