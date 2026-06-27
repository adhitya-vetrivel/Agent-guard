import { vi } from 'vitest'

export function mockAuthStore(overrides: Record<string, any> = {}) {
  const defaultUser = {
    id: 'test-user',
    email: 'admin@agentguard.io',
    name: 'Test Admin',
    role: 'admin',
  }
  vi.mock('@/store/auth', () => ({
    useAuthStore: (selector: (state: any) => any) =>
      selector({
        user: defaultUser,
        isAuthenticated: true,
        isLoading: false,
        checkAuth: vi.fn(),
        logout: vi.fn(),
        ...overrides,
      }),
  }))
}
