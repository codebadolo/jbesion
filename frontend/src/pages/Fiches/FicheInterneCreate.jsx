import React from 'react'
import FicheInterneForm from '../../components/Fiches/FicheInterneForm.jsx'

export default function FicheInterneCreate() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nouvelle Fiche de Besoin Interne</h1>
        <p className="text-sm text-gray-500 mt-0.5">Remplissez tous les champs requis</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-gray-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Fiche Interne</h2>
            <p className="text-xs text-gray-500">Besoins matériels ou services internes à l'organisation</p>
          </div>
        </div>
        <FicheInterneForm />
      </div>
    </div>
  )
}
