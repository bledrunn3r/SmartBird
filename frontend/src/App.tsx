import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Programs } from './pages/Programs'
import { Schedules } from './pages/Schedules'
import { History } from './pages/History'
import { SmartSchedule } from './pages/SmartSchedule'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/schedules" element={<Schedules />} />
        <Route path="/planning" element={<SmartSchedule />} />
        <Route path="/history" element={<History />} />
      </Route>
    </Routes>
  )
}
