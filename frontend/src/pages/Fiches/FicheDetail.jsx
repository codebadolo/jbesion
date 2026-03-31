import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { getBonsCommande, getBonCommandeById, createBonCommande } from '../../api/bonsCommandeAPI.js'
import { getBonsPaiement, createBonPaiement, validateBonPaiement, cancelBonPaiement } from '../../api/bonsPaiementAPI.js'
import { getFichesMission, createFicheMission, soumettreMission, validerMission, rejeterMission } from '../../api/missionsAPI.js'
import { getAgentsLiaison } from '../../api/adminAPI.js'
import {
  soumettreDAF, validerProformas,
  approuverDAF, rejeterDAF,
  approuverDG, rejeterDG,
  executerBC, cloturerBC,
  selectionnerFourn, uploadProforma, deleteProforma,
} from '../../store/bonsCommandeSlice.js'

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


// ─── Shared Modal ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, maxWidth = 'max-w-2xl', headerColor }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${maxWidth} max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${headerColor || 'border-gray-100 bg-white'}`}>
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Proforma file viewer ──────────────────────────────────────────────────────
function ProformaViewer({ url, title, onClose }) {
  const isPdf = /\.pdf($|\?)/i.test(url)
  return (
    <Modal title={title || 'Facture proforma'} onClose={onClose} maxWidth="max-w-4xl">
      <div className="p-4" style={{ height: '72vh' }}>
        {isPdf ? (
          <iframe src={url} title="proforma" className="w-full h-full rounded-lg border border-gray-200" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 overflow-auto">
            <img src={url} alt="proforma" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Ouvrir dans un nouvel onglet
        </a>
        <button type="button" onClick={onClose} className="btn-secondary text-xs py-1.5">Fermer</button>
      </div>
    </Modal>
  )
}

// ─── Mission mini workflow ─────────────────────────────────────────────────────
const MISSION_STEPS_WF = [
  { key: 'DRAFT',           label: 'Brouillon' },
  { key: 'PENDING_MANAGER', label: 'Manager'   },
  { key: 'PENDING_DAF',     label: 'DAF'       },
  { key: 'PENDING_DG',      label: 'DG'        },
  { key: 'APPROVED',        label: 'Approuvée' },
  { key: 'IN_PROGRESS',     label: 'En cours'  },
  { key: 'DONE',            label: 'Terminée'  },
]

function MissionWorkflowMini({ status }) {
  const idx = MISSION_STEPS_WF.findIndex((s) => s.key === status)
  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
        Rejetée
      </span>
    )
  }
  return (
    <ol className="flex items-center">
      {MISSION_STEPS_WF.map((step, i) => {
        const done = i < idx; const active = i === idx
        return (
          <li key={step.key} className="flex items-center">
            <span title={step.label} className={[
              'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ring-1 cursor-default',
              done   ? 'bg-green-500 text-white ring-green-300' : '',
              active ? 'bg-blue-600 text-white ring-blue-300'  : '',
              !done && !active ? 'bg-gray-100 text-gray-400 ring-gray-200' : '',
            ].join(' ')}>
              {done ? '✓' : i + 1}
            </span>
            {i < MISSION_STEPS_WF.length - 1 && (
              <span className={`h-px w-3 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// helpers permission missions
const missionCanSubmit    = (user, m) => m.status === 'DRAFT' && String(m.created_by) === String(user?.id)
const missionCanValidate  = (user, m) => {
  const r = user?.role; const rh = user?.is_rh
  if (r === 'ADMIN' || rh) return ['PENDING_MANAGER','PENDING_DAF','PENDING_DG'].includes(m.status)
  if (r === 'MANAGER')  return m.status === 'PENDING_MANAGER'
  if (r === 'DAF')      return ['PENDING_MANAGER','PENDING_DAF'].includes(m.status)
  if (r === 'DIRECTOR') return ['PENDING_MANAGER','PENDING_DG'].includes(m.status)
  return false
}

// ─── BP helpers ───────────────────────────────────────────────────────────────
const BP_STATUS = {
  DRAFT:     { label: 'Brouillon', color: 'bg-gray-100 text-gray-600' },
  VALIDATED: { label: 'Validé',    color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Annulé',    color: 'bg-red-100 text-red-700' },
}

const bpCanManage = (u) =>
  ['DAF', 'ADMIN'].includes(u?.role) || u?.department?.code === 'AF' || u?.is_comptable

const EMPTY_BP = { beneficiaire: '', motif: '', mode_paiement: '', date: '', montant: '', montant_lettres: '', items: [{ designation: '', montant: '' }] }
const MODE_LABELS = { ESPECE: 'Espèces', CHEQUE: 'Chèque' }

function BonsPaiementSection({ ficheType, ficheId, user, fiche }) {
  const [bons,       setBons]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [actLoading, setActLoading] = useState({})
  const [actErr,     setActErr]     = useState({})
  const [expanded,   setExpanded]   = useState(null)
  const [showModal,  setShowModal]  = useState(false)
  const [newBpData,  setNewBpData]  = useState(EMPTY_BP)
  const [creating,   setCreating]   = useState(false)
  const [createErr,  setCreateErr]  = useState(null)

  const canManage = bpCanManage(user)

  const reload = useCallback(() => {
    getBonsPaiement({ fiche_type: ficheType.toUpperCase(), fiche_id: ficheId, page_size: 50 })
      .then((d) => setBons(d.results ?? d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ficheType, ficheId])

  useEffect(() => { setLoading(true); reload() }, [reload])

  const doAction = async (bonId, fn) => {
    setActErr((p) => ({ ...p, [bonId]: null }))
    setActLoading((p) => ({ ...p, [bonId]: true }))
    try { await fn(bonId); reload() }
    catch (e) { setActErr((p) => ({ ...p, [bonId]: typeof e === 'string' ? e : 'Erreur' })) }
    finally { setActLoading((p) => ({ ...p, [bonId]: false })) }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateErr(null); setCreating(true)
    try {
      const total = newBpData.items.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0)
      await createBonPaiement({
        ...newBpData,
        fiche_type: ficheType.toUpperCase(),
        fiche_id: ficheId,
        montant: newBpData.montant || total,
        items: newBpData.items.filter((r) => r.designation),
      })
      setNewBpData(EMPTY_BP); setShowModal(false); reload()
    } catch (e) {
      setCreateErr(typeof e === 'string' ? e : 'Erreur lors de la création')
    } finally { setCreating(false) }
  }

  if (loading) return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Bons de Paiement</h2>
      </div>
      <div className="flex justify-center py-8">
        <span className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-purple-600" />
      </div>
    </div>
  )

  if (bons.length === 0 && !canManage) return null

  return (
    <div className="card border-l-4" style={{ borderLeftColor: '#7c3aed' }}>
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          <h2 className="text-sm font-semibold text-purple-700">
            Bons de Paiement
            {bons.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                {bons.length}
              </span>
            )}
          </h2>
        </div>
        {canManage && (
          <button type="button"
            onClick={() => {
              const d = fiche || {}
              const createdBy = d.created_by_detail
              const beneficiaire = createdBy
                ? `${createdBy.first_name || ''} ${createdBy.last_name || ''}`.trim()
                : ''
              const motif = d.numero
                ? `Paiement relatif à la fiche ${d.numero}`
                : ''
              const ficheItems = (d.items || [])
                .filter((it) => it.designation || it.description)
                .map((it) => ({
                  designation: it.designation || it.description || '',
                  montant: String(it.montant_prestataire || it.montant || ''),
                }))
              const prefillItems = ficheItems.length > 0 ? ficheItems : [{ designation: '', montant: '' }]
              const today = new Date().toISOString().slice(0, 10)
              setNewBpData({ ...EMPTY_BP, beneficiaire, motif, date: today, items: prefillItems })
              setShowModal(true)
              setCreateErr(null)
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-white border-gray-300 text-gray-700 hover:bg-purple-50 hover:border-purple-300 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau BP
          </button>
        )}
      </div>

      {/* ── Liste ── */}
      {bons.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-gray-400 italic">
          Aucun bon de paiement lié. Utilisez le bouton ci-dessus pour en émettre un.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {bons.map((bon) => {
            const cfg    = BP_STATUS[bon.status] ?? BP_STATUS.DRAFT
            const isOpen = expanded === bon.id
            const items  = bon.items ?? []
            return (
              <div key={bon.id}>
                {/* ── Row ── */}
                <button type="button" onClick={() => setExpanded(isOpen ? null : bon.id)}
                  className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-gray-50 transition-colors">
                  <span className="font-mono text-xs font-semibold text-gray-700 w-32 flex-shrink-0">{bon.numero}</span>
                  <span className="flex-1 text-sm text-gray-700 truncate">{bon.beneficiaire || '—'}</span>
                  {bon.montant && (
                    <span className="text-sm font-bold text-gray-900 flex-shrink-0">{formatMontant(bon.montant)}</span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} flex-shrink-0`}>
                    {cfg.label}
                  </span>
                  <svg className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                {/* ── Détails expandables ── */}
                {isOpen && (
                  <div className="px-6 pb-6 pt-3 space-y-4 bg-purple-50/10 border-t border-purple-100">

                    {/* Infos générales */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Bénéficiaire</p>
                        <p className="font-medium text-gray-800">{bon.beneficiaire || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Mode de paiement</p>
                        <p className="font-medium text-gray-800">{MODE_LABELS[bon.mode_paiement] || bon.mode_paiement || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Date</p>
                        <p className="font-medium text-gray-800">{bon.date ? formatDate(bon.date) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Montant total</p>
                        <p className="font-bold text-gray-900 text-base">{bon.montant ? formatMontant(bon.montant) : '—'}</p>
                      </div>
                      {bon.motif && (
                        <div className="col-span-2 sm:col-span-4">
                          <p className="text-xs text-gray-400 mb-0.5">Motif</p>
                          <p className="text-gray-700">{bon.motif}</p>
                        </div>
                      )}
                      {bon.montant_lettres && (
                        <div className="col-span-2 sm:col-span-4">
                          <p className="text-xs text-gray-400 mb-0.5">Montant en lettres</p>
                          <p className="text-gray-700 italic">{bon.montant_lettres}</p>
                        </div>
                      )}
                    </div>

                    {/* Articles */}
                    {items.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Articles ({items.length})</p>
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-100 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Désignation</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-36">Montant (DZD)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {items.map((it, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-2 text-gray-700">{it.designation}</td>
                                  <td className="px-3 py-2 text-right text-gray-800 font-medium">
                                    {it.montant ? Number(it.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Erreur + actions */}
                    {actErr[bon.id] && (
                      <p className="text-xs text-red-600">{actErr[bon.id]}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-purple-100">
                      {bon.status === 'DRAFT' && canManage && (
                        <>
                          <button disabled={actLoading[bon.id]} onClick={() => doAction(bon.id, validateBonPaiement)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            Valider
                          </button>
                          <button disabled={actLoading[bon.id]} onClick={() => doAction(bon.id, cancelBonPaiement)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                            Annuler
                          </button>
                        </>
                      )}
                      {bon.status === 'VALIDATED' && canManage && (
                        <button disabled={actLoading[bon.id]} onClick={() => doAction(bon.id, cancelBonPaiement)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                          Annuler
                        </button>
                      )}
                      {actLoading[bon.id] && (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
                      )}
                      <Link to={`/bons-paiement/${bon.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:underline ml-auto flex-shrink-0">
                        Voir le bon complet
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal création BP ── */}
      {showModal && canManage && (
        <Modal title="Nouveau Bon de Paiement" onClose={() => setShowModal(false)}
          headerColor="border-purple-100 bg-purple-50/30">
          <form onSubmit={handleCreate} className="px-6 py-5 space-y-5">
            {createErr && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{createErr}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Bénéficiaire <span className="text-red-500">*</span></label>
                <input type="text" required autoFocus className="form-input"
                  value={newBpData.beneficiaire}
                  onChange={(e) => setNewBpData((d) => ({ ...d, beneficiaire: e.target.value }))}
                  placeholder="Nom du bénéficiaire" />
              </div>
              <div>
                <label className="form-label">Mode de paiement <span className="text-red-500">*</span></label>
                <select required className="form-input"
                  value={newBpData.mode_paiement}
                  onChange={(e) => setNewBpData((d) => ({ ...d, mode_paiement: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  <option value="ESPECE">Espèces</option>
                  <option value="CHEQUE">Chèque</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Motif</label>
                <input type="text" className="form-input"
                  value={newBpData.motif}
                  onChange={(e) => setNewBpData((d) => ({ ...d, motif: e.target.value }))}
                  placeholder="Objet du paiement" />
              </div>
            </div>
            <div>
              <label className="form-label">Articles / Détail</label>
              <BpItemsTable items={newBpData.items} onChange={(items) => setNewBpData((d) => ({ ...d, items }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Montant total (DZD)
                  <span className="ml-1 text-xs font-normal text-gray-400">— auto calculé si vide</span>
                </label>
                <input type="number" min="0" step="0.01" className="form-input"
                  value={newBpData.montant}
                  placeholder={String(newBpData.items.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0) || '')}
                  onChange={(e) => setNewBpData((d) => ({ ...d, montant: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Montant en lettres</label>
                <input type="text" className="form-input"
                  value={newBpData.montant_lettres}
                  onChange={(e) => setNewBpData((d) => ({ ...d, montant_lettres: e.target.value }))}
                  placeholder="Ex : Cinquante mille dinars" />
              </div>
              <div>
                <label className="form-label">Date</label>
                <input type="date" className="form-input"
                  value={newBpData.date}
                  onChange={(e) => setNewBpData((d) => ({ ...d, date: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={creating || !newBpData.beneficiaire || !newBpData.mode_paiement}
                className="btn-primary flex items-center gap-1.5" style={{ backgroundColor: '#7c3aed' }}>
                {creating
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                }
                Émettre le bon
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Mission helpers ───────────────────────────────────────────────────────────
const MISSION_STATUS = {
  DRAFT:           { label: 'Brouillon',       color: 'bg-gray-100 text-gray-600' },
  PENDING_MANAGER: { label: 'Attente Manager', color: 'bg-yellow-100 text-yellow-800' },
  PENDING_DAF:     { label: 'Attente DAF',     color: 'bg-amber-100 text-amber-800' },
  PENDING_DG:      { label: 'Attente DG',      color: 'bg-orange-100 text-orange-800' },
  APPROVED:        { label: 'Approuvée',       color: 'bg-green-100 text-green-800' },
  REJECTED:        { label: 'Rejetée',         color: 'bg-red-100 text-red-700' },
  IN_PROGRESS:     { label: 'En cours',        color: 'bg-blue-100 text-blue-800' },
  DONE:            { label: 'Terminée',        color: 'bg-teal-100 text-teal-800' },
}

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY_MISSION = {
  date: '',
  nom_prenom: '',
  fonction: '',
  destination: '',
  objet_mission: '',
  date_debut: '',
  date_fin: '',
  hebergement: '',
  restauration: '',
  transport_aller_retour: '',
  autres_frais: '',
  notes: '',
  beneficiaire: '',
  agent_liaison: '',
}

function MissionsSection({ ficheId, ficheData, user }) {
  const [missions,    setMissions]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState(null)
  const [actLoading,  setActLoading]  = useState({})
  const [actErr,      setActErr]      = useState({})
  const [rejectPanel, setRejectPanel] = useState(null)
  const [rejectNote,  setRejectNote]  = useState('')

  // Create mission
  const [showCreate,  setShowCreate]  = useState(false)
  const [creating,    setCreating]    = useState(false)
  const [createErr,   setCreateErr]   = useState(null)
  const [newM,        setNewM]        = useState(EMPTY_MISSION)
  const [agents,      setAgents]      = useState([])

  useEffect(() => {
    getAgentsLiaison().then((d) => setAgents(d.results ?? d)).catch(() => {})
  }, [])

  const reload = useCallback(() => {
    getFichesMission({ fiche_externe_id: ficheId, page_size: 50 })
      .then((d) => setMissions(d.results ?? d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ficheId])

  const openCreate = () => {
    setNewM({ ...EMPTY_MISSION, date: today(), date_debut: today(), date_fin: today() })
    setCreateErr(null)
    setShowCreate(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateErr(null)
    setCreating(true)
    try {
      const payload = {
        date:                   newM.date,
        nom_prenom:             newM.nom_prenom,
        fonction:               newM.fonction,
        destination:            newM.destination,
        objet_mission:          newM.objet_mission,
        date_debut:             newM.date_debut,
        date_fin:               newM.date_fin,
        department:             ficheData?.department?.id || ficheData?.department,
        fiche_externe_id:       ficheId,
        notes:                  newM.notes || '',
        hebergement:            newM.hebergement || 0,
        restauration:           newM.restauration || 0,
        transport_aller_retour: newM.transport_aller_retour || 0,
        autres_frais:           newM.autres_frais || 0,
      }
      if (newM.beneficiaire) payload.beneficiaire = newM.beneficiaire
      if (newM.agent_liaison) payload.agent_liaison = newM.agent_liaison
      await createFicheMission(payload)
      setShowCreate(false)
      reload()
    } catch (e) {
      const d = e.response?.data
      if (d && typeof d === 'object') {
        const msgs = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
        setCreateErr(msgs)
      } else {
        setCreateErr('Erreur lors de la création.')
      }
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => { setLoading(true); reload() }, [reload])

  const doSubmit = async (missionId) => {
    setActErr((p) => ({ ...p, [missionId]: null }))
    setActLoading((p) => ({ ...p, [missionId]: true }))
    try { await soumettreMission(missionId); reload() }
    catch (e) { setActErr((p) => ({ ...p, [missionId]: typeof e === 'string' ? e : 'Erreur soumission' })) }
    finally { setActLoading((p) => ({ ...p, [missionId]: false })) }
  }

  const doValidate = async (missionId) => {
    setActErr((p) => ({ ...p, [missionId]: null }))
    setActLoading((p) => ({ ...p, [missionId]: true }))
    try { await validerMission(missionId, { commentaire: '' }); reload() }
    catch (e) { setActErr((p) => ({ ...p, [missionId]: typeof e === 'string' ? e : 'Erreur validation' })) }
    finally { setActLoading((p) => ({ ...p, [missionId]: false })) }
  }

  const doReject = async (missionId) => {
    setActErr((p) => ({ ...p, [missionId]: null }))
    setActLoading((p) => ({ ...p, [missionId]: true }))
    try { await rejeterMission(missionId, { commentaire: rejectNote }); setRejectPanel(null); setRejectNote(''); reload() }
    catch (e) { setActErr((p) => ({ ...p, [missionId]: typeof e === 'string' ? e : 'Erreur rejet' })) }
    finally { setActLoading((p) => ({ ...p, [missionId]: false })) }
  }

  if (loading) return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Missions</h2>
      </div>
      <div className="flex justify-center py-8">
        <span className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-500" />
      </div>
    </div>
  )

  if (missions.length === 0 && !ficheData) return null

  return (
    <>
    {showCreate && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
            <h3 className="text-base font-semibold text-gray-800">Nouvelle Fiche de Mission</h3>
            <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleCreate} className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input type="date" required className="form-input w-full"
                  value={newM.date} onChange={(e) => setNewM((d) => ({ ...d, date: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom et Prénom *</label>
                <input type="text" required className="form-input w-full" placeholder="Nom complet du bénéficiaire"
                  value={newM.nom_prenom} onChange={(e) => setNewM((d) => ({ ...d, nom_prenom: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fonction / Poste</label>
                <input type="text" className="form-input w-full" placeholder="Ex: Technicien"
                  value={newM.fonction} onChange={(e) => setNewM((d) => ({ ...d, fonction: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Agent de liaison</label>
                <select className="form-input w-full"
                  value={newM.agent_liaison} onChange={(e) => setNewM((d) => ({ ...d, agent_liaison: e.target.value }))}>
                  <option value="">— Aucun —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Destination *</label>
                <input type="text" required className="form-input w-full" placeholder="Lieu de mission"
                  value={newM.destination} onChange={(e) => setNewM((d) => ({ ...d, destination: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Objet de la mission *</label>
                <textarea rows={2} required className="form-input w-full" placeholder="Décrire l'objet de la mission"
                  value={newM.objet_mission} onChange={(e) => setNewM((d) => ({ ...d, objet_mission: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de départ *</label>
                <input type="date" required className="form-input w-full"
                  value={newM.date_debut} onChange={(e) => setNewM((d) => ({ ...d, date_debut: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de retour *</label>
                <input type="date" required className="form-input w-full"
                  value={newM.date_fin} onChange={(e) => setNewM((d) => ({ ...d, date_fin: e.target.value }))} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Frais (FCFA)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'hebergement', label: 'Hébergement' },
                  { key: 'restauration', label: 'Restauration' },
                  { key: 'transport_aller_retour', label: 'Transport A/R' },
                  { key: 'autres_frais', label: 'Autres frais' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input type="number" min="0" step="0.01" className="form-input w-full" placeholder="0"
                      value={newM[key]} onChange={(e) => setNewM((d) => ({ ...d, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea rows={2} className="form-input w-full"
                value={newM.notes} onChange={(e) => setNewM((d) => ({ ...d, notes: e.target.value }))} />
            </div>

            {createErr && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{createErr}</div>
            )}

            <div className="flex gap-2 justify-end border-t border-gray-100 pt-4">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm py-1.5">Annuler</button>
              <button type="submit" disabled={creating}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {creating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
                Créer la mission
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        <h2 className="text-sm font-semibold text-gray-700">
          Missions
          {missions.length > 0 && (
          <span className="ml-2 inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
            {missions.length}
          </span>
          )}
        </h2>
        </div>
        {ficheData && (
          <button type="button" onClick={openCreate}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvelle mission
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {missions.map((m) => {
          const cfg    = MISSION_STATUS[m.status] ?? MISSION_STATUS.DRAFT
          const isOpen = expanded === m.id
          const canSub = missionCanSubmit(user, m)
          const canVal = missionCanValidate(user, m)
          return (
            <div key={m.id}>
              {/* ── Row ── */}
              <button type="button" onClick={() => setExpanded(isOpen ? null : m.id)}
                className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-gray-50 transition-colors">
                <span className="font-mono text-xs font-semibold text-gray-600 w-28 flex-shrink-0">{m.numero}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.nom_prenom || m.destination || '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{m.destination}
                    {m.date_debut && <> · {formatDate(m.date_debut)}{m.date_fin ? ` → ${formatDate(m.date_fin)}` : ''}</>}
                  </p>
                </div>
                {m.total_frais && (
                  <span className="text-sm font-bold text-gray-900 flex-shrink-0">{formatMontant(m.total_frais)}</span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} flex-shrink-0`}>
                  {cfg.label}
                </span>
                <svg className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/* ── Détails expandables ── */}
              {isOpen && (
                <div className="px-6 pb-6 pt-4 space-y-5 bg-indigo-50/10 border-t border-indigo-100">

                  {/* Workflow */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Avancement</p>
                    <MissionWorkflowMini status={m.status} />
                  </div>

                  {/* Informations */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Bénéficiaire</p>
                      <p className="font-medium text-gray-800">{m.nom_prenom || '—'}</p>
                    </div>
                    {m.matricule_display && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Matricule</p>
                        <p className="font-medium text-gray-800 font-mono">{m.matricule_display}</p>
                      </div>
                    )}
                    {m.fonction && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Fonction</p>
                        <p className="font-medium text-gray-800">{m.fonction}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Destination</p>
                      <p className="font-medium text-gray-800">{m.destination || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Période</p>
                      <p className="font-medium text-gray-800">
                        {m.date_debut ? formatDate(m.date_debut) : '—'}
                        {m.date_fin ? ` → ${formatDate(m.date_fin)}` : ''}
                      </p>
                    </div>
                    {m.objet_mission && (
                      <div className="col-span-2 sm:col-span-3">
                        <p className="text-xs text-gray-400 mb-0.5">Objet</p>
                        <p className="text-gray-700">{m.objet_mission}</p>
                      </div>
                    )}
                  </div>

                  {/* Frais */}
                  {(m.hebergement || m.restauration || m.transport_aller_retour || m.autres_frais) && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Frais</p>
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Poste</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-36">Montant (FCFA)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {m.hebergement      && <tr><td className="px-3 py-2 text-gray-700">Hébergement</td><td className="px-3 py-2 text-right font-medium">{formatMontant(m.hebergement)}</td></tr>}
                            {m.restauration     && <tr><td className="px-3 py-2 text-gray-700">Restauration</td><td className="px-3 py-2 text-right font-medium">{formatMontant(m.restauration)}</td></tr>}
                            {m.transport_aller_retour && <tr><td className="px-3 py-2 text-gray-700">Transport A/R</td><td className="px-3 py-2 text-right font-medium">{formatMontant(m.transport_aller_retour)}</td></tr>}
                            {m.autres_frais     && <tr><td className="px-3 py-2 text-gray-700">Autres frais</td><td className="px-3 py-2 text-right font-medium">{formatMontant(m.autres_frais)}</td></tr>}
                          </tbody>
                          {m.total_frais && (
                            <tfoot className="bg-gray-50 border-t border-gray-200">
                              <tr>
                                <td className="px-3 py-2 text-xs font-bold text-gray-700 uppercase">Total</td>
                                <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">{formatMontant(m.total_frais)}</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Erreur */}
                  {actErr[m.id] && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{actErr[m.id]}</div>
                  )}

                  {/* Panel rejet */}
                  {rejectPanel === m.id && (
                    <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Motif de rejet</p>
                      <textarea rows={2} className="form-input w-full"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Indiquez la raison du rejet…" />
                      <div className="flex gap-2">
                        <button type="button" disabled={actLoading[m.id]}
                          onClick={() => doReject(m.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                          Confirmer le rejet
                        </button>
                        <button type="button" onClick={() => setRejectPanel(null)} className="btn-secondary text-xs py-1.5">Annuler</button>
                      </div>
                    </div>
                  )}

                  {/* Actions + lien */}
                  <div className="flex items-center gap-2 flex-wrap border-t border-indigo-100 pt-3">
                    {canSub && (
                      <button type="button" disabled={actLoading[m.id]} onClick={() => doSubmit(m.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                        </svg>
                        Soumettre
                      </button>
                    )}
                    {canVal && rejectPanel !== m.id && (
                      <>
                        <button type="button" disabled={actLoading[m.id]} onClick={() => doValidate(m.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          Valider
                        </button>
                        <button type="button" disabled={actLoading[m.id]}
                          onClick={() => { setRejectPanel(m.id); setRejectNote('') }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                          Rejeter
                        </button>
                      </>
                    )}
                    {actLoading[m.id] && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                    )}
                    <Link to={`/missions/${m.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline ml-auto flex-shrink-0">
                      Voir la mission complète
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {missions.length === 0 && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-500">Aucune fiche de mission liée.</p>
            <p className="text-xs text-gray-400 mt-1">Utilisez le bouton ci-dessus pour créer une mission pour cet agent.</p>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

// ─── BC helpers ───────────────────────────────────────────────────────────────
const BC_STATUS = {
  DRAFT:            { label: 'Brouillon',            color: 'bg-gray-100 text-gray-600' },
  PENDING_PROFORMA: { label: 'En attente proformas', color: 'bg-amber-100 text-amber-800' },
  PENDING_DAF:      { label: 'En attente DAF',       color: 'bg-yellow-100 text-yellow-800' },
  PENDING_DG:       { label: 'En attente DG',        color: 'bg-orange-100 text-orange-800' },
  APPROVED:         { label: 'Approuvé',             color: 'bg-green-100 text-green-800' },
  REJECTED:         { label: 'Rejeté',               color: 'bg-red-100 text-red-800' },
  IN_EXECUTION:     { label: 'En exécution',         color: 'bg-blue-100 text-blue-800' },
  DONE:             { label: 'Clôturé',              color: 'bg-teal-100 text-teal-800' },
}

const BC_STEPS = [
  { key: 'DRAFT',            label: 'Brouillon' },
  { key: 'PENDING_PROFORMA', label: 'Proformas' },
  { key: 'PENDING_DAF',      label: 'DAF' },
  { key: 'PENDING_DG',       label: 'DG' },
  { key: 'APPROVED',         label: 'Approuvé' },
  { key: 'IN_EXECUTION',     label: 'Exécution' },
  { key: 'DONE',             label: 'Clôturé' },
]

const bcCanDAF  = (u) => ['DAF',      'ADMIN'].includes(u?.role)
const bcCanDG   = (u) => ['DIRECTOR', 'ADMIN'].includes(u?.role)
const bcCanWrite= (u) => ['DAF', 'ADMIN'].includes(u?.role) || u?.department?.code === 'AF' || u?.is_comptable
const bcCanUpload=(u) => u?.is_comptable || ['DAF', 'ADMIN'].includes(u?.role) || u?.department?.code === 'AF'

function BcWorkflowMini({ status, showLabels = false }) {
  const idx = BC_STEPS.findIndex((s) => s.key === status)
  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
        Rejeté
      </span>
    )
  }
  return (
    <ol className={`flex items-${showLabels ? 'start' : 'center'}`}>
      {BC_STEPS.map((step, i) => {
        const done = i < idx; const active = i === idx
        return (
          <li key={step.key} className="flex items-center">
            <div className={showLabels ? 'flex flex-col items-center' : ''}>
              <span title={step.label} className={[
                'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ring-1 cursor-default flex-shrink-0',
                done   ? 'bg-green-500 text-white ring-green-300' : '',
                active ? 'bg-blue-600 text-white ring-blue-300'  : '',
                !done && !active ? 'bg-gray-100 text-gray-400 ring-gray-200' : '',
              ].join(' ')}>
                {done ? '✓' : i + 1}
              </span>
              {showLabels && (
                <span className={`mt-1 text-[9px] font-medium leading-tight text-center w-10 ${
                  active ? 'text-blue-600' : done ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              )}
            </div>
            {i < BC_STEPS.length - 1 && (
              <span className={`h-px w-4 mb-${showLabels ? '3' : '0'} flex-shrink-0 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── Interactive BonsCommandeSection ──────────────────────────────────────────
const BC_APPROVED_STATUSES = ['APPROVED', 'IN_EXECUTION', 'DONE']

function BonsCommandeSection({ ficheType, ficheId, user, onBcsLoaded }) {
  const dispatch      = useDispatch()
  const fileRefs = useRef({})
  const today    = () => new Date().toISOString().split('T')[0]

  const [bons,       setBons]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [bcModal,       setBcModal]       = useState(null)  // bon object for detail modal
  const [bcModalLoading,setBcModalLoading] = useState(false)

  // Create modal
  const [showNewBc,   setShowNewBc]   = useState(false)
  const [newBcObjet,  setNewBcObjet]  = useState('')
  const [newBcDate,   setNewBcDate]   = useState(today())
  const [newBcRef,    setNewBcRef]    = useState('')
  const [newBcNotes,  setNewBcNotes]  = useState('')
  const [creatingBc,  setCreatingBc]  = useState(false)
  const [createBcErr, setCreateBcErr] = useState(null)
  // proformas to attach at creation (list of {fournisseur_nom, reference, montant, notes, file})
  const [createPfs,   setCreatePfs]   = useState([])

  const [proformaViewer, setProformaViewer] = useState(null) // { url, title }

  // per-bon states (keyed by bon.id) — used inside BC detail modal
  const [panel,    setPanel]    = useState({})
  const [selPf,    setSelPf]    = useState({})
  const [comment,  setComment]  = useState({})
  const [newPf,    setNewPf]    = useState({})
  const [uploading,setUploading]= useState({})
  const [actErr,   setActErr]   = useState({})

  const reload = useCallback(() => {
    getBonsCommande({ fiche_type: ficheType.toUpperCase(), fiche_id: ficheId, page_size: 50 })
      .then((d) => {
        const list = d.results ?? d
        setBons(list)
        onBcsLoaded?.(list)
        // Refresh bcModal with full detail if open
        setBcModal((prev) => {
          if (!prev) return null
          getBonCommandeById(prev.id).then(setBcModal).catch(() => {})
          return prev
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ficheType, ficheId, onBcsLoaded])

  const openBcModal = async (bon) => {
    setBcModalLoading(true)
    try {
      const full = await getBonCommandeById(bon.id)
      setBcModal(full)
    } catch {
      setBcModal(bon) // fallback
    } finally {
      setBcModalLoading(false)
    }
  }

  useEffect(() => { setLoading(true); reload() }, [reload])

  const openCreateModal = () => {
    setShowNewBc(true)
    setCreateBcErr(null)
    setNewBcObjet('')
    setNewBcDate(today())
    setNewBcRef('')
    setNewBcNotes('')
    setCreatePfs([])
  }

  const addCreatePf = () =>
    setCreatePfs((p) => [...p, { fournisseur_nom: '', reference: '', montant: '', notes: '', file: null }])

  const updateCreatePf = (i, field, value) =>
    setCreatePfs((p) => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

  const removeCreatePf = (i) =>
    setCreatePfs((p) => p.filter((_, idx) => idx !== i))

  const togglePanel = (bonId, name) =>
    setPanel((p) => ({ ...p, [bonId]: p[bonId] === name ? null : name }))

  const doAction = async (bonId, thunk, arg) => {
    setActErr((p) => ({ ...p, [bonId]: null }))
    try {
      await dispatch(thunk(arg)).unwrap()
      setPanel((p)   => ({ ...p, [bonId]: null }))
      setSelPf((p)   => ({ ...p, [bonId]: '' }))
      setComment((p) => ({ ...p, [bonId]: '' }))
      reload()
    } catch (e) {
      setActErr((p) => ({ ...p, [bonId]: typeof e === 'string' ? e : JSON.stringify(e) }))
    }
  }

  const handleUpload = async (bonId, e) => {
    e.preventDefault()
    const pf = newPf[bonId] || {}
    if (!pf.fournisseur_nom) return
    setUploading((p) => ({ ...p, [bonId]: true }))
    const fd = new FormData()
    fd.append('fournisseur_nom', pf.fournisseur_nom)
    if (pf.reference) fd.append('reference', pf.reference)
    if (pf.montant)   fd.append('montant',   pf.montant)
    if (pf.notes)     fd.append('notes',     pf.notes)
    const file = fileRefs.current[bonId]?.files?.[0]
    if (file) fd.append('fichier', file)
    try {
      await dispatch(uploadProforma({ bonId, formData: fd })).unwrap()
      setNewPf((p) => ({ ...p, [bonId]: { fournisseur_nom: '', reference: '', montant: '', notes: '' } }))
      if (fileRefs.current[bonId]) fileRefs.current[bonId].value = ''
      reload()
    } catch (e) {
      setActErr((p) => ({ ...p, [bonId]: typeof e === 'string' ? e : 'Erreur upload' }))
    } finally {
      setUploading((p) => ({ ...p, [bonId]: false }))
    }
  }

  const handleCreateBc = async (e) => {
    e.preventDefault()
    if (!newBcObjet.trim()) return
    setCreateBcErr(null)
    setCreatingBc(true)
    try {
      const bon = await createBonCommande({
        objet: newBcObjet.trim(),
        date: newBcDate,
        reference: newBcRef.trim() || undefined,
        notes: newBcNotes.trim() || undefined,
        fiche_type: ficheType.toUpperCase(),
        fiche_id: ficheId,
      })
      // Upload proformas if any were added
      for (const pf of createPfs) {
        if (!pf.fournisseur_nom.trim()) continue
        const fd = new FormData()
        fd.append('fournisseur_nom', pf.fournisseur_nom.trim())
        if (pf.reference) fd.append('reference', pf.reference)
        if (pf.montant)   fd.append('montant',   pf.montant)
        if (pf.notes)     fd.append('notes',     pf.notes)
        if (pf.file)      fd.append('fichier',   pf.file)
        await dispatch(uploadProforma({ bonId: bon.id, formData: fd })).unwrap()
      }
      setShowNewBc(false)
      reload()
    } catch (e) {
      setCreateBcErr(typeof e === 'string' ? e : 'Erreur lors de la création')
    } finally {
      setCreatingBc(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Bons de Commande</h2>
        </div>
        <div className="flex justify-center py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      </div>
    )
  }

  if (bons.length === 0 && !bcCanWrite(user)) return null

  // ── BC Detail Modal content ───────────────────────────────────────────────
  const BcDetailModal = ({ bon }) => {
    const proformas = bon.factures_proforma ?? []
    const selected  = bon.fournisseur_selectionne_detail
    const curPanel  = panel[bon.id]
    const bonIdStr  = String(bon.id)

    return (
      <Modal
        title={`${bon.numero} — ${bon.objet}`}
        onClose={() => setBcModal(null)}
        maxWidth="max-w-3xl"
      >
        <div className="px-6 py-5 space-y-5">

          {/* Workflow */}
          <BcWorkflowMini status={bon.status} />

          {/* Info row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Numéro</p>
              <p className="font-mono font-semibold text-gray-800">{bon.numero}</p>
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Date</p>
              <p className="text-gray-800">{bon.date ? formatDate(bon.date) : '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Statut</p>
              {(() => { const cfg = BC_STATUS[bon.status] ?? BC_STATUS.DRAFT; return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              )})()}
            </div>
            {bon.montant_total && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Montant</p>
                <p className="font-bold text-gray-900">{formatMontant(bon.montant_total)}</p>
              </div>
            )}
          </div>

          {/* Error */}
          {actErr[bon.id] && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {actErr[bon.id]}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-wrap gap-2">
            {bon.status === 'DRAFT' && bcCanWrite(user) && (
              <button
                onClick={() => doAction(bon.id, soumettreDAF, bonIdStr)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Soumettre pour proformas
              </button>
            )}
            {(bon.status === 'DRAFT' || bon.status === 'PENDING_PROFORMA') && bcCanUpload(user) && (
              <button
                onClick={() => togglePanel(bon.id, 'upload')}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  curPanel === 'upload' ? 'bg-gray-200 border-gray-300 text-gray-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                {curPanel === 'upload' ? 'Annuler' : 'Ajouter une proforma'}
              </button>
            )}
            {bon.status === 'PENDING_PROFORMA' && bcCanDAF(user) && (
              <button
                disabled={proformas.length === 0}
                onClick={() => togglePanel(bon.id, 'valider')}
                title={proformas.length === 0 ? "Uploadez d'abord au moins une proforma" : ''}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  curPanel === 'valider' ? 'bg-amber-200 border border-amber-400 text-amber-900' : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Valider les proformas
              </button>
            )}
            {bon.status === 'PENDING_DAF' && bcCanDAF(user) && (
              <>
                <button onClick={() => togglePanel(bon.id, 'approuver-daf')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                  Approuver (DAF)
                </button>
                <button onClick={() => togglePanel(bon.id, 'rejeter-daf')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                  Rejeter
                </button>
              </>
            )}
            {bon.status === 'PENDING_DG' && bcCanDG(user) && (
              <>
                <button onClick={() => togglePanel(bon.id, 'approuver-dg')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                  Approuver (DG)
                </button>
                <button onClick={() => togglePanel(bon.id, 'rejeter-dg')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                  Rejeter
                </button>
              </>
            )}
            {bon.status === 'APPROVED' && bcCanWrite(user) && (
              <button onClick={() => doAction(bon.id, executerBC, bonIdStr)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                Mettre en exécution
              </button>
            )}
            {bon.status === 'IN_EXECUTION' && bcCanWrite(user) && (
              <button onClick={() => doAction(bon.id, cloturerBC, bonIdStr)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                Clôturer
              </button>
            )}
          </div>

          {/* ── Panel: Upload proforma ── */}
          {curPanel === 'upload' && (
            <form onSubmit={(e) => handleUpload(bon.id, e)} className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nouvelle facture proforma</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Fournisseur <span className="text-red-500">*</span></label>
                  <input type="text" className="form-input"
                    value={(newPf[bon.id] || {}).fournisseur_nom || ''}
                    onChange={(e) => setNewPf((p) => ({ ...p, [bon.id]: { ...(p[bon.id] || {}), fournisseur_nom: e.target.value } }))}
                    placeholder="Nom du fournisseur" required />
                </div>
                <div>
                  <label className="form-label text-xs">Référence</label>
                  <input type="text" className="form-input"
                    value={(newPf[bon.id] || {}).reference || ''}
                    onChange={(e) => setNewPf((p) => ({ ...p, [bon.id]: { ...(p[bon.id] || {}), reference: e.target.value } }))}
                    placeholder="N° devis" />
                </div>
                <div>
                  <label className="form-label text-xs">Montant (FCFA)</label>
                  <input type="number" min="0" step="1" className="form-input"
                    value={(newPf[bon.id] || {}).montant || ''}
                    onChange={(e) => setNewPf((p) => ({ ...p, [bon.id]: { ...(p[bon.id] || {}), montant: e.target.value } }))}
                    placeholder="0" />
                </div>
                <div>
                  <label className="form-label text-xs">Fichier (PDF / image)</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input text-sm"
                    ref={(el) => { fileRefs.current[bon.id] = el }} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label text-xs">Notes</label>
                  <input type="text" className="form-input"
                    value={(newPf[bon.id] || {}).notes || ''}
                    onChange={(e) => setNewPf((p) => ({ ...p, [bon.id]: { ...(p[bon.id] || {}), notes: e.target.value } }))}
                    placeholder="Observations" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => togglePanel(bon.id, 'upload')} className="btn-secondary text-xs py-1.5">Annuler</button>
                <button type="submit" disabled={uploading[bon.id] || !(newPf[bon.id] || {}).fournisseur_nom}
                  className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
                  {uploading[bon.id]
                    ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                  }
                  Uploader
                </button>
              </div>
            </form>
          )}

          {/* ── Panel: Valider proformas ── */}
          {curPanel === 'valider' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Sélectionner le fournisseur retenu</p>
              <div className="space-y-2">
                {proformas.map((pf) => (
                  <label key={pf.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selPf[bon.id] === String(pf.id) ? 'border-amber-400 bg-amber-100' : 'border-gray-200 bg-white hover:border-amber-300'
                  }`}>
                    <input type="radio" name={`pf-${bon.id}`} value={pf.id}
                      checked={selPf[bon.id] === String(pf.id)}
                      onChange={(e) => setSelPf((p) => ({ ...p, [bon.id]: e.target.value }))}
                      className="h-4 w-4 text-amber-500" />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800">{pf.fournisseur_nom}</span>
                      {pf.reference && <span className="ml-2 text-xs text-gray-500">Réf : {pf.reference}</span>}
                      {pf.montant && <span className="ml-3 font-bold text-gray-900">{Number(pf.montant).toLocaleString('fr-FR')} FCFA</span>}
                    </div>
                    {pf.fichier && (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setProformaViewer({ url: pf.fichier, title: pf.fournisseur_nom }) }}
                        className="text-xs text-blue-600 hover:underline flex-shrink-0 font-medium">
                        Voir
                      </button>
                    )}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!selPf[bon.id]}
                  onClick={() => doAction(bon.id, validerProformas, { id: bonIdStr, data: { fournisseur_selectionne: selPf[bon.id] } })}
                  className="btn-primary text-xs py-1.5 disabled:opacity-50">
                  Valider et soumettre au DAF
                </button>
                <button onClick={() => togglePanel(bon.id, 'valider')} className="btn-secondary text-xs py-1.5">Annuler</button>
              </div>
            </div>
          )}

          {/* ── Panel: DAF/DG comment ── */}
          {(curPanel === 'approuver-daf' || curPanel === 'rejeter-daf' || curPanel === 'approuver-dg' || curPanel === 'rejeter-dg') && (
            <div className={`rounded-xl border p-4 space-y-3 ${curPanel.includes('rejeter') ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                {curPanel.includes('approuver') ? 'Commentaire (optionnel)' : 'Motif de rejet'}
              </p>
              <textarea rows={2} className="form-input w-full"
                value={comment[bon.id] || ''}
                onChange={(e) => setComment((p) => ({ ...p, [bon.id]: e.target.value }))}
                placeholder="Votre commentaire…" />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const data = { commentaire: comment[bon.id] || '' }
                    if (curPanel === 'approuver-daf') doAction(bon.id, approuverDAF, { id: bonIdStr, data })
                    if (curPanel === 'rejeter-daf')   doAction(bon.id, rejeterDAF,   { id: bonIdStr, data })
                    if (curPanel === 'approuver-dg')  doAction(bon.id, approuverDG,  { id: bonIdStr, data })
                    if (curPanel === 'rejeter-dg')    doAction(bon.id, rejeterDG,    { id: bonIdStr, data })
                  }}
                  className={`text-xs py-1.5 px-3 rounded-lg font-medium text-white transition-colors ${
                    curPanel.includes('rejeter') ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                  }`}>
                  Confirmer
                </button>
                <button onClick={() => togglePanel(bon.id, curPanel)} className="btn-secondary text-xs py-1.5">Annuler</button>
              </div>
            </div>
          )}

          {/* ── Proforma list ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Factures proforma {proformas.length > 0 && `(${proformas.length})`}
            </p>
            {selected && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <p className="text-sm font-medium text-green-900">
                  Retenu : <span className="font-bold">{selected.fournisseur_nom}</span>
                  {selected.montant && <span className="ml-2 text-xs text-green-700">{formatMontant(selected.montant)}</span>}
                </p>
              </div>
            )}
            {proformas.length === 0
              ? <p className="text-xs text-gray-400 italic">Aucune facture proforma uploadée.</p>
              : (
                <div className="space-y-2">
                  {proformas.map((pf) => {
                    const isSelectedPf = bon.fournisseur_selectionne === pf.id
                    const fileUrl = pf.fichier
                      ? pf.fichier.startsWith('http') ? pf.fichier
                        : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000'}${pf.fichier}`
                      : null
                    return (
                      <div key={pf.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                        isSelectedPf ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                      }`}>
                        <svg className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{pf.fournisseur_nom}</p>
                          <p className="text-xs text-gray-500">
                            {pf.montant ? formatMontant(pf.montant) : 'Montant non renseigné'}
                            {pf.uploaded_at && <> · {formatDate(pf.uploaded_at)}</>}
                          </p>
                        </div>
                        {isSelectedPf && (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">Retenu</span>
                        )}
                        {!isSelectedPf && bcCanDAF(user) && ['PENDING_PROFORMA', 'PENDING_DAF', 'PENDING_DG'].includes(bon.status) && (
                          <button
                            onClick={() => doAction(bon.id, selectionnerFourn, { id: bonIdStr, proformaId: pf.id })}
                            className="text-xs font-medium text-green-600 hover:text-green-800 border border-green-300 px-2 py-1 rounded-lg hover:bg-green-50 flex-shrink-0">
                            Sélectionner
                          </button>
                        )}
                        {fileUrl && (
                          <button type="button"
                            onClick={() => setProformaViewer({ url: fileUrl, title: pf.fournisseur_nom })}
                            className="text-xs text-blue-600 hover:underline flex-shrink-0 font-medium">
                            Voir fichier
                          </button>
                        )}
                        {bcCanWrite(user) && (
                          <button
                            onClick={() => doAction(bon.id, deleteProforma, { bonId: bonIdStr, proformaId: pf.id })}
                            className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>

          {/* Link */}
          <div className="pt-2 border-t border-gray-100">
            <Link to={`/bons-commande/${bon.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
              Voir le bon de commande complet
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

        </div>
      </Modal>
    )
  }

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Bons de Commande
          {bons.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">{bons.length}</span>
          )}
        </h2>
        {bcCanWrite(user) && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau BC
          </button>
        )}
      </div>

      {/* ── Modal création BC ── */}
      {showNewBc && bcCanWrite(user) && (
        <Modal title="Nouveau Bon de Commande" onClose={() => setShowNewBc(false)} maxWidth="max-w-2xl">
          <form onSubmit={handleCreateBc} className="px-6 py-5 space-y-5">
            {createBcErr && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{createBcErr}</div>
            )}

            {/* Champs principaux */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Date <span className="text-red-500">*</span></label>
                <input type="date" required className="form-input"
                  value={newBcDate}
                  onChange={(e) => setNewBcDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Référence</label>
                <input type="text" className="form-input"
                  value={newBcRef}
                  onChange={(e) => setNewBcRef(e.target.value)}
                  placeholder="ex. REF-9051" />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Objet <span className="text-red-500">*</span></label>
                <input type="text" required autoFocus className="form-input"
                  value={newBcObjet}
                  onChange={(e) => setNewBcObjet(e.target.value)}
                  placeholder="ex. Frais de reprographie et impression" />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Notes</label>
                <textarea rows={2} className="form-input"
                  value={newBcNotes}
                  onChange={(e) => setNewBcNotes(e.target.value)}
                  placeholder="Observations, informations complémentaires…" />
              </div>
            </div>

            {/* Factures proforma */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Factures proforma</p>
                <button type="button" onClick={addCreatePf}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ajouter une proforma
                </button>
              </div>

              {createPfs.length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucune proforma — vous pourrez en ajouter après la création.</p>
              )}

              <div className="space-y-3">
                {createPfs.map((pf, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Proforma {i + 1}</span>
                      <button type="button" onClick={() => removeCreatePf(i)}
                        className="p-1 text-gray-400 hover:text-red-500">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="form-label text-xs">Fournisseur <span className="text-red-500">*</span></label>
                        <input type="text" className="form-input"
                          value={pf.fournisseur_nom}
                          onChange={(e) => updateCreatePf(i, 'fournisseur_nom', e.target.value)}
                          placeholder="Nom du fournisseur" />
                      </div>
                      <div>
                        <label className="form-label text-xs">Référence</label>
                        <input type="text" className="form-input"
                          value={pf.reference}
                          onChange={(e) => updateCreatePf(i, 'reference', e.target.value)}
                          placeholder="N° devis" />
                      </div>
                      <div>
                        <label className="form-label text-xs">Montant (FCFA)</label>
                        <input type="number" min="0" step="1" className="form-input"
                          value={pf.montant}
                          onChange={(e) => updateCreatePf(i, 'montant', e.target.value)}
                          placeholder="0" />
                      </div>
                      <div>
                        <label className="form-label text-xs">Fichier (PDF / image)</label>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input text-sm"
                          onChange={(e) => updateCreatePf(i, 'file', e.target.files?.[0] ?? null)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="form-label text-xs">Notes</label>
                        <input type="text" className="form-input"
                          value={pf.notes}
                          onChange={(e) => updateCreatePf(i, 'notes', e.target.value)}
                          placeholder="Observations" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowNewBc(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={creatingBc || !newBcObjet.trim()} className="btn-primary flex items-center gap-1.5">
                {creatingBc && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Créer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {bons.length === 0 && (
        <div className="px-6 py-8 text-center text-sm text-gray-400 italic">
          Aucun bon de commande lié. Créez-en un via le bouton ci-dessus.
        </div>
      )}

      {/* ── BC list rows ── */}
      <div className="divide-y divide-gray-100">
        {bons.map((bon) => {
          return (
            <button
              key={bon.id}
              type="button"
              onClick={() => openBcModal(bon)}
              disabled={bcModalLoading}
              className="w-full flex flex-col gap-2.5 px-6 py-4 text-left hover:bg-gray-50/70 transition-colors disabled:opacity-60"
            >
              {/* Ligne 1 : identité */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-gray-700 w-28 flex-shrink-0">{bon.numero}</span>
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{bon.objet}</span>
                {bon.factures_proforma?.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5" />
                    </svg>
                    {bon.factures_proforma.length} proforma{bon.factures_proforma.length > 1 ? 's' : ''}
                  </span>
                )}
                <svg className="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              {/* Ligne 2 : cycle de vie */}
              <div className="pl-[7.5rem]">
                <BcWorkflowMini status={bon.status} showLabels />
              </div>
            </button>
          )
        })}
      </div>

      {/* ── BC Detail Modal ── */}
      {bcModal && <BcDetailModal bon={bcModal} />}

      {/* ── Viewer facture proforma ── */}
      {proformaViewer && (
        <ProformaViewer
          url={proformaViewer.url}
          title={proformaViewer.title}
          onClose={() => setProformaViewer(null)}
        />
      )}
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
  const [hasBcApproved,    setHasBcApproved]    = useState(false)

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

  const canExecute     = fiche?.status === 'APPROVED' && hasBcApproved && (userRole === 'DAF' || userRole === 'ADMIN' || user?.is_finance_team === true)
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

          {/* ── Bons de commande liés ─────────────────────────────────── */}
          <BonsCommandeSection
            ficheType={ficheType}
            ficheId={Number(id)}
            user={user}
            onBcsLoaded={(list) => setHasBcApproved(list.some((b) => BC_APPROVED_STATUSES.includes(b.status)))}
          />

          {/* ── Bons de paiement liés ────────────────────────────────── */}
          <BonsPaiementSection
            ficheType={ficheType}
            ficheId={Number(id)}
            user={user}
            fiche={fiche}
          />

          {/* ── Missions liées (fiche externe uniquement) ─────────── */}
          {isExterne && (
            <MissionsSection ficheId={Number(id)} ficheData={fiche} user={user} />
          )}

          {/* Warning: fiche approuvée mais aucun BC validé */}
          {fiche?.status === 'APPROVED' && !hasBcApproved && (userRole === 'DAF' || userRole === 'ADMIN') && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Bon de commande requis</p>
                <p className="text-xs text-amber-700 mt-0.5">Un bon de commande doit être approuvé avant d'émettre le bon de paiement.</p>
              </div>
            </div>
          )}

          {/* ── Bon de paiement (exécution) ───────────────────────────── */}
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
