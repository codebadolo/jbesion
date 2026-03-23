import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchFicheById,
  submitFiche,
  executeFiche,
  markReceived,
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
import { exportFichePDF } from '../../utils/exportPDF.js'

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
  const [executeLoading, setExecuteLoading] = useState(false)
  const [executeError, setExecuteError] = useState(null)
  const [showExecuteForm, setShowExecuteForm] = useState(false)
  const [executeData, setExecuteData] = useState({
    execution_fournisseur: '',
    execution_reference: '',
    execution_montant: '',
    execution_mode_paiement: '',
    execution_numero_facture: '',
    execution_note: '',
  })
  const [receivedLoading, setReceivedLoading] = useState(false)
  const [receivedError, setReceivedError] = useState(null)

  // Infer type from fiche if not passed as prop
  const ficheType = type || fiche?.type || 'interne'

  useEffect(() => {
    dispatch(fetchFicheById({ id, type: ficheType }))
    return () => {
      dispatch(clearCurrentFiche())
    }
  }, [id, ficheType, dispatch])

  const userRole = user?.role || user?.role_code
  const isOwner = fiche?.created_by === user?.id
  const isDraft = fiche?.status === 'DRAFT'

  // Can user validate this fiche at its current stage?
  const requiredRole = VALIDATION_ROLES[fiche?.status]
  const canValidate = requiredRole && (userRole === requiredRole || userRole === 'ADMIN'
    || (fiche?.status === 'PENDING_DIRECTOR' && userRole === 'DAF'))

  // Execution rights (DAF / ADMIN / Admin & Finance department)
  const canExecute = fiche?.status === 'APPROVED' && (userRole === 'DAF' || userRole === 'ADMIN' || user?.is_finance_team === true)
  // Reception rights (owner / ADMIN)
  const canMarkReceived = fiche?.status === 'IN_EXECUTION' && (isOwner || userRole === 'ADMIN')

  const handleExecute = async () => {
    setExecuteError(null)
    setExecuteLoading(true)
    try {
      await dispatch(executeFiche({ id, type: ficheType, data: executeData })).unwrap()
      setShowExecuteForm(false)
      setExecuteData({
        execution_fournisseur: '',
        execution_reference: '',
        execution_montant: '',
        execution_mode_paiement: '',
        execution_numero_facture: '',
        execution_note: '',
      })
    } catch (err) {
      setExecuteError(typeof err === 'string' ? err : "Erreur lors de l'exécution.")
    } finally {
      setExecuteLoading(false)
    }
  }

  const handleMarkReceived = async () => {
    setReceivedError(null)
    setReceivedLoading(true)
    try {
      await dispatch(markReceived({ id, type: ficheType })).unwrap()
    } catch (err) {
      setReceivedError(typeof err === 'string' ? err : 'Erreur lors de la réception.')
    } finally {
      setReceivedLoading(false)
    }
  }

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
        <Link to={`/fiches-${ficheType === 'externe' ? 'externes' : 'internes'}`} className="btn-secondary">
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
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(55,182,233,0.12)', color: '#3475BB' }}>
              {isExterne ? 'Externe' : 'Interne'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Fiche de Besoin {isExterne ? 'Externe' : 'Interne'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Créée le {formatDate(fiche.created_at)} par {getFullName(fiche.created_by_detail)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={fiche.status} />
          <button
            type="button"
            onClick={() => exportFichePDF(fiche, ficheType).catch(console.error)}
            className="btn-secondary text-xs py-1.5"
          >
            <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exporter PDF
          </button>
          {isDraft && isOwner && (
            <Link
              to={`/fiches-${ficheType === 'externe' ? 'externes' : 'internes'}/create?edit=${id}`}
              className="btn-secondary text-xs py-1.5"
            >
              <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
              Modifier
            </Link>
          )}
          {canExecute && (
            <button
              type="button"
              onClick={() => setShowExecuteForm((v) => !v)}
              className="btn-primary text-xs py-1.5"
              style={{ backgroundColor: '#7c3aed' }}
            >
              <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              Exécuter
            </button>
          )}
          {canMarkReceived && (
            <button
              type="button"
              onClick={handleMarkReceived}
              disabled={receivedLoading}
              className="btn-primary text-xs py-1.5"
              style={{ backgroundColor: '#0d9488' }}
            >
              <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {receivedLoading ? 'En cours...' : 'Marquer reçu'}
            </button>
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
      {executeError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {executeError}
        </div>
      )}
      {receivedError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {receivedError}
        </div>
      )}

      {/* Formulaire exécution détaillé */}
      {showExecuteForm && canExecute && (
        <div className="card border-l-4" style={{ borderLeftColor: '#7c3aed' }}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Exécution de la commande</h3>
              <p className="text-xs text-gray-500 mt-0.5">Renseignez les informations de décaissement et de commande.</p>
            </div>
            <button type="button" onClick={() => setShowExecuteForm(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fournisseur */}
            <div>
              <label className="form-label">Fournisseur / Prestataire <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="form-input"
                value={executeData.execution_fournisseur}
                onChange={(e) => setExecuteData((d) => ({ ...d, execution_fournisseur: e.target.value }))}
                placeholder="Ex : Fournisseur SARL, APC Algérie..."
              />
            </div>
            {/* Référence BC */}
            <div>
              <label className="form-label">Référence bon de commande</label>
              <input
                type="text"
                className="form-input"
                value={executeData.execution_reference}
                onChange={(e) => setExecuteData((d) => ({ ...d, execution_reference: e.target.value }))}
                placeholder="Ex : BC-2026-0042"
              />
            </div>
            {/* Montant décaissé */}
            <div>
              <label className="form-label">Montant décaissé (DZD) <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={executeData.execution_montant}
                onChange={(e) => setExecuteData((d) => ({ ...d, execution_montant: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            {/* Mode de paiement */}
            <div>
              <label className="form-label">Mode de paiement <span className="text-red-500">*</span></label>
              <select
                className="form-input"
                value={executeData.execution_mode_paiement}
                onChange={(e) => setExecuteData((d) => ({ ...d, execution_mode_paiement: e.target.value }))}
              >
                <option value="">— Sélectionner —</option>
                <option value="Virement bancaire">Virement bancaire</option>
                <option value="Chèque">Chèque</option>
                <option value="Espèces">Espèces</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Carte bancaire">Carte bancaire</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            {/* N° Facture */}
            <div>
              <label className="form-label">N° Facture</label>
              <input
                type="text"
                className="form-input"
                value={executeData.execution_numero_facture}
                onChange={(e) => setExecuteData((d) => ({ ...d, execution_numero_facture: e.target.value }))}
                placeholder="Ex : FAC-2026-0099"
              />
            </div>
            {/* Observations */}
            <div className="sm:col-span-2">
              <label className="form-label">Observations (optionnel)</label>
              <textarea
                className="form-input resize-none"
                rows={2}
                value={executeData.execution_note}
                onChange={(e) => setExecuteData((d) => ({ ...d, execution_note: e.target.value }))}
                placeholder="Toute remarque utile concernant cette exécution..."
              />
            </div>
          </div>
          <div className="px-6 pb-5 flex gap-2 justify-end border-t border-gray-50 pt-4">
            <button type="button" onClick={() => setShowExecuteForm(false)} className="btn-secondary text-xs">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={executeLoading || !executeData.execution_fournisseur || !executeData.execution_montant || !executeData.execution_mode_paiement}
              className="btn-primary text-xs"
              style={{ backgroundColor: '#7c3aed' }}
            >
              {executeLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Exécution...
                </span>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  Confirmer l'exécution
                </>
              )}
            </button>
          </div>
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
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(55,182,233,0.15)', color: '#3475BB' }}>
                {((fiche.created_by_detail?.first_name?.[0] || '') +
                  (fiche.created_by_detail?.last_name?.[0] || '')).toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {getFullName(fiche.created_by_detail)}
                </p>
                <p className="text-xs text-gray-400">
                  {ROLE_LABELS[fiche.created_by_detail?.role] || '—'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Département</p>
            <p className="text-sm text-gray-800">
              {fiche.department_detail?.name ||
                fiche.created_by_detail?.department_detail?.name ||
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

        {/* Bloc exécution */}
        {fiche.executed_at && (
          <div className="px-6 pb-5 border-t border-purple-50 pt-4 bg-purple-50/30">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#7c3aed' }}>
              Exécution (Comptabilité)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Exécuté par</p>
                <p className="font-medium text-gray-800">{getFullName(fiche.executed_by_detail) || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date d'exécution</p>
                <p className="font-medium text-gray-800">{formatDate(fiche.executed_at)}</p>
              </div>
              {fiche.execution_fournisseur && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Fournisseur / Prestataire</p>
                  <p className="font-medium text-gray-800">{fiche.execution_fournisseur}</p>
                </div>
              )}
              {fiche.execution_reference && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Référence BC</p>
                  <p className="font-medium text-gray-800">{fiche.execution_reference}</p>
                </div>
              )}
              {fiche.execution_montant && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Montant décaissé</p>
                  <p className="font-medium text-gray-800">{formatMontant(fiche.execution_montant)}</p>
                </div>
              )}
              {fiche.execution_mode_paiement && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Mode de paiement</p>
                  <p className="font-medium text-gray-800">{fiche.execution_mode_paiement}</p>
                </div>
              )}
              {fiche.execution_numero_facture && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">N° Facture</p>
                  <p className="font-medium text-gray-800">{fiche.execution_numero_facture}</p>
                </div>
              )}
              {fiche.execution_note && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-gray-400 mb-0.5">Observations</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{fiche.execution_note}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bloc réception */}
        {fiche.received_at && (
          <div className="px-6 pb-5 border-t border-teal-50 pt-4 bg-teal-50/30">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#0d9488' }}>
              Réception confirmée
            </p>
            <p className="text-sm text-gray-700">
              Reçu le <span className="font-medium">{formatDate(fiche.received_at)}</span>
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
            userRole={userRole}
            onSuccess={() => dispatch(fetchFicheById({ id, type: ficheType }))}
          />
        </div>
      </div>
    </div>
  )
}
