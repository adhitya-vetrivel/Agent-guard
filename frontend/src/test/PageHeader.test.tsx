import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/ui/PageHeader'

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="Dashboard" description="Overview of the system" />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Overview of the system')).toBeInTheDocument()
  })

  it('renders children in the action slot', () => {
    render(<PageHeader title="Test"><button>Action</button></PageHeader>)
    expect(screen.getByText('Action')).toBeInTheDocument()
  })
})
