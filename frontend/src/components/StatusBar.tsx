import type { ControllerStatus } from '../types'

interface Props {
  status: ControllerStatus | null
  connected: boolean
}

export function StatusBar({ status, connected }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-6 text-sm flex-wrap">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'
          }`}
        />
        <span className="text-gray-600">
          {connected ? 'Connecté' : 'Déconnecté'}
        </span>
      </div>

      {status && (
        <>
          <div className="flex items-center gap-1.5 text-gray-500">
            <span>Pluie :</span>
            <span
              className={
                status.rain_sensor
                  ? 'text-blue-500 font-medium'
                  : 'text-gray-400'
              }
            >
              {status.rain_sensor ? 'Détectée' : 'Non'}
            </span>
          </div>

          {status.active_zone ? (
            <div className="flex items-center gap-1.5 text-green-600 font-medium">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Zone {status.active_zone} active
              {status.minutes_remaining !== null && (
                <span className="text-green-500">
                  — {Math.ceil(status.minutes_remaining)} min
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400">Aucune zone active</span>
          )}
        </>
      )}
    </div>
  )
}
