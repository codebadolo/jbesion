import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import {
  fetchBonCommandeById,
  soumettreDAF, validerProformas,
  approuverDAF, rejeterDAF,
  approuverDG, rejeterDG,
  executerBC, cloturerBC,
  selectionnerFourn,
  uploadProforma, deleteProforma,
  clearCurrent,
  selectCurrentBonCommande,
  selectBonsCommandeLoading,
  selectBonsCommandeError,
} from '../../store/bonsCommandeSlice.js'
import { selectUser } from '../../store/authSlice.js'
import { formatDate, getFullName } from '../../utils/helpers.js'

const STATUS_CONFIG = {
  DRAFT:            { label: 'Brouillon',            color: 'bg-gray-100 text-gray-700',    step: 0 },
  PENDING_PROFORMA: { label: 'En attente proformas', color: 'bg-amber-100 text-amber-800',  step: 1 },
  PENDING_DAF:      { label: 'En attente DAF',       color: 'bg-yellow-100 text-yellow-800', step: 2 },
  PENDING_DG:       { label: 'En attente DG',        color: 'bg-orange-100 text-orange-800', step: 3 },
  APPROVED:         { label: 'Approuvé',             color: 'bg-green-100 text-green-800',   step: 4 },
  REJECTED:         { label: 'Rejeté',               color: 'bg-red-100 text-red-800',       step: -1 },
  IN_EXECUTION:     { label: 'En exécution',         color: 'bg-blue-100 text-blue-800',     step: 5 },
  DONE:             { label: 'Clôturé',              color: 'bg-teal-100 text-teal-800',     step: 6 },
}

const WORKFLOW_STEPS = ['Brouillon', 'Proformas', 'DAF', 'DG', 'Approuvé', 'Exécution', 'Clôturé']

function canDAF(user)  { return ['DAF', 'ADMIN'].includes(user?.role) }
function canDG(user)   { return ['DIRECTOR', 'ADMIN'].includes(user?.role) }
function canWrite(user){ return ['DAF', 'ADMIN'].includes(user?.role) || user?.department?.code === 'AF' || user?.is_comptable }
function canUploadProforma(user) {
  return user?.is_comptable || ['DAF', 'ADMIN'].includes(user?.role) || user?.department?.code === 'AF'
}

