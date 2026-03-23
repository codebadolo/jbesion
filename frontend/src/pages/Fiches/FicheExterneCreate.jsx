import FicheExterneForm from '../../components/Fiches/FicheExterneForm.jsx'

export default function FicheExterneCreate() {
  return (
    <div className=" space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nouvelle Fiche de Besoin Externe</h1>
        <p className="text-sm text-gray-500 mt-0.5">Remplissez tous les champs requis</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-gray-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Fiche Externe</h2>
            <p className="text-xs text-gray-500">Prestations ou services fournis par des prestataires externes</p>
          </div>
        </div>
        <FicheExterneForm />
      </div>
    </div>
  )
}
