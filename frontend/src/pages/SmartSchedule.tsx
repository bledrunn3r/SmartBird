import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { settingsApi, weatherApi, zonesApi, programsApi } from '../api/client'
import type { AppSettings, WeatherDay, Zone } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7']

const WMO_EMOJI: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

function weatherEmoji(code: number): string {
  return WMO_EMOJI[code] ?? '🌡️'
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Convert total minutes-since-midnight to "HH:MM"
function minsToTime(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// ── Location card ─────────────────────────────────────────────────────────────

function LocationCard({
  settings,
  onSaved,
}: {
  settings: AppSettings | undefined
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState<number | null>(settings?.lat ?? null)
  const [lon, setLon] = useState<number | null>(settings?.lon ?? null)
  const [threshold, setThreshold] = useState(settings?.rain_threshold_mm ?? 2)
  const [geocoding, setGeocoding] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Sync when settings load
  useMemo(() => {
    if (settings) {
      setLat(settings.lat)
      setLon(settings.lon)
      setThreshold(settings.rain_threshold_mm)
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsApi.update({ lat, lon, rain_threshold_mm: threshold }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['weather'] })
      onSaved()
    },
  })

  const geocode = async () => {
    if (!address.trim()) return
    setGeocoding(true)
    setGeoError(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
      const resp = await fetch(url, { headers: { 'Accept-Language': 'fr' } })
      const data = await resp.json()
      if (!data.length) { setGeoError('Adresse introuvable'); return }
      setLat(parseFloat(data[0].lat))
      setLon(parseFloat(data[0].lon))
    } catch {
      setGeoError('Erreur de géocodage')
    } finally {
      setGeocoding(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-800 mb-4">Localisation &amp; seuil de pluie</h3>

      {/* Address geocoder */}
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          placeholder="Adresse complète (ex : 12 rue de la Paix, Paris)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && geocode()}
        />
        <button
          onClick={geocode}
          disabled={geocoding || !address.trim()}
          className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {geocoding ? '…' : 'Localiser'}
        </button>
      </div>
      {geoError && <p className="text-xs text-red-500 mb-2">{geoError}</p>}

      {/* Lat/lon display + threshold */}
      <div className="flex gap-3 flex-wrap items-end mb-4">
        <div className="flex gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Latitude</label>
            <input
              type="number"
              step="0.0001"
              className="w-32 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
              value={lat ?? ''}
              onChange={(e) => setLat(e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Longitude</label>
            <input
              type="number"
              step="0.0001"
              className="w-32 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
              value={lon ?? ''}
              onChange={(e) => setLon(e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Seuil pluie (mm/jour)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            className="w-28 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
          />
        </div>
        <button
          disabled={lat === null || lon === null || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {saveMutation.isPending ? 'Sauvegarde…' : 'Enregistrer'}
        </button>
        {saveMutation.isSuccess && (
          <span className="text-sm text-green-600">✓ Sauvegardé</span>
        )}
      </div>

      {lat !== null && lon !== null && (
        <p className="text-xs text-gray-400">
          Coordonnées actuelles : {lat.toFixed(4)}, {lon.toFixed(4)}
        </p>
      )}
    </div>
  )
}

// ── Weather forecast table ────────────────────────────────────────────────────

function WeatherTable({ days }: { days: WeatherDay[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Prévisions 7 jours</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          L'arrosage est inhibé automatiquement les jours marqués en rouge.
        </p>
      </div>
      <div className="divide-y divide-gray-50">
        {days.map((d) => (
          <div
            key={d.date}
            className={clsx(
              'flex items-center gap-4 px-5 py-2.5',
              d.will_skip ? 'bg-red-50' : '',
            )}
          >
            <span className="text-lg w-7 flex-shrink-0">{weatherEmoji(d.weather_code)}</span>
            <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
              {formatDate(d.date)}
            </span>
            <span className="text-sm text-gray-500 flex-1">{d.description}</span>
            <span className={clsx(
              'text-sm font-semibold tabular-nums',
              d.precipitation_mm > 0 ? 'text-blue-600' : 'text-gray-400',
            )}>
              {d.precipitation_mm.toFixed(1)} mm
            </span>
            {d.will_skip ? (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                arrosage annulé
              </span>
            ) : (
              <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                arrosage OK
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Smart program generator ───────────────────────────────────────────────────

interface TimelineStep {
  zone: Zone
  duration: number
  startMins: number
  endMins: number
}

function Generator({ allZones }: { allZones: Zone[] }) {
  const qc = useQueryClient()
  const [name, setName] = useState('Arrosage intelligent')
  const [startTime, setStartTime] = useState('06:00')
  const [refill, setRefill] = useState(60)
  const [days, setDays] = useState<string[]>(['1', '2', '3', '4', '5'])
  const [durations, setDurations] = useState<Record<number, number>>(() => {
    const d: Record<number, number> = {}
    allZones.forEach((z) => { d[z.zone_id] = 0 })
    return d
  })
  const [skipOnRain, setSkipOnRain] = useState(true)
  const [success, setSuccess] = useState(false)

  const toggleDay = (d: string) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    )

  const timeline: TimelineStep[] = useMemo(() => {
    let mins = timeToMins(startTime)
    const steps: TimelineStep[] = []
    for (const z of allZones) {
      const dur = durations[z.zone_id] ?? 0
      if (dur === 0) continue
      steps.push({ zone: z, duration: dur, startMins: mins, endMins: mins + dur })
      mins += dur + refill
    }
    return steps
  }, [allZones, startTime, refill, durations])

  const totalMinutes = useMemo(() => {
    if (timeline.length === 0) return 0
    const last = timeline[timeline.length - 1]
    return last.endMins - timeToMins(startTime)
  }, [timeline, startTime])

  const createMutation = useMutation({
    mutationFn: () =>
      programsApi.create({
        name,
        days_of_week: days.join(','),
        start_time: startTime,
        refill_minutes: refill,
        skip_on_rain: skipOnRain,
        enabled: true,
        zones: allZones.map((z, i) => ({
          zone_id: z.zone_id,
          duration_minutes: durations[z.zone_id] ?? 0,
          order: i,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    },
  })

  const activeCount = timeline.length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Générateur de programme</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Saisissez les durées par zone. La timeline se calcule automatiquement avec la pause de remplissage.
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* Start time + refill */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Heure de départ</label>
            <input
              type="time"
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pause remplissage (min)</label>
            <input
              type="number"
              min={0}
              max={180}
              className="w-24 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
              value={refill}
              onChange={(e) => setRefill(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Zone durations + live timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Zone inputs */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Durées par zone <span className="font-normal text-gray-400">(0 = ignorer)</span>
            </label>
            <div className="space-y-2">
              {allZones.map((z) => (
                <div
                  key={z.zone_id}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-colors',
                    (durations[z.zone_id] ?? 0) > 0
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200',
                  )}
                >
                  <span className="text-xs text-gray-400 w-6 flex-shrink-0">Z{z.zone_id}</span>
                  <span className="flex-1 text-gray-700 truncate text-xs">{z.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                    value={durations[z.zone_id] ?? 0}
                    onChange={(e) =>
                      setDurations((prev) => ({ ...prev, [z.zone_id]: parseInt(e.target.value) || 0 }))
                    }
                  />
                  <span className="text-xs text-gray-400">min</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline preview */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Timeline calculée
              {activeCount > 0 && (
                <span className="ml-2 font-normal text-gray-400">
                  fin vers {minsToTime(timeToMins(startTime) + totalMinutes)}
                </span>
              )}
            </label>
            {activeCount === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-300 text-sm border border-dashed border-gray-200 rounded-xl">
                Configurez des zones pour voir la timeline
              </div>
            ) : (
              <div className="space-y-1.5">
                {timeline.map((step, i) => (
                  <div key={step.zone.zone_id} className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-green-800 truncate">
                          {step.zone.name}
                        </span>
                        <span className="text-xs text-green-600 font-mono flex-shrink-0 ml-2">
                          {minsToTime(step.startMins)} → {minsToTime(step.endMins)}
                        </span>
                      </div>
                    </div>
                    {i < timeline.length - 1 && (
                      <div className="flex flex-col items-center text-gray-300 text-xs">
                        <span>↓</span>
                        <span className="text-gray-400 text-xs whitespace-nowrap">{refill} min</span>
                      </div>
                    )}
                  </div>
                ))}
                {activeCount > 1 && (
                  <p className="text-xs text-gray-400 mt-2 pl-7">
                    Durée totale : {Math.floor(totalMinutes / 60)}h{String(totalMinutes % 60).padStart(2, '0')}
                    {' '}(dont {(activeCount - 1) * refill} min de remplissage)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Days + name + options */}
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jours d'arrosage</label>
            <div className="flex gap-1.5">
              {DAY_KEYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                    days.includes(d)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  )}
                >
                  {DAY_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom du programme</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={skipOnRain}
                onChange={(e) => setSkipOnRain(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              Inhiber si pluie prévue
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
          <button
            disabled={activeCount === 0 || days.length === 0 || !name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors"
          >
            {createMutation.isPending ? 'Création…' : 'Créer le programme'}
          </button>
          {success && <span className="text-sm text-green-600">✓ Programme créé — visible dans Programmes</span>}
          {createMutation.isError && (
            <span className="text-sm text-red-500">Erreur lors de la création</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SmartSchedule() {
  const [settingsSaved, setSettingsSaved] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })

  const { data: forecast, isError: forecastError } = useQuery({
    queryKey: ['weather', settingsSaved],
    queryFn: weatherApi.forecast,
    enabled: settings?.lat !== null && settings?.lat !== undefined,
    retry: false,
  })

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: zonesApi.list,
  })

  const allZones = zones ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Planning intelligent</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Génère automatiquement un programme en tenant compte du remplissage de cuve et des prévisions météo.
        </p>
      </div>

      <LocationCard settings={settings} onSaved={() => setSettingsSaved((v) => !v)} />

      {forecast && <WeatherTable days={forecast} />}

      {settings?.lat === null && !forecastError && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 text-sm text-blue-700">
          Configurez votre localisation ci-dessus pour afficher les prévisions météo et activer l'inhibition par la pluie.
        </div>
      )}

      {forecastError && settings?.lat !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-700">
          Impossible de récupérer les prévisions météo. Vérifiez votre connexion ou les coordonnées.
        </div>
      )}

      <Generator allZones={allZones} />
    </div>
  )
}
