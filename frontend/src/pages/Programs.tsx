import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { programsApi, zonesApi } from '../api/client'
import type { Program, Zone } from '../types'

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7']

// ── Bulk import wizard ────────────────────────────────────────────────────────

interface SlotState {
  enabled: boolean
  name: string
  days: string[]
  start_time: string
  durations: Record<number, number>
}

function defaultSlot(label: string, allZones: Zone[]): SlotState {
  const durations: Record<number, number> = {}
  allZones.forEach((z) => { durations[z.zone_id] = 0 })
  return { enabled: false, name: label, days: ['1', '2', '3', '4', '5'], start_time: '06:00', durations }
}

function ImportWizard({ onClose, allZones }: { onClose: () => void; allZones: Zone[] }) {
  const qc = useQueryClient()
  const [slots, setSlots] = useState<SlotState[]>([
    defaultSlot('Programme A', allZones),
    defaultSlot('Programme B', allZones),
    defaultSlot('Programme C', allZones),
  ])
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateSlot = (i: number, patch: Partial<SlotState>) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const toggleDay = (slotIdx: number, d: string) =>
    setSlots((prev) =>
      prev.map((s, i) =>
        i === slotIdx
          ? { ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort() }
          : s
      )
    )

  const toImport = slots.filter((s) => s.enabled && s.name.trim() && s.days.length > 0)

  const handleImport = async () => {
    setError(null)
    if (toImport.length === 0) { setError('Activez au moins un programme.'); return }
    setIsPending(true)
    try {
      for (const s of toImport) {
        await programsApi.create({
          name: s.name,
          days_of_week: s.days.join(','),
          start_time: s.start_time,
          enabled: true,
          zones: allZones.map((z, idx) => ({
            zone_id: z.zone_id,
            duration_minutes: s.durations[z.zone_id] ?? 0,
            order: idx,
          })),
        })
      }
      qc.invalidateQueries({ queryKey: ['programs'] })
      onClose()
    } catch {
      setError("Erreur lors de l'importation.")
      setIsPending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Importer les programmes existants</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Saisissez vos programmes A / B / C tels que configurés dans l'application officielle.
          </p>
        </div>

        {/* Slots */}
        <div className="px-6 py-4 space-y-4">
          {slots.map((slot, i) => (
            <div
              key={i}
              className={clsx(
                'border rounded-2xl overflow-hidden transition-colors',
                slot.enabled ? 'border-green-300' : 'border-gray-200',
              )}
            >
              {/* Slot header — click to toggle */}
              <button
                type="button"
                onClick={() => updateSlot(i, { enabled: !slot.enabled })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className={clsx(
                  'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  slot.enabled ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300',
                )}>
                  {slot.enabled && <span className="text-xs font-bold">✓</span>}
                </span>
                <span className={clsx('font-semibold', slot.enabled ? 'text-green-800' : 'text-gray-500')}>
                  {slot.name}
                </span>
                {!slot.enabled && (
                  <span className="text-xs text-gray-400 ml-auto">Cliquer pour importer</span>
                )}
                {slot.enabled && (
                  <span className="text-xs text-green-600 ml-auto">
                    {Object.values(slot.durations).filter((d) => d > 0).length} zone(s) ·{' '}
                    {Object.values(slot.durations).reduce((a, b) => a + b, 0)} min
                  </span>
                )}
              </button>

              {/* Slot body */}
              {slot.enabled && (
                <div className="px-4 pb-4 border-t border-green-100 bg-green-50/30 space-y-4">
                  {/* Name */}
                  <div className="pt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                      value={slot.name}
                      onChange={(e) => updateSlot(i, { name: e.target.value })}
                    />
                  </div>

                  {/* Days + time (side by side) */}
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-48">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Jours d'arrosage</label>
                      <div className="flex gap-1">
                        {DAY_KEYS.map((d, di) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDay(i, d)}
                            className={clsx(
                              'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                              slot.days.includes(d)
                                ? 'bg-green-500 text-white'
                                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50',
                            )}
                          >
                            {DAY_LABELS[di]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Heure de départ</label>
                      <input
                        type="time"
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                        value={slot.start_time}
                        onChange={(e) => updateSlot(i, { start_time: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Zone durations */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Durées par zone <span className="font-normal text-gray-400">(0 = ignorer)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {allZones.map((z) => (
                        <div
                          key={z.zone_id}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-colors',
                            (slot.durations[z.zone_id] ?? 0) > 0
                              ? 'border-green-300 bg-white'
                              : 'border-gray-200 bg-white',
                          )}
                        >
                          <span className="text-xs text-gray-400 w-6 flex-shrink-0">Z{z.zone_id}</span>
                          <span className="flex-1 truncate text-gray-700 text-xs">{z.name}</span>
                          <input
                            type="number"
                            min={0}
                            max={120}
                            className="w-14 border border-gray-200 rounded-lg px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-green-300"
                            value={slot.durations[z.zone_id] ?? 0}
                            onChange={(e) =>
                              updateSlot(i, {
                                durations: { ...slot.durations, [z.zone_id]: Number(e.target.value) },
                              })
                            }
                          />
                          <span className="text-xs text-gray-400">min</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          {error && <span className="text-sm text-red-500 flex-1">{error}</span>}
          {!error && (
            <span className="text-sm text-gray-500 flex-1">
              {toImport.length > 0
                ? `${toImport.length} programme(s) à importer`
                : 'Activez au moins un programme'}
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm"
          >
            Annuler
          </button>
          <button
            disabled={isPending || toImport.length === 0}
            onClick={handleImport}
            className="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {isPending ? 'Importation…' : `Importer (${toImport.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDays(s: string) {
  return s.split(',').map((d) => DAY_LABELS[+d - 1]).join(', ')
}

function totalDuration(zones: Program['zones']) {
  return zones.reduce((acc, z) => acc + z.duration_minutes, 0)
}

// ── Wizard ────────────────────────────────────────────────────────────────────

interface WizardProps {
  onClose: () => void
  initial?: Program
  allZones: Zone[]
}

interface FormState {
  name: string
  days: string[]
  start_time: string
  durations: Record<number, number>  // zone_id → minutes (0 = skip)
}

function ProgramWizard({ onClose, initial, allZones }: WizardProps) {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(() => {
    if (initial) {
      const durations: Record<number, number> = {}
      allZones.forEach((z) => { durations[z.zone_id] = 0 })
      initial.zones.forEach((z) => { durations[z.zone_id] = z.duration_minutes })
      return {
        name: initial.name,
        days: initial.days_of_week.split(','),
        start_time: initial.start_time,
        durations,
      }
    }
    const durations: Record<number, number> = {}
    allZones.forEach((z) => { durations[z.zone_id] = 0 })
    return { name: '', days: ['1', '2', '3', '4', '5'], start_time: '06:00', durations }
  })

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof programsApi.create>[0]) =>
      programsApi.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programs'] }); onClose() },
  })
  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof programsApi.update>[1]) =>
      programsApi.update(initial!.id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programs'] }); onClose() },
  })

  const toggleDay = (d: string) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort(),
    }))

  const activeZones = allZones.filter((z) => (form.durations[z.zone_id] ?? 0) > 0)
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      days_of_week: form.days.join(','),
      start_time: form.start_time,
      enabled: true,
      zones: allZones.map((z, i) => ({
        zone_id: z.zone_id,
        duration_minutes: form.durations[z.zone_id] ?? 0,
        order: i,
      })),
    }
    if (initial) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const steps = ['Infos', 'Horaire', 'Zones', 'Aperçu']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">
            {initial ? 'Modifier le programme' : 'Importer un programme'}
          </h3>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-3">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={clsx(
                    'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors',
                    i === step
                      ? 'bg-green-100 text-green-700'
                      : i < step
                      ? 'text-green-600 cursor-pointer hover:bg-green-50'
                      : 'text-gray-400 cursor-default',
                  )}
                >
                  <span className={clsx(
                    'w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold',
                    i < step ? 'bg-green-500 text-white' : i === step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500',
                  )}>
                    {i < step ? '✓' : i + 1}
                  </span>
                  {s}
                </button>
                {i < steps.length - 1 && <div className="w-4 h-px bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Step 0 – Infos */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Donnez un nom à ce programme (ex : "Programme A", "Pelouse matin").
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du programme</label>
                <input
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
                  placeholder="ex : Programme A"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Step 1 – Horaire */}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">
                Sélectionnez les jours et l'heure de départ du programme.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jours d'arrosage</label>
                <div className="flex gap-1.5">
                  {DAY_KEYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={clsx(
                        'flex-1 py-2 rounded-xl text-xs font-semibold transition-colors',
                        form.days.includes(d)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                      )}
                    >
                      {DAY_LABELS[i]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure de départ</label>
                <input
                  type="time"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Step 2 – Zones */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Entrez la durée pour chaque zone. Laissez <strong>0</strong> pour ignorer une zone.
              </p>
              <div className="space-y-2">
                {allZones.map((z) => (
                  <div key={z.zone_id} className="flex items-center gap-3">
                    <div className={clsx(
                      'flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors',
                      (form.durations[z.zone_id] ?? 0) > 0
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white',
                    )}>
                      <span className="text-xs font-semibold text-gray-500 w-10 flex-shrink-0">
                        Zone {z.zone_id}
                      </span>
                      <span className="text-sm text-gray-700 flex-1 truncate">{z.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        className="w-16 border border-gray-200 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-300"
                        value={form.durations[z.zone_id] ?? 0}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            durations: { ...f.durations, [z.zone_id]: Number(e.target.value) },
                          }))
                        }
                      />
                      <span className="text-xs text-gray-400">min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 – Aperçu */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-green-800 mb-1">{form.name}</h4>
                <p className="text-sm text-green-700">
                  {formatDays(form.days.join(','))} à {form.start_time}
                </p>
              </div>

              {activeZones.length === 0 ? (
                <p className="text-sm text-red-500">Aucune zone configurée. Retournez à l'étape Zones.</p>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Séquence d'arrosage — {totalDuration(activeZones.map(z => ({ duration_minutes: form.durations[z.zone_id] ?? 0, zone_id: z.zone_id, order: 0 })))} min au total
                  </p>
                  <div className="space-y-1.5">
                    {activeZones.map((z, i) => (
                      <div key={z.zone_id} className="flex items-center gap-3 text-sm">
                        <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-gray-700">{z.name}</span>
                        <span className="text-gray-500 font-medium">
                          {form.durations[z.zone_id]} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm"
          >
            Annuler
          </button>
          <div className="flex-1" />
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm"
            >
              ← Retour
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              disabled={step === 0 && !form.name.trim()}
              onClick={() => setStep((s) => s + 1)}
              className="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Suivant →
            </button>
          ) : (
            <button
              disabled={isPending || activeZones.length === 0}
              onClick={handleSubmit}
              className="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {initial ? 'Enregistrer' : 'Créer le programme'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Programs() {
  const qc = useQueryClient()
  const [showWizard, setShowWizard] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Program | undefined>()

  const { data: programs, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: programsApi.list,
  })

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: zonesApi.list,
  })

  const toggleMutation = useMutation({
    mutationFn: programsApi.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: programsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  })

  const runMutation = useMutation({
    mutationFn: programsApi.runNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  })

  const allZones = zones ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Programmes SmartBird</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Séquences multi-zones, équivalent aux programmes A / B / C du contrôleur
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            ↓ Importer A/B/C
          </button>
          <button
            onClick={() => { setEditing(undefined); setShowWizard(true) }}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-green-700 border border-green-300 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <span>+</span> Nouveau
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      )}

      {!isLoading && !programs?.length && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 text-green-200">💧</div>
          <p className="text-gray-500 font-medium">Aucun programme configuré</p>
          <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
            Utilisez <strong>Importer A/B/C</strong> pour saisir vos programmes existants,
            ou <strong>Nouveau</strong> pour en créer un.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {programs?.map((prog) => (
          <div key={prog.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{prog.name}</span>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    prog.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                  )}>
                    {prog.enabled ? 'Actif' : 'Désactivé'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatDays(prog.days_of_week)} à {prog.start_time}
                  {' · '}
                  {prog.zones.length} zone{prog.zones.length > 1 ? 's' : ''}
                  {' · '}
                  {totalDuration(prog.zones)} min total
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => runMutation.mutate(prog.id)}
                  disabled={runMutation.isPending}
                  title="Démarrer maintenant"
                  className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl text-sm font-medium transition-colors"
                >
                  ▶ Démarrer
                </button>
                <button
                  onClick={() => toggleMutation.mutate(prog.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                    prog.enabled
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200',
                  )}
                >
                  {prog.enabled ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => { setEditing(prog); setShowWizard(true) }}
                  className="px-3 py-1.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Modifier
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer "${prog.name}" ?`)) deleteMutation.mutate(prog.id)
                  }}
                  className="px-3 py-1.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>

            {/* Zone sequence */}
            <div className="px-4 py-2 flex items-center gap-1 flex-wrap">
              {prog.zones.map((z, i) => {
                const name = allZones.find((az) => az.zone_id === z.zone_id)?.name ?? `Zone ${z.zone_id}`
                return (
                  <div key={z.zone_id} className="flex items-center gap-1">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 flex items-center gap-1.5">
                      <span className="w-4 h-4 bg-green-400 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span>{name}</span>
                      <span className="text-gray-400">{z.duration_minutes} min</span>
                    </div>
                    {i < prog.zones.length - 1 && (
                      <span className="text-gray-300 text-xs">→</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {showImport && (
        <ImportWizard onClose={() => setShowImport(false)} allZones={allZones} />
      )}

      {showWizard && (
        <ProgramWizard
          onClose={() => setShowWizard(false)}
          initial={editing}
          allZones={allZones}
        />
      )}
    </div>
  )
}
