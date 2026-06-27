import { create } from 'zustand'
import { api, setToken } from '../services/api'
import type { Role } from '@/types'

interface AuthState {
  user: { id: string; email: string; name: string; role: Role } | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  hasRole: (required: Role | Role[]) => boolean
}

const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  operator: 2,
  engineer: 2,
  admin: 3,
  demo: 0,
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: true,

  login: async (email: string, password: string) => {
    const result = await api.login(email, password)
    setToken(result.access_token)
    const me = await api.getMe()
    set({ user: { ...me, role: me.role as Role }, isAuthenticated: true })
  },

  logout: () => {
    setToken(null)
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ isAuthenticated: false, isLoading: false })
      return
    }
    try {
      const me = await api.getMe()
      set({ user: { ...me, role: me.role as Role }, isAuthenticated: true, isLoading: false })
    } catch {
      setToken(null)
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  hasRole: (required: Role | Role[]) => {
    const { user } = get()
    if (!user) return false
    if (user.role === 'admin') return true
    const roles = Array.isArray(required) ? required : [required]
    if (roles.includes(user.role)) return true
    const userLevel = ROLE_HIERARCHY[user.role] ?? 0
    const requiredLevel = Math.min(
      ...roles.map((r) => ROLE_HIERARCHY[r] ?? 99)
    )
    return userLevel >= requiredLevel
  },
}))
