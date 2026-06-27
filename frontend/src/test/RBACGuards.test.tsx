import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}))

function RoleRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const user = useAuthStore((s: any) => s.user)
  if (!user) return <div>Redirect: login</div>
  if (!roles.includes(user.role)) return <div>Redirect: dashboard</div>
  return <>{children}</>
}

describe('RoleRoute guard', () => {
  it('renders children for authorized role', () => {
    (useAuthStore as any).mockImplementation((selector: any) =>
      selector({ user: { role: 'admin' }, isAuthenticated: true }))
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<RoleRoute roles={['admin']}><div>Admin Panel</div></RoleRoute>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('redirects for unauthorized role', () => {
    (useAuthStore as any).mockImplementation((selector: any) =>
      selector({ user: { role: 'viewer' }, isAuthenticated: true }))
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<RoleRoute roles={['admin']}><div>Admin Panel</div></RoleRoute>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Redirect: dashboard')).toBeInTheDocument()
  })

  it('redirects to login when no user', () => {
    (useAuthStore as any).mockImplementation((selector: any) =>
      selector({ user: null, isAuthenticated: false }))
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<RoleRoute roles={['admin']}><div>Admin Panel</div></RoleRoute>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Redirect: login')).toBeInTheDocument()
  })
})
