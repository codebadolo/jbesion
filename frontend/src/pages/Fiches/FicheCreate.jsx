import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FicheInterneForm from '../../components/Fiches/FicheInterneForm.jsx'
import FicheExterneForm from '../../components/Fiches/FicheExterneForm.jsx'

const TYPES = [
  {
    id: 'interne',
    label: 'Fiche Interne',
    description: "Besoins mat\u00e9riels ou services internes \u00e0 l'organisation",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
      </svg>
    ),
    color: 'blue',
  },
  {
    id: 'externe',
    label: 'Fiche Externe',
    description: 'Prestations ou services fournis par des prestataires externes',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    color: 'indigo',
  },
]

export default function FicheCreate() {
  const [searchParams] = useSearchParams()
  const defaultType = searchParams.get('type') === 'externe' ? 'externe' : 'interne'
  const [selectedType, setSelectedType] = useState(defaultType)

  const colorMap = {
    blue: {
      selected: 'border-blue-500 bg-blue-50 ring-1 ring-blue-500',
      icon: 'bg-blue-100 text-blue-600',
      label: 'text-blue-800',
      desc: 'text-blue-600',
    },
    indigo: {
      selected: 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500',
      icon: 'bg-indigo-100 text-indigo-600',
      label: 'text-indigo-800',
      desc: 'text-indigo-600',
    },
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nouvelle Fiche de Besoins</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Choisissez le type de fiche, puis remplissez le formulaire.
        </p>
      </div>

      {/* Type selector */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">
          Type de fiche <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TYPES.map((type) => {
            const colors = colorMap[type.color]
            const isSelected = selectedType === type.id
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={[
                  'flex items-start gap-4 rounded-xl border p-4 text-left transition-all',
                  isSelected
                    ? colors.selected
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${isSelected ? colors.icon : 'bg-gray-100 text-gray-500'} transition-colors`}>
                  {type.icon}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isSelected ? colors.label : 'text-gray-800'}`}>
                    {type.label}
                    {isSelected && (
                      <span className="ml-2 inline-flex items-center">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </span>
                    )}
                  </p>
                  <p className={`mt-0.5 text-xs ${isSelected ? colors.desc : 'text-gray-500'}`}>
                    {type.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Form */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-gray-100">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg
            ${selectedType === 'interne' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
            {TYPES.find((t) => t.id === selectedType)?.icon}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              {selectedType === 'interne' ? 'Fiche de Besoin Interne' : 'Fiche de Besoin Externe'}
            </h2>
            <p className="text-xs text-gray-500">Remplissez tous les champs requis</p>
          </div>
        </div>

        {selectedType === 'interne' ? (
          <FicheInterneForm />
        ) : (
          <FicheExterneForm />
        )}
      </div>
    </div>
  )
}
