import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchFiches,
  selectFichesInternes,
  selectFichesExternes,
  selectFichesLoading,
  selectFichesError,
} from '../../store/fichesSlice.js'
import { selectUser } from '../../store/authSlice.js'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'
import { formatDate } from '../../utils/helpers.js'
import { STATUS_LABELS } from '../../utils/constants.js'

const TABS = [
  { id: 'interne', label: 'Fiches Internes' },
  { id: 'externe', label: 'Fiches Externes' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DRAFT', label: STATUS_LABELS.DRAFT },
  { value: 'PENDING_MANAGER', label: STATUS_LABELS.PENDING_MANAGER },
  { value: 'PENDING_DAF', label: STATUS_LABELS.PENDING_DAF },
  { value: 'PENDING_DIRECTOR', label: STATUS_LABELS.PENDING_DIRECTOR },
  { value: 'APPROVED', label: STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: STATUS_LABELS.REJECTED },
]

export default function FichesList() {
  const dispatch = useDispatch()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = searchParams.get('tab') || 'interne'
  const [statusFilter, setStatusFilter] = useState('')

  const fichesInternes = useSelector(selectFichesInternes)
  const fichesExternes = useSelector(selectFichesExternes)
  const isLoading = useSelector(selectFichesLoading)
  const error = useSelector(selectFichesError)
  const user = useSelector(selectUser)

  const fiches = activeTab === 'interne' ? fichesInternes : fichesExternes

  useEffect(() => {
    dispatch(
      fetchFiches({
        type: activeTab,
        params: statusFilter ? { status: statusFilter } : {},
      }),
    )
  }, [dispatch, activeTab, statusFilter])

  const handleTabChange = (tab) => {
    setSearchParams({ tab })
    setStatusFilter('')
  }

  // Filter client-side as well for instant feedback
  const filtered = statusFilter
    ? fiches.filter((f) => f.status === statusFilter)
    : fiches

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mes Fiches de Besoins</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gérez et suivez vos demandes
          </p>
        </div>
        <Link to="/fiches/create" className="btn-primary">
          <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle fiche
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={[
                'pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {tab.label}
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold
                  ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {tab.id === 'interne' ? fichesInternes.length : fichesExternes.length}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input pl-8 pr-8 py-1.5 text-sm appearance-none cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
        {statusFilter && (
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-600">
            {typeof error === 'string' ? error : 'Erreur lors du chargement.'}
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner message="Chargement des fiches..." />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">
              {statusFilter
                ? `Aucune fiche avec le statut "${STATUS_LABELS[statusFilter] || statusFilter}"`
                : 'Aucune fiche trouvée'}
            </p>
            {!statusFilter && (
              <Link
                to={`/fiches/create?type=${activeTab}`}
                className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Créer une fiche {activeTab === 'interne' ? 'interne' : 'externe'} →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className="table-header">N°</th>
                  <th className="table-header">Créé par</th>
                  <th className="table-header">Département</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Statut</th>
                  <th className="table-header">Articles</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {filtered.map((fiche) => {
                  const isOwner = fiche.created_by === user?.id
                  return (
                    <tr key={fiche.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <span className="font-mono text-xs text-gray-500">
                          #{fiche.id}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            {(fiche.created_by_name || '')
                              .split(' ')
                              .map((w) => w[0] || '')
                              .slice(0, 2)
                              .join('')
                              .toUpperCase() || '?'}
                          </div>
                          <span className="font-medium text-gray-800">
                            {fiche.created_by_name || '—'}
                          </span>
                          {isOwner && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              moi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-gray-500">
                        {fiche.department_detail?.name || '—'}
                      </td>
                      <td className="table-cell text-gray-500">
                        {formatDate(fiche.created_at)}
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={fiche.status} size="sm" />
                      </td>
                      <td className="table-cell text-gray-500">
                        {fiche.item_count ?? '—'}
                      </td>
                      <td className="table-cell">
                        <Link
                          to={`/fiches-${activeTab === 'interne' ? 'internes' : 'externes'}/${fiche.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Détails
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
