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

// ─── Workflow steps ───────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { key: 'DRAFT',             label: 'Brouillon' },
  { key: 'PENDING_MANAGER',   label: 'Avis supérieur' },
  { key: 'PENDING_DAF',       label: 'Approbation DAF' },
  { key: 'PENDING_DIRECTOR',  label: 'Accord DG' },
  { key: 'APPROVED',          label: 'Approuvé' },
  { key: 'IN_EXECUTION',      label: 'En exécution' },
  { key: 'DELIVERED',         label: 'Réceptionné' },
]

const STEP_ORDER = WORKFLOW_STEPS.map((s) => s.key)

function WorkflowTracker({ status }) {
  const currentIdx = STEP_ORDER.indexOf(status)
  if (status === 'REJECTED') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
        <span className="text-sm font-semibold text-red-700">Fiche rejetée</span>
      </div>
    )
  }

  return (
    <ol className="space-y-2">
      {WORKFLOW_STEPS.map((step, idx) => {
        const done    = idx < currentIdx
        const active  = idx === currentIdx
        const pending = idx > currentIdx
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={[
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-2',
                done   ? 'bg-green-500 text-white ring-green-200' : '',
                active ? 'bg-blue-600 text-white ring-blue-200' : '',
                pending ? 'bg-gray-100 text-gray-400 ring-gray-200' : '',
              ].join(' ')}
            >
              {done ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                idx + 1
              )}
            </span>
            <span className={[
              'text-sm',
              done    ? 'text-green-700 font-medium' : '',
              active  ? 'text-blue-700 font-semibold' : '',
              pending ? 'text-gray-400' : '',
            ].join(' ')}>
              {step.label}
            </span>
            {active && (
              <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── BP items editable table ──────────────────────────────────────────────────
function BpItemsTable({ items, onChange }) {
  const addRow = () => onChange([...items, { designation: '', montant: '' }])
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i, field, val) => {
    const next = items.map((row, idx) => idx === i ? { ...row, [field]: val } : row)
    onChange(next)
  }
  const total = items.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0)

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase w-full">Désignation / Détail</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-40">Montant (DZD)</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    className="w-full border-0 bg-transparent text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-0"
                    placeholder="Description de l'article..."
                    value={row.designation}
                    onChange={(e) => update(i, 'designation', e.target.value)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border-0 bg-transparent text-sm text-right text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-0"
                    placeholder="0.00"
                    value={row.montant}
                    onChange={(e) => update(i, 'montant', e.target.value)}
                  />
                </td>
                <td className="px-2">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-3 py-2 text-xs font-bold text-gray-700 uppercase">Total</td>
              <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                {total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Ajouter une ligne
      </button>
    </div>
  )
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function FicheDetail({ type }) {
  const { id } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const fiche     = useSelector(selectCurrentFiche)
  const isLoading = useSelector(selectFichesLoading)
  const error     = useSelector(selectFichesError)
  const user      = useSelector(selectUser)

  const [submitLoading,    setSubmitLoading]    = useState(false)
  const [submitError,      setSubmitError]      = useState(null)
  const [executeLoading,   setExecuteLoading]   = useState(false)
  const [executeError,     setExecuteError]     = useState(null)
  const [showExecuteForm,  setShowExecuteForm]  = useState(false)
  const [receivedLoading,  setReceivedLoading]  = useState(false)
  const [receivedError,    setReceivedError]    = useState(null)

  const [executeData, setExecuteData] = useState({
    execution_fournisseur:      '',
    execution_reference:        '',
    execution_montant:          '',
    execution_montant_lettres:  '',
    execution_mode_paiement:    '',
    execution_numero_facture:   '',
    execution_note:             '',
    execution_items:            [{ designation: '', montant: '' }],
  })

  const ficheType = type || fiche?.type || 'interne'

  useEffect(() => {
    dispatch(fetchFicheById({ id, type: ficheType }))
    return () => { dispatch(clearCurrentFiche()) }
  }, [id, ficheType, dispatch])

  const userRole   = user?.role || user?.role_code
  const isOwner    = fiche?.created_by === user?.id
  const isDraft    = fiche?.status === 'DRAFT'

  const requiredRole = VALIDATION_ROLES[fiche?.status]
  const canValidate  = requiredRole && (
    userRole === requiredRole ||
    userRole === 'ADMIN' ||
    (fiche?.status === 'PENDING_DIRECTOR' && userRole === 'DAF')
  )

  const canExecute     = fiche?.status === 'APPROVED' && (userRole === 'DAF' || userRole === 'ADMIN' || user?.is_finance_team === true)
  const canMarkReceived = fiche?.status === 'IN_EXECUTION' && (isOwner || userRole === 'ADMIN')

  // Pre-populate BP items from fiche items when opening form
  const handleOpenExecuteForm = () => {
    const items = fiche?.items || []
    const prefill = items.length > 0
      ? items.map((it) => ({
          designation: it.designation || it.description || it.libelle || '',
          montant: String(it.montant || it.montant_prestataire || ''),
        }))
      : [{ designation: '', montant: '' }]

    setExecuteData((d) => ({ ...d, execution_items: prefill }))
    setShowExecuteForm(true)
  }

  const executeTotal = executeData.execution_items.reduce(
    (s, r) => s + (parseFloat(r.montant) || 0), 0
  )

  const handleExecute = async () => {
    setExecuteError(null)
    setExecuteLoading(true)
    try {
      const payload = {
        ...executeData,
        execution_montant: executeData.execution_montant || String(executeTotal),
      }
      await dispatch(executeFiche({ id, type: ficheType, data: payload })).unwrap()
      setShowExecuteForm(false)
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
          <p className="text-sm text-gray-500 mt-1">
            {typeof error === 'string' ? error : "Cette fiche n'existe pas ou vous n'y avez pas accès."}
          </p>
        </div>
        <Link to={`/fiches-${ficheType === 'externe' ? 'externes' : 'internes'}`} className="btn-secondary">
          ← Retour à la liste
        </Link>
      </div>
    )
  }

  if (!fiche) return null

  const items     = fiche.items || []
  const isExterne = ficheType === 'externe'

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
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
            <span className="text-xs text-gray-400 font-mono">#{fiche.numero || fiche.id}</span>
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

          {canExecute && !showExecuteForm && (
            <button
              type="button"
              onClick={handleOpenExecuteForm}
              className="btn-primary text-xs py-1.5"
              style={{ backgroundColor: '#7c3aed' }}
            >
              <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
              Émettre le bon de paiement
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
              {receivedLoading ? 'En cours...' : 'Marquer réceptionné'}
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

      {/* ── Error alerts ─────────────────────────────────────────────── */}
      {submitError   && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{submitError}</div>}
      {receivedError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{receivedError}</div>}

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── Left column (info + articles) ─────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Info card */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Informations générales</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Créé par</p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: 'rgba(55,182,233,0.15)', color: '#3475BB' }}
                  >
                    {((fiche.created_by_detail?.first_name?.[0] || '') +
                      (fiche.created_by_detail?.last_name?.[0] || '')).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{getFullName(fiche.created_by_detail)}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABELS[fiche.created_by_detail?.role] || '—'}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Département</p>
                <p className="text-sm text-gray-800">
                  {fiche.department_detail?.name || fiche.created_by_detail?.department_detail?.name || '—'}
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
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{fiche.notes}</p>
              </div>
            )}

            {/* Bloc réception */}
            {fiche.received_at && (
              <div className="px-6 pb-5 border-t border-teal-100 pt-4 bg-teal-50/40 rounded-b-xl">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Réception confirmée</p>
                </div>
                <p className="text-sm text-gray-700 ml-6">
                  Réceptionné le <span className="font-medium">{formatDate(fiche.received_at)}</span>
                </p>
              </div>
            )}
          </div>

          {/* Articles */}
          <div className="card">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Articles ({items.length})</h2>
              {isExterne && items.length > 0 && (
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Total Presta : <span className="font-semibold text-gray-800">{formatMontant(items.reduce((s, i) => s + (parseFloat(i.montant_prestataire) || 0), 0))}</span></span>
                  <span>Total Client : <span className="font-semibold text-gray-800">{formatMontant(items.reduce((s, i) => s + (parseFloat(i.montant_client) || 0), 0))}</span></span>
                </div>
              )}
              {!isExterne && items.length > 0 && (
                <span className="text-xs text-gray-500">
                  Total : <span className="font-semibold text-gray-800">{formatMontant(items.reduce((s, i) => s + (parseFloat(i.montant) || 0), 0))}</span>
                </span>
              )}
            </div>
            <div className="p-6">
              <ItemsTable items={items} type={ficheType} readOnly />
            </div>
          </div>

          {/* Execution info (after execution) */}
          {fiche.executed_at && (
            <div className="card border-l-4" style={{ borderLeftColor: '#7c3aed' }}>
              <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/30 flex items-center justify-between rounded-t-xl">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-purple-700">Bon de Paiement — Exécution</h3>
                </div>
                {fiche.bon_paiement_id && (
                  <Link
                    to={`/bons-paiement/${fiche.bon_paiement_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                    style={{ backgroundColor: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    {fiche.bon_paiement_numero || 'Voir le bon'}
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                )}
              </div>
              <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
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
                    <p className="text-xs text-gray-400 mb-0.5">Bénéficiaire</p>
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
                    <p className="font-semibold text-gray-900 text-base">{formatMontant(fiche.execution_montant)}</p>
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
        </div>

        {/* ── Right column (workflow + validation) ──────────────────── */}
        <div className="space-y-5">

          {/* Workflow tracker */}
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Avancement</h2>
            </div>
            <div className="px-5 py-4">
              <WorkflowTracker status={fiche.status} />
            </div>
          </div>

          {/* Validation */}
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Validation &amp; Historique</h2>
            </div>
            <div className="p-5">
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
      </div>

      {/* ── Modal Bon de Paiement ────────────────────────────────────── */}
      {showExecuteForm && canExecute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={() => setShowExecuteForm(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-purple-100 flex-shrink-0" style={{ backgroundColor: 'rgba(124,58,237,0.05)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'rgba(124,58,237,0.12)' }}>
                  <svg className="h-5 w-5 text-purple-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-purple-900">Émettre le Bon de Paiement</h3>
                  <p className="text-xs text-purple-500 mt-0.5">Le bon sera automatiquement lié à cette fiche.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExecuteForm(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {executeError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {executeError}
                </div>
              )}

              {/* Section 1: Identification */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Identification</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Bénéficiaire / Fournisseur <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      value={executeData.execution_fournisseur}
                      onChange={(e) => setExecuteData((d) => ({ ...d, execution_fournisseur: e.target.value }))}
                      placeholder="Ex : Fournisseur SARL..."
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="form-label">Mode de paiement <span className="text-red-500">*</span></label>
                    <select
                      className="form-input"
                      value={executeData.execution_mode_paiement}
                      onChange={(e) => setExecuteData((d) => ({ ...d, execution_mode_paiement: e.target.value }))}
                    >
                      <option value="">— Sélectionner —</option>
                      <option value="Espèces">Espèces</option>
                      <option value="Chèque">Chèque</option>
                    </select>
                  </div>
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
                </div>
              </div>

              {/* Section 2: Articles */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Articles</p>
                <BpItemsTable
                  items={executeData.execution_items}
                  onChange={(items) => setExecuteData((d) => ({ ...d, execution_items: items }))}
                />
              </div>

              {/* Section 3: Montant */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Montant</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">
                      Montant total (DZD)
                      <span className="ml-1.5 text-xs font-normal text-gray-400">— auto calculé</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        value={executeData.execution_montant || ''}
                        placeholder={executeTotal > 0 ? String(executeTotal) : '0.00'}
                        onChange={(e) => setExecuteData((d) => ({ ...d, execution_montant: e.target.value }))}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Total articles : <span className="font-semibold text-gray-600">{executeTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                  <div>
                    <label className="form-label">Montant en lettres</label>
                    <input
                      type="text"
                      className="form-input"
                      value={executeData.execution_montant_lettres}
                      onChange={(e) => setExecuteData((d) => ({ ...d, execution_montant_lettres: e.target.value }))}
                      placeholder="Ex : Cinquante mille dinars"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Observations</label>
                    <textarea
                      className="form-input resize-none"
                      rows={2}
                      value={executeData.execution_note}
                      onChange={(e) => setExecuteData((d) => ({ ...d, execution_note: e.target.value }))}
                      placeholder="Toute remarque utile..."
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Modal footer */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
              <p className="text-sm text-gray-600">
                Total :{' '}
                <span className="font-bold text-gray-900">
                  {(parseFloat(executeData.execution_montant) || executeTotal).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                </span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowExecuteForm(false)} className="btn-secondary">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={
                    executeLoading ||
                    !executeData.execution_fournisseur ||
                    !executeData.execution_mode_paiement ||
                    (executeTotal === 0 && !executeData.execution_montant)
                  }
                  className="btn-primary"
                  style={{ backgroundColor: '#7c3aed' }}
                >
                  {executeLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Émission...
                    </span>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Émettre le bon
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
