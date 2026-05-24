import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { historyApi } from '../api/client'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatActualDuration(
  started: string,
  ended: string | null,
  planned: number,
): string {
  if (!ended) return `${planned} min (en cours)`
  const mins = Math.round(
    (new Date(ended).getTime() - new Date(started).getTime()) / 60000,
  )
  return `${mins} min`
}

export function History() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['history', page],
    queryFn: () => historyApi.list(page),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Chargement…
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Historique des arrosages
      </h2>

      {!data?.items.length ? (
        <div className="text-center py-20 text-gray-400">
          Aucun arrosage enregistré
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-sm font-semibold text-gray-600">
                  <th className="px-4 py-3">Zone</th>
                  <th className="px-4 py-3">Début</th>
                  <th className="px-4 py-3">Durée réelle</th>
                  <th className="px-4 py-3">Déclencheur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {item.zone_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(item.started_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatActualDuration(
                        item.started_at,
                        item.ended_at,
                        item.duration_minutes,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          item.trigger_type === 'manual'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {item.trigger_type === 'manual' ? 'Manuel' : 'Programme'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                ← Précédent
              </button>
              <span className="text-gray-500">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-4 py-1.5 border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