function WorkflowTracker({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  const current = cfg.step
  if (current < 0) {
    return (
      <div className="flex items-center justify-center py-3">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 text-red-700 font-semibold text-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Rejeté
        </span>
      </div>
    )
  }
  return (
    <ol className="flex items-center gap-0 w-full">
      {WORKFLOW_STEPS.map((label, i) => {
        const done    = i < current
        const active  = i === current
        const isLast  = i === WORKFLOW_STEPS.length - 1
        return (
          <React.Fragment key={label}>
            <li className="flex flex-col items-center text-center flex-shrink-0">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                done   ? 'bg-green-500 border-green-500 text-white' :
                active ? 'border-blue-500 bg-blue-50 text-blue-700' :
                         'border-gray-200 bg-gray-50 text-gray-400'
              }`}>
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${active ? 'text-blue-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </li>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

function ProformaCard({ p, bon, user, onSelect, onDelete }) {
  const isSelected = bon?.fournisseur_selectionne?.id === p.id || bon?.fournisseur_selectionne === p.id
  const canSelect  = canDAF(user) || canDG(user)
  const fileUrl = p.fichier
    ? p.fichier.startsWith('http') ? p.fichier
      : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000'}${p.fichier}`
    : null

  return (
    <div className={`relative rounded-xl border p-4 transition-all ${isSelected ? 'border-green-400 bg-green-50 ring-2 ring-green-400/40' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      {isSelected && (
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-semibold">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Sélectionné
        </span>
      )}
      <div className="space-y-1.5">
        <p className="font-semibold text-gray-800 pr-20">{p.fournisseur_nom}</p>
        {p.reference && <p className="text-xs text-gray-500">Réf : {p.reference}</p>}
        {p.montant && (
          <p className="text-lg font-bold text-gray-900">
            {Number(p.montant).toLocaleString('fr-FR')} FCFA
          </p>
        )}
        {p.notes && <p className="text-xs text-gray-500 italic">{p.notes}</p>}
        <p className="text-xs text-gray-400">Uploadé le {formatDate(p.uploaded_at)}</p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32" />
            </svg>
            Voir le fichier
          </a>
        )}
        {canSelect && !isSelected && (
          <button onClick={() => onSelect(p.id)}
            className="ml-auto text-xs font-medium text-green-600 hover:text-green-800 border border-green-300 px-2 py-1 rounded-lg hover:bg-green-50">
            Sélectionner
          </button>
        )}
        {canWrite(user) && (
          <button onClick={() => onDelete(p.id)}
            className="ml-auto p-1 text-gray-400 hover:text-red-600 rounded">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function BonCommandeDetail() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { id }   = useParams()
  const bon      = useSelector(selectCurrentBonCommande)
  const loading  = useSelector(selectBonsCommandeLoading)
  const apiError = useSelector(selectBonsCommandeError)
  const user     = useSelector(selectUser)

  const fileInputRef = useRef(null)
  const [actionError,      setActionError]      = useState(null)
  const [commentaire,      setCommentaire]      = useState('')
  const [showComment,      setShowComment]      = useState(null)
  const [uploading,        setUploading]        = useState(false)
  const [newProforma,      setNewProforma]      = useState({ fournisseur_nom: '', reference: '', montant: '', notes: '' })
  const [selectedProforma, setSelectedProforma] = useState('')

  useEffect(() => {
    dispatch(fetchBonCommandeById(id))
    return () => dispatch(clearCurrent())
  }, [dispatch, id])

  const doAction = async (thunk, arg) => {
    setActionError(null)
    try { await dispatch(thunk(arg)).unwrap() }
    catch (e) { setActionError(typeof e === 'string' ? e : JSON.stringify(e)) }
    setShowComment(null)
    setCommentaire('')
  }

  const handleUploadProforma = async (e) => {
    e.preventDefault()
    if (!newProforma.fournisseur_nom) return
    setUploading(true)
    const fd = new FormData()
    fd.append('fournisseur_nom', newProforma.fournisseur_nom)
    if (newProforma.reference) fd.append('reference', newProforma.reference)
    if (newProforma.montant)   fd.append('montant',   newProforma.montant)
    if (newProforma.notes)     fd.append('notes',     newProforma.notes)
    const file = fileInputRef.current?.files?.[0]
    if (file) fd.append('fichier', file)
    await dispatch(uploadProforma({ bonId: id, formData: fd }))
    setNewProforma({ fournisseur_nom: '', reference: '', montant: '', notes: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
  }

  if (loading && !bon) {
    return (
      <div className="flex items-center justify-center py-32">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    )
  }
  if (!bon) return null

  const cfg = STATUS_CONFIG[bon.status] ?? STATUS_CONFIG.DRAFT

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bons-commande')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{bon.numero}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Créé le {formatDate(bon.created_at)} par {getFullName(bon.created_by_detail) || '—'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {bon.status === 'DRAFT' && canWrite(user) && (
            <button onClick={() => doAction(soumettreDAF, id)} disabled={loading}
              className="btn-primary flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Soumettre pour proformas
            </button>
          )}
          {bon.status === 'PENDING_PROFORMA' && canDAF(user) && (
            <button
              onClick={() => setShowComment(showComment === 'valider-proformas' ? null : 'valider-proformas')}
              disabled={!bon.factures_proforma?.length}
              className="btn-primary flex items-center gap-2"
              title={!bon.factures_proforma?.length ? 'Uploadez d\'abord au moins une proforma' : ''}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Valider les proformas
            </button>
          )}
          {bon.status === 'PENDING_DAF' && canDAF(user) && (
            <>
              <button onClick={() => setShowComment(showComment === 'approuver-daf' ? null : 'approuver-daf')}
                className="btn-primary flex items-center gap-2">Approuver (DAF)</button>
              <button onClick={() => setShowComment(showComment === 'rejeter-daf' ? null : 'rejeter-daf')}
                className="btn-danger flex items-center gap-2">Rejeter</button>
            </>
          )}
          {bon.status === 'PENDING_DG' && canDG(user) && (
            <>
              <button onClick={() => setShowComment(showComment === 'approuver-dg' ? null : 'approuver-dg')}
                className="btn-primary flex items-center gap-2">Approuver (DG)</button>
              <button onClick={() => setShowComment(showComment === 'rejeter-dg' ? null : 'rejeter-dg')}
                className="btn-danger flex items-center gap-2">Rejeter</button>
            </>
          )}
          {bon.status === 'APPROVED' && canWrite(user) && (
            <button onClick={() => doAction(executerBC, id)} disabled={loading}
              className="btn-primary">Mettre en exécution</button>
          )}
          {bon.status === 'IN_EXECUTION' && canWrite(user) && (
            <button onClick={() => doAction(cloturerBC, id)} disabled={loading}
              className="btn-success">Clôturer</button>
          )}
        </div>
      </div>

      {/* Panneau de validation des proformas */}
      {showComment === 'valider-proformas' && (
        <div className="card p-5 border-l-4 border-amber-400 bg-amber-50">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            Validation des proformas — sélectionner le fournisseur retenu
          </p>
          {bon.factures_proforma?.length > 0 ? (
            <div className="space-y-2 mb-4">
              {bon.factures_proforma.map((p) => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedProforma === String(p.id)
                    ? 'border-amber-400 bg-amber-100'
                    : 'border-gray-200 bg-white hover:border-amber-300'
                }`}>
                  <input
                    type="radio"
                    name="proforma_select"
                    value={p.id}
                    checked={selectedProforma === String(p.id)}
                    onChange={(e) => setSelectedProforma(e.target.value)}
                    className="h-4 w-4 text-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-800">{p.fournisseur_nom}</span>
                    {p.reference && <span className="ml-2 text-xs text-gray-500">Réf : {p.reference}</span>}
                    {p.montant && (
                      <span className="ml-3 font-bold text-gray-900">
                        {Number(p.montant).toLocaleString('fr-FR')} FCFA
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-amber-700 mb-4">Aucune proforma uploadée.</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!selectedProforma) return
                doAction(validerProformas, { id, data: { fournisseur_selectionne: selectedProforma } })
                setSelectedProforma('')
              }}
              disabled={!selectedProforma}
              className="btn-primary">
              Valider et soumettre au DAF
            </button>
            <button onClick={() => { setShowComment(null); setSelectedProforma('') }}
              className="btn-secondary">Annuler</button>
          </div>
        </div>
      )}

      {/* Commentaire modal inline (DAF/DG) */}
      {showComment && showComment !== 'valider-proformas' && (
        <div className="card p-4 border-l-4 border-blue-400 bg-blue-50">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            {showComment.includes('approuver') ? 'Commentaire d\'approbation (optionnel)' : 'Motif de rejet'}
          </p>
          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
            rows={2} className="form-input w-full" placeholder="Votre commentaire…" />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                const data = { commentaire }
                if (showComment === 'approuver-daf') doAction(approuverDAF, { id, data })
                if (showComment === 'rejeter-daf')   doAction(rejeterDAF,   { id, data })
                if (showComment === 'approuver-dg')  doAction(approuverDG,  { id, data })
                if (showComment === 'rejeter-dg')    doAction(rejeterDG,    { id, data })
              }}
              className={showComment.includes('rejeter') ? 'btn-danger' : 'btn-primary'}>
              Confirmer
            </button>
            <button onClick={() => { setShowComment(null); setCommentaire('') }}
              className="btn-secondary">Annuler</button>
          </div>
        </div>
      )}

      {(actionError || apiError) && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {actionError || (typeof apiError === 'string' ? apiError : JSON.stringify(apiError))}
        </div>
      )}

      {/* Workflow tracker */}
      <div className="card p-5">
        <WorkflowTracker status={bon.status} />
      </div>

      {/* Info */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Informations</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-gray-500 font-medium">Date</dt>
            <dd className="text-gray-900 font-semibold mt-0.5">{formatDate(bon.date)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 font-medium">Référence</dt>
            <dd className="text-gray-900 mt-0.5">{bon.reference || <span className="italic text-gray-400">—</span>}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500 font-medium">Objet</dt>
            <dd className="text-gray-900 mt-0.5 whitespace-pre-line">{bon.objet}</dd>
          </div>
          {bon.notes && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500 font-medium">Notes</dt>
              <dd className="text-gray-600 mt-0.5">{bon.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Approbations */}
      {(bon.daf_approuve_par || bon.dg_approuve_par) && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Approbations</h2>
          <div className="space-y-3">
            {bon.daf_approuve_par && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-xs flex-shrink-0">
                  DAF
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{getFullName(bon.daf_approuve_par_detail)}</p>
                  <p className="text-xs text-gray-500">{formatDate(bon.daf_approuve_le)}</p>
                  {bon.daf_commentaire && <p className="mt-1 text-sm text-gray-600 italic">"{bon.daf_commentaire}"</p>}
                </div>
              </div>
            )}
            {bon.dg_approuve_par && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                  DG
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{getFullName(bon.dg_approuve_par_detail)}</p>
                  <p className="text-xs text-gray-500">{formatDate(bon.dg_approuve_le)}</p>
                  {bon.dg_commentaire && <p className="mt-1 text-sm text-gray-600 italic">"{bon.dg_commentaire}"</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Factures Proforma */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Factures Proforma
            <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-100 text-xs text-gray-600">
              {bon.factures_proforma?.length ?? 0}
            </span>
          </h2>
          {bon.fournisseur_selectionne_detail && (
            <span className="inline-flex items-center gap-1.5 text-xs text-green-700 font-medium bg-green-50 border border-green-200 px-2 py-1 rounded-full">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Fournisseur sélectionné : {bon.fournisseur_selectionne_detail.fournisseur_nom}
            </span>
          )}
        </div>

        {bon.factures_proforma?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {bon.factures_proforma.map((p) => (
              <ProformaCard
                key={p.id}
                p={p}
                bon={bon}
                user={user}
                onSelect={(pid) => doAction(selectionnerFourn, { id, proformaId: pid })}
                onDelete={(pid) => doAction(deleteProforma, { bonId: id, proformaId: pid })}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic mb-4">Aucune facture proforma uploadée.</p>
        )}

        {/* Upload form */}
        {canUploadProforma(user) && (
          <form onSubmit={handleUploadProforma} className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ajouter une proforma</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label text-xs">Nom du fournisseur <span className="text-red-500">*</span></label>
                <input type="text" value={newProforma.fournisseur_nom}
                  onChange={(e) => setNewProforma((f) => ({ ...f, fournisseur_nom: e.target.value }))}
                  className="form-input" placeholder="Ex : Fournisseur Alpha" required />
              </div>
              <div>
                <label className="form-label text-xs">Référence (optionnel)</label>
                <input type="text" value={newProforma.reference}
                  onChange={(e) => setNewProforma((f) => ({ ...f, reference: e.target.value }))}
                  className="form-input" placeholder="N° de devis…" />
              </div>
              <div>
                <label className="form-label text-xs">Montant (FCFA)</label>
                <input type="number" value={newProforma.montant} min="0" step="1"
                  onChange={(e) => setNewProforma((f) => ({ ...f, montant: e.target.value }))}
                  className="form-input" placeholder="0" />
              </div>
              <div>
                <label className="form-label text-xs">Fichier (scan / PDF)</label>
                <input type="file" ref={fileInputRef} accept=".pdf,.jpg,.jpeg,.png"
                  className="form-input text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label text-xs">Notes</label>
                <input type="text" value={newProforma.notes}
                  onChange={(e) => setNewProforma((f) => ({ ...f, notes: e.target.value }))}
                  className="form-input" placeholder="Remarques sur cette proforma…" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={uploading || !newProforma.fournisseur_nom}
                className="btn-secondary flex items-center gap-2">
                {uploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                )}
                Uploader la proforma
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
