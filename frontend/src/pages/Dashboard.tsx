import { useQuery } from '@tanstack/react-query'
import { zonesApi } from '../api/client'
import { ZoneCard } from '../components/ZoneCard'

export function Dashboard() {
  const { data: zones, isLoading, isError } = useQuery({
    queryKey: ['zones'],
    queryFn: zonesApi.list,
    refetchInterval: 5000,
  })

  const anyActive = zones?.some((z) => z.is_active) ?? false

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Connexion au contrôleur…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-48 text-red-400">
        Impossible de joindre l'API. Vérifiez que le backend est démarré.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Zones d'arrosage</h2>
        {anyActive && (
          <span className="text-sm text-green-600 font-medium bg-green-100 px-3 py-1 rounded-full">
            Arrosage en cours
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {zones?.map((zone) => (
          <ZoneCard key={zone.zone_id} zone={zone} anyActive={anyActive} />
        ))}
      </div>
    </div>
  )
}
