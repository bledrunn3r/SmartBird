import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import type { Zone } from '../types'
import { zonesApi } from '../api/client'

const DURATIONS = [5, 10, 15, 20, 30]

interface Props {
  zone: Zone
  anyActive: boolean
}

export function ZoneCard({ zone, anyActive }: Props) {
  const qc = useQueryClient()
  const [duration, setDuration] = useState(10)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(zone.name)

  const startMutation = useMutation({
    mutationFn: () => zonesApi.start(zone.zone_id, duration),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  })

  const stopMutation = useMutation({
    mutationFn: () => zonesApi.stop(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  })

  const renameMutation = useMutation({
    mutationFn: (name: string) => zonesApi.update(zone.zone_id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  })

  const handleRename = () => {
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== zone.name) renameMutation.mutate(trimmed)
    setEditingName(false)
  }

  return (
    <div
      className={clsx(
        'rounded-2xl border-2 p-4 transition-all duration-300',
        zone.is_active
          ? 'border-green-400 bg-green-50 shadow-lg shadow-green-100'
          : 'border-gray-200 bg-white hover:border-gray-300',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <span
          className={clsx(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            zone.is_active
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-500',
          )}
        >
          Zone {zone.zone_id}
        </span>
        <div
          className={clsx(
            'w-2.5 h-2.5 rounded-full mt-1',
            zone.is_active ? 'bg-green-400 animate-pulse' : 'bg-gray-200',
          )}
        />
      </div>

      {/* Name */}
      {editingName ? (
        <input
          className="w-full text-base font-semibold border-b border-gray-300 outline-none mb-1 bg-transparent"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          autoFocus
        />
      ) : (
        <h3
          className="text-base font-semibold text-gray-800 mb-1 cursor-pointer hover:text-green-600 truncate"
          title={zone.name}
          onClick={() => setEditingName(true)}
        >
          {zone.name}
        </h3>
      )}

      {/* Status */}
      {zone.is_active && zone.minutes_remaining !== null ? (
        <p className="text-sm text-green-600 font-medium mb-3">
          {Math.ceil(zone.minutes_remaining)} min restantes
        </p>
      ) : (
        <p className="text-sm text-gray-400 mb-3">Inactif</p>
      )}

      {/* Controls */}
      {zone.is_active ? (
        <button
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
          className="w-full py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-xl font-medium transition-colors"
        >
          Arrêter
        </button>
      ) : (
        <div className="space-y-2">
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={anyActive}
            className="w-full py-1.5 px-3 border border-gray-200 rounded-xl text-sm bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-300"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
          <button
            onClick={() => startMutation.mutate()}
            disabled={anyActive || startMutation.isPending}
            className="w-full py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            Démarrer
          </button>
        </div>
      )}
    </div>
  )
}
