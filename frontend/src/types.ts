export interface Zone {
  zone_id: number
  name: string
  is_active: boolean
  minutes_remaining: number | null
}

export interface ControllerStatus {
  active_zone: number | null
  minutes_remaining: number | null
  rain_sensor: boolean
  timestamp: string
}

export interface Schedule {
  id: number
  name: string
  zone_id: number
  duration_minutes: number
  days_of_week: string
  start_time: string
  enabled: boolean
  created_at: string
}

export interface HistoryItem {
  id: number
  zone_id: number
  zone_name: string
  started_at: string
  ended_at: string | null
  duration_minutes: number
  trigger_type: 'manual' | 'schedule'
  schedule_id: number | null
}

export interface HistoryResponse {
  items: HistoryItem[]
  total: number
  page: number
  pages: number
}

export interface ProgramZone {
  zone_id: number
  duration_minutes: number
  order: number
}

export interface Program {
  id: number
  name: string
  days_of_week: string
  start_time: string
  enabled: boolean
  created_at: string
  zones: ProgramZone[]
  refill_minutes: number
  skip_on_rain: boolean
}

export interface AppSettings {
  lat: number | null
  lon: number | null
  rain_threshold_mm: number
}

export interface WeatherDay {
  date: string
  precipitation_mm: number
  weather_code: number
  description: string
  will_skip: boolean
}
