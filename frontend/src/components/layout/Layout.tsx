import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Command } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { NotificationCenter } from '@/components/NotificationCenter'
import { CommandPalette } from '@/components/CommandPalette'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getToken } from '@/services/api'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!getToken()) return
    fetch('/api/settings', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json().catch(() => {}))
      .then((data) => {
        if (data?.active_palette) {
          document.documentElement.setAttribute('data-palette', data.active_palette)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setCmdPaletteOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background px-4 h-11">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <NotificationCenter />
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-colors"
            >
              <Command className="h-3 w-3" />
              <span>Search...</span>
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] ml-1">Ctrl+K</kbd>
            </button>
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="sm:hidden rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Command className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {cmdPaletteOpen && <CommandPalette onClose={() => setCmdPaletteOpen(false)} />}
    </div>
  )
}
