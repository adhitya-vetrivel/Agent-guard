import { create } from 'zustand'
import { api, setToken } from '../services/api'

interface AuthState {
  user: { id: string; email: string; name: string; role: string } | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: true,

  login: async (email: string, password: string) => {
    const result = await api.login(email, password)
    setToken(result.access_token)
    const user = await api.getMe()
    set({ user, isAuthenticated: true })
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
      const user = await api.getMe()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      setToken(null)
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
