import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulesApi, zonesApi } from '../api/client'
import type { Schedule } from '../types'

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7']

function formatDays(daysStr: string): string {
  return daysStr
    .split(',')
    .map((d) => DAY_LABELS[parseInt(d) - 1])
    .join(', ')
}

interface FormData {
  name: string
  zone_id: number
  duration_minutes: number
  days_of_week: string
  start_time: string
}

function ScheduleModal({
  onClose,
  initial,
  zoneOptions,
}: {
  onClose: () => void
  initial?: Schedule
  zoneOptions: { zone_id: number; name: string }[]
}) {
  const qc = useQueryClient()
  const defaultDays = initial?.days_of_week ?? '1,3,5'
  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? '',
    zone_id: initial?.zone_id ?? (zoneOptions[0]?.zone_id ?? 1),
    duration_minutes: initial?.duration_minutes ?? 10,
    days_of_week: defaultDays,
    start_time: initial?.start_time ?? '06:00',
  })
  const [selectedDays, setSelectedDays] = useState<string[]>(
    defaultDays.split(','),
  )

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      schedulesApi.create({ ...data, enabled: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => schedulesApi.update(initial!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      onClose()
    },
  })

  const toggleDay = (day: string) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort()
    setSelectedDays(next)
    setForm((f) => ({ ...f, days_of_week: next.join(',') }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDays.length) return
    if (initial) updateMutation.mutate(form)
    else createMutation.mutate(form)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          {initial ? 'Modifier le programme' : 'Nouveau programme'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom
            </label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zone
            </label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
              value={form.zone_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, zone_id: Number(e.target.value) }))
              }
            >
              {zoneOptions.map((z) => (
                <option key={z.zone_id} value={z.zone_id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durée (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
              value={form.duration_minutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  duration_minutes: Number(e.target.value),
                }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jours
            </label>
            <div className="flex gap-1.5">
              {DAY_KEYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedDays.includes(day)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {DAY_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heure de départ
            </label>
            <input
              type="time"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
              value={form.start_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_time: e.target.value }))
              }
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedDays.length}
              className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
            >
              {initial ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Schedules() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Schedule | undefined>()

  const { data: schedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: schedulesApi.list,
  })

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: zonesApi.list,
  })

  const toggleMutation = useMutation({
    mutationFn: schedulesApi.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: schedulesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const zoneOptions =
    zones?.map((z) => ({ zone_id: z.zone_id, name: z.name })) ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Programmes d'arrosage
        </h2>
        <button
          onClick={() => {
            setEditing(undefined)
            setShowModal(true)
          }}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
        >
          + Nouveau
        </button>
      </div>

      {!schedules?.length ? (
        <div className="text-center py-20 text-gray-400">
          Aucun programme configuré
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">{s.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      s.enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {s.enabled ? 'Actif' : 'Désactivé'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 flex flex-wrap gap-x-3">
                  <span>
                    Zone{' '}
                    {zoneOptions.find((z) => z.zone_id === s.zone_id)?.name ??
                      s.zone_id}
                  </span>
                  <span>{s.duration_minutes} min</span>
                  <span>{s.start_time}</span>
                  <span>{formatDays(s.days_of_week)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleMutation.mutate(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    s.enabled
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {s.enabled ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => {
                    setEditing(s)
                    setShowModal(true)
                  }}
                  className="px-3 py-1.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Modifier
                </button>
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="px-3 py-1.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ScheduleModal
          onClose={() => setShowModal(false)}
          initial={editing}
          zoneOptions={zoneOptions}
        />
      )}
    </div>
  )
}
