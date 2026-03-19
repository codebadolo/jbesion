import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchFicheById,
  submitFiche,
  selectCurrentFiche,
  selectFichesLoading,
  selectFichesError,
  clearCurrentFiche,
} from '../../store/fichesSlice.js'
import { selectUser } from '../../store/authSlice.js'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'
import ItemsTable from '../../components/Fiches/ItemsTable.jsx'
import ValidationSection from '../../components/Fiches/ValidationSection.jsx'
import { formatDate, getFullName, formatMontant } from '../../utils/helpers.js'
import { VALIDATION_ROLES, ROLE_LABELS } from '../../utils/constants.js'

export default function FicheDetail({ type }) {
  const { id } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const fiche = useSelector(selectCurrentFiche)
  const isLoading = useSelector(selectFichesLoading)
  const error = useSelector(selectFichesError)
  const user = useSelector(selectUser)

  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Infer type from fiche if not passed as prop
  const ficheType = type || fiche?.type || 'interne'

  useEffect(() => {
    dispatch(fetchFicheById({ id, type: ficheType }))
    return () => {
      dispatch(clearCurrentFiche())
    }
  }, [id, ficheType, dispatch])

  const userRole = user?.role || user?.role_code
  const isOwner = fiche?.created_by?.id === user?.id || fiche?.user?.id === user?.id
  const isDraft = fiche?.status === 'DRAFT'

  // Can user validate this fiche at its current stage?
  const requiredRole = VALIDATION_ROLES[fiche?.status]
  const canValidate = requiredRole && (userRole === requiredRole || userRole === 'ADMIN')

  const handleSubmit = async () => {
    setSubmitError(null)
    setSubmitLoading(true)
    try {
      await dispatch(submitFiche({ id, type: ficheType })).unwrap()
    } catch (err) {
      setSubmitError(typeof err === 'string' ? err : 'Erreur lors de la soumission.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (isLoading && !fiche) return <LoadingSpinner message="Chargement de la fiche..." />

  if (error && !fiche) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-base font-semibold text-gray-800">Fiche introuvable</h2>
          <p className="text-sm text-gray-500 mt-1">{typeof error === 'string' ? error : "Cette fiche n'existe pas ou vous n'y avez pas acc\u00e8s."}</p>
        </div>
        <Link to="/fiches" className="btn-secondary">
          ← Retour à la liste
        </Link>
      </div>
    )
  }

  if (!fiche) return null

  const items = fiche.items || []
  const isExterne = ficheType === 'externe'

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <span className="text-xs text-gray-400 font-mono">
              #{fiche.numero || fiche.id}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full
              ${isExterne ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'}`}>
              {isExterne ? 'Externe' : 'Interne'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Fiche de Besoin {isExterne ? 'Externe' : 'Interne'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Créée le {formatDate(fiche.created_at)} par {getFullName(fiche.created_by || fiche.user)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={fiche.status} />
          {isDraft && isOwner && (
            <Link
              to={`/fiches/create?edit=${id}&type=${ficheType}`}
              className="btn-secondary text-xs py-1.5"
            >
              <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
              Modifier
            </Link>
          )}
          {isDraft && isOwner && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitLoading}
              className="btn-primary text-xs py-1.5"
            >
              {submitLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Soumission...
                </span>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                  Soumettre
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Details card */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Informations générales</h2>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Créé par</p>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">
                {((fiche.created_by?.first_name?.[0] || fiche.user?.first_name?.[0] || '') +
                  (fiche.created_by?.last_name?.[0] || fiche.user?.last_name?.[0] || '')).toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {getFullName(fiche.created_by || fiche.user)}
                </p>
                <p className="text-xs text-gray-400">
                  {ROLE_LABELS[fiche.created_by?.role || fiche.user?.role] || '—'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Département</p>
            <p className="text-sm text-gray-800">
              {fiche.department?.name ||
                fiche.created_by?.department?.name ||
                fiche.user?.department?.name ||
                '—'}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Date de création</p>
            <p className="text-sm text-gray-800">{formatDate(fiche.created_at)}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Dernière mise à jour</p>
            <p className="text-sm text-gray-800">{formatDate(fiche.updated_at)}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Statut</p>
            <StatusBadge status={fiche.status} size="sm" />
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Nombre d'articles</p>
            <p className="text-sm text-gray-800">{items.length}</p>
          </div>
        </div>

        {fiche.notes && (
          <div className="px-6 pb-5 border-t border-gray-50 pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {fiche.notes}
            </p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Articles ({items.length})
          </h2>
          {isExterne && items.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>
                Total Presta :{' '}
                <span className="font-semibold text-gray-800">
                  {formatMontant(items.reduce((s, i) => s + (parseFloat(i.montant_prestataire) || 0), 0))}
                </span>
              </span>
              <span>
                Total Client :{' '}
                <span className="font-semibold text-gray-800">
                  {formatMontant(items.reduce((s, i) => s + (parseFloat(i.montant_client) || 0), 0))}
                </span>
              </span>
            </div>
          )}
          {!isExterne && items.length > 0 && (
            <span className="text-xs text-gray-500">
              Total :{' '}
              <span className="font-semibold text-gray-800">
                {formatMontant(items.reduce((s, i) => s + (parseFloat(i.montant) || 0), 0))}
              </span>
            </span>
          )}
        </div>
        <div className="p-6">
          <ItemsTable items={items} type={ficheType} readOnly />
        </div>
      </div>

      {/* Validation */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Validation &amp; Historique
          </h2>
        </div>
        <div className="p-6">
          <ValidationSection
            fiche={fiche}
            canValidate={canValidate}
            type={ficheType}
            onSuccess={() => dispatch(fetchFicheById({ id, type: ficheType }))}
          />
        </div>
      </div>
    </div>
  )
}
