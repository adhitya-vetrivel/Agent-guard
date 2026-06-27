import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useToastStore } from '@/store/toast'

describe('ToastStore', () => {
  beforeEach(() => {
    useToastStore.getState().clearAll()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a toast', () => {
    const id = useToastStore.getState().addToast({ message: 'Test toast', variant: 'info' })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0].message).toBe('Test toast')
    expect(useToastStore.getState().toasts[0].variant).toBe('info')
  })

  it('removes a toast', () => {
    const id = useToastStore.getState().addToast({ message: 'Remove me', variant: 'success' })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    useToastStore.getState().removeToast(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('auto-removes toast after duration', () => {
    useToastStore.getState().addToast({ message: 'Auto remove', variant: 'info', duration: 1000 })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('supports containment variant', () => {
    useToastStore.getState().addToast({ message: 'Containment alert', variant: 'containment', duration: Infinity })
    const toast = useToastStore.getState().toasts[0]
    expect(toast.message).toBe('Containment alert')
    expect(toast.variant).toBe('containment')
  })

  it('clears all toasts', () => {
    useToastStore.getState().addToast({ message: 'One', variant: 'info' })
    useToastStore.getState().addToast({ message: 'Two', variant: 'warning' })
    expect(useToastStore.getState().toasts).toHaveLength(2)
    useToastStore.getState().clearAll()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('accepts action callback', () => {
    const action = vi.fn()
    useToastStore.getState().addToast({ message: 'With action', variant: 'info', action: { label: 'Click', onClick: action } })
    useToastStore.getState().toasts[0].action?.onClick()
    expect(action).toHaveBeenCalledOnce()
  })
})
