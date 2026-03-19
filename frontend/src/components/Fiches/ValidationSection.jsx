import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { validateFiche, selectFichesLoading } from '../../store/fichesSlice.js'
import StatusBadge from '../Common/StatusBadge.jsx'
import { formatDate, getFullName } from '../../utils/helpers.js'

/**
 * Shows the validation history and optionally a validation form.
 *
 * Props:
 *   fiche       – the fiche object (must have validations array and id, type)
 *   canValidate – boolean: show the approval/rejection form
 *   type        – 'interne' | 'externe'
 *   onSuccess   – callback after successful validation
 */
export default function ValidationSection({ fiche, canValidate = false, type = 'interne', onSuccess }) {
  const dispatch = useDispatch()
  const isLoading = useSelector(selectFichesLoading)

  const [action, setAction] = useState('approve')
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)

  const validations = fiche?.validations || fiche?.validation_history || []

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!action) {
      setError('Veuillez choisir une action.')
      return
    }

    try {
      await dispatch(
        validateFiche({
          id: fiche.id,
          type,
          data: { action, comment },
        }),
      ).unwrap()

      setComment('')
      setAction('approve')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Erreur lors de la validation.')
    }
  }

  return (
    <div className="space-y-6">
      {/* History */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Historique des validations
        </h3>

        {validations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
            <svg className="mx-auto h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
            <p className="text-sm text-gray-400">Aucune validation pour le moment</p>
          </div>
        ) : (
          <ol className="relative border-l border-gray-200 ml-3 space-y-4">
            {validations.map((v, idx) => {
              const isApproved = v.action === 'approve' || v.status === 'approved'
              const isRejected = v.action === 'reject' || v.status === 'rejected'
              return (
                <li key={v.id || idx} className="ml-5">
                  <span
                    className={`absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white
                      ${isApproved ? 'bg-green-500' : isRejected ? 'bg-red-500' : 'bg-yellow-400'}`}
                  >
                    {isApproved ? (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : isRejected ? (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">
                        {getFullName(v.validator || v.user) || '—'}
                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                          ({v.validator?.role_label || v.role || '—'})
                        </span>
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full
                            ${isApproved ? 'bg-green-100 text-green-700' : isRejected ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}
                        >
                          {isApproved ? 'Approuvé' : isRejected ? 'Rejeté' : 'En attente'}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(v.created_at || v.date)}</span>
                      </div>
                    </div>
                    {v.comment && (
                      <p className="mt-2 text-sm text-gray-600 italic border-l-2 border-gray-300 pl-3">
                        "{v.comment}"
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Validation form */}
      {canValidate && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
            </svg>
            Votre décision
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Action radio */}
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center gap-2.5 cursor-pointer rounded-lg border px-4 py-3 transition-colors
                  ${action === 'approve'
                    ? 'border-green-400 bg-green-50 ring-1 ring-green-400'
                    : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <input
                  type="radio"
                  name="action"
                  value="approve"
                  checked={action === 'approve'}
                  onChange={() => setAction('approve')}
                  className="accent-green-600"
                />
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className={`text-sm font-medium ${action === 'approve' ? 'text-green-800' : 'text-gray-700'}`}>
                  Approuver
                </span>
              </label>

              <label
                className={`flex-1 flex items-center gap-2.5 cursor-pointer rounded-lg border px-4 py-3 transition-colors
                  ${action === 'reject'
                    ? 'border-red-400 bg-red-50 ring-1 ring-red-400'
                    : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <input
                  type="radio"
                  name="action"
                  value="reject"
                  checked={action === 'reject'}
                  onChange={() => setAction('reject')}
                  className="accent-red-600"
                />
                <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
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
                Commentaire{action === 'reject' && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={action === 'reject' ? 'Veuillez préciser le motif du rejet...' : 'Commentaire optionnel...'}
                className="form-input resize-none"
                required={action === 'reject'}
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
                className={`btn-primary ${action === 'reject' ? '!bg-red-600 hover:!bg-red-700 focus:!ring-red-500' : ''}`}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Traitement...
                  </span>
                ) : action === 'approve' ? (
                  'Confirmer l\'approbation'
                ) : (
                  'Confirmer le rejet'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
