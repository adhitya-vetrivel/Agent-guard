import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'

vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: any) => selector({
    user: { id: 'test', email: 'admin@agentguard.io', name: 'Admin', role: 'admin' },
    isAuthenticated: true,
    isLoading: false,
    checkAuth: vi.fn(),
    logout: vi.fn(),
  }),
}))

describe('Sidebar', () => {
  it('renders the AgentGuard branding', () => {
    render(<BrowserRouter><Sidebar isOpen={true} onClose={() => {}} /></BrowserRouter>)
    expect(screen.getByText('AgentGuard')).toBeInTheDocument()
    expect(screen.getByText('Runtime Security Firewall')).toBeInTheDocument()
  })

  it('renders navigation sections', () => {
    render(<BrowserRouter><Sidebar isOpen={true} onClose={() => {}} /></BrowserRouter>)
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  it('renders key navigation links', () => {
    render(<BrowserRouter><Sidebar isOpen={true} onClose={() => {}} /></BrowserRouter>)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Incidents')).toBeInTheDocument()
    expect(screen.getByText('Fleet')).toBeInTheDocument()
    expect(screen.getByText('Console')).toBeInTheDocument()
  })

  it('renders the Simulate Attack and Logout buttons', () => {
    render(<BrowserRouter><Sidebar isOpen={true} onClose={() => {}} /></BrowserRouter>)
    expect(screen.getByText('Simulate Attack')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })
})
