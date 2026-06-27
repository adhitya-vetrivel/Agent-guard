import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusIndicator } from '@/components/ui/StatusIndicator'

describe('StatusIndicator', () => {
  it('renders active status', () => {
    const { container } = render(<StatusIndicator status="active" />)
    const dot = container.querySelector('span > span')
    expect(dot).toBeInTheDocument()
  })

  it('renders warning status', () => {
    const { container } = render(<StatusIndicator status="warning" />)
    const dot = container.querySelector('span > span')
    expect(dot).toBeInTheDocument()
  })

  it('renders danger status', () => {
    const { container } = render(<StatusIndicator status="danger" />)
    const dot = container.querySelector('span > span')
    expect(dot).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<StatusIndicator status="active" label="Online" />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('renders inactive status', () => {
    const { container } = render(<StatusIndicator status="inactive" />)
    const dot = container.querySelector('span > span')
    expect(dot).toBeInTheDocument()
  })
})
