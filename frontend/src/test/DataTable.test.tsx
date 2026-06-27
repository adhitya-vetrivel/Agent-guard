import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataTable } from '@/components/ui/DataTable'

const columns = [
  { key: 'name', label: 'Name', render: (item: any) => item.name },
  { key: 'role', label: 'Role', render: (item: any) => item.role },
]

const data = [
  { id: '1', name: 'Alpha', role: 'analyst' },
  { id: '2', name: 'Beta', role: 'operator' },
]

describe('DataTable', () => {
  it('renders the data rows', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<DataTable columns={columns} data={undefined} isLoading={true} loadingMessage="Loading agents..." />)
    expect(screen.getByText('Loading agents...')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', () => {
    render(<DataTable columns={columns} data={[]} emptyTitle="No agents found" />)
    expect(screen.getByText('No agents found')).toBeInTheDocument()
  })
})
