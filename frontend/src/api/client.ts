import axios from 'axios'
import type { Zone, Schedule, HistoryResponse, Program, AppSettings, WeatherDay } from '../types'

const api = axios.create({ baseURL: '/api' })

export const zonesApi = {
  list: () => api.get<Zone[]>('/zones').then((r) => r.data),
  update: (id: number, data: { name?: string; enabled?: boolean }) =>
    api.patch<Zone>(`/zones/${id}`, data).then((r) => r.data),
  start: (id: number, duration_minutes: number) =>
    api.post(`/zones/${id}/start`, { duration_minutes }).then((r) => r.data),
  stop: () => api.post('/zones/stop').then((r) => r.data),
}

export const schedulesApi = {
  list: () => api.get<Schedule[]>('/schedules').then((r) => r.data),
  create: (data: Omit<Schedule, 'id' | 'created_at'>) =>
    api.post<Schedule>('/schedules', data).then((r) => r.data),
  update: (id: number, data: Partial<Omit<Schedule, 'id' | 'created_at'>>) =>
    api.patch<Schedule>(`/schedules/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/schedules/${id}`),
  toggle: (id: number) =>
    api.post<Schedule>(`/schedules/${id}/toggle`).then((r) => r.data),
}

export interface ProgramCreatePayload {
  name: string
  days_of_week: string
  start_time: string
  enabled: boolean
  zones: { zone_id: number; duration_minutes: number; order: number }[]
  refill_minutes?: number
  skip_on_rain?: boolean
}

export const programsApi = {
  list: () => api.get<Program[]>('/programs').then((r) => r.data),
  create: (data: ProgramCreatePayload) =>
    api.post<Program>('/programs', data).then((r) => r.data),
  update: (id: number, data: Partial<Omit<Program, 'id' | 'created_at'>>) =>
    api.patch<Program>(`/programs/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/programs/${id}`),
  toggle: (id: number) => api.post<Program>(`/programs/${id}/toggle`).then((r) => r.data),
  runNow: (id: number) => api.post(`/programs/${id}/run`).then((r) => r.data),
}

export const historyApi = {
  list: (page = 1, zone_id?: number) =>
    api
      .get<HistoryResponse>('/history', { params: { page, zone_id } })
      .then((r) => r.data),
}

export const settingsApi = {
  get: () => api.get<AppSettings>('/settings').then((r) => r.data),
  update: (data: AppSettings) => api.put<AppSettings>('/settings', data).then((r) => r.data),
}

export const weatherApi = {
  forecast: () => api.get<WeatherDay[]>('/weather/forecast').then((r) => r.data),
}
