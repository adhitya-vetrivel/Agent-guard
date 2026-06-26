import { create } from 'zustand'
import type { DashboardData } from '../types'

interface DashboardState {
  data: DashboardData | null
  lastEvent: Record<string, unknown> | null
  setData: (data: DashboardData) => void
  setLastEvent: (event: Record<string, unknown> | null) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  lastEvent: null,
  setData: (data) => set({ data }),
  setLastEvent: (event) => set({ lastEvent: event }),
}))
