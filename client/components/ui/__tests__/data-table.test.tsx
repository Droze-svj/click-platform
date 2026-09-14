import { render, screen, fireEvent, within } from '@testing-library/react'
import { DataTable, type Column } from '../data-table'

type Row = { id: string; name: string; views: number }

const rows: Row[] = [
  { id: 'a', name: 'Banana clip', views: 120 },
  { id: 'b', name: 'Apple clip', views: 9 },
  { id: 'c', name: 'Cherry clip', views: 1000 },
]

const columns: Column<Row>[] = [
  { id: 'name', header: 'Name', cell: (r) => r.name, sortable: true },
  { id: 'views', header: 'Views', cell: (r) => r.views, sortable: true, sortValue: (r) => r.views, align: 'right' },
]

const bodyNames = () =>
  screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent)

describe('DataTable', () => {
  it('renders rows', () => {
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} />)
    expect(bodyNames()).toEqual(['Banana clip', 'Apple clip', 'Cherry clip'])
  })

  it('owns its loading state', () => {
    const { container } = render(
      <DataTable rows={[]} columns={columns} getRowId={(r) => r.id} loading />
    )
    expect(container.querySelector('table')).toBeNull()
  })

  it('owns its empty state', () => {
    render(
      <DataTable
        rows={[]}
        columns={columns}
        getRowId={(r) => r.id}
        emptyTitle="No clips yet"
        emptyMessage="Upload a video to get started"
      />
    )
    expect(screen.getByText('No clips yet')).toBeInTheDocument()
    expect(screen.getByText('Upload a video to get started')).toBeInTheDocument()
  })

  it('owns its error state and offers a retry', () => {
    const onRetry = jest.fn()
    render(
      <DataTable rows={[]} columns={columns} getRowId={(r) => r.id} error="Network down" onRetry={onRetry} />
    )
    expect(screen.getByText('Network down')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('sorts alphabetically and toggles direction', () => {
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} />)
    const nameHeader = screen.getByRole('button', { name: /name/i })

    fireEvent.click(nameHeader)
    expect(bodyNames()).toEqual(['Apple clip', 'Banana clip', 'Cherry clip'])

    fireEvent.click(nameHeader)
    expect(bodyNames()).toEqual(['Cherry clip', 'Banana clip', 'Apple clip'])
  })

  it('sorts numerically via sortValue, not string order', () => {
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} />)
    fireEvent.click(screen.getByRole('button', { name: /views/i }))
    // 9 < 120 < 1000 — a string sort would give 1000, 120, 9.
    expect(bodyNames()).toEqual(['Apple clip', 'Banana clip', 'Cherry clip'])
  })

  it('exposes sort state to assistive tech via aria-sort', () => {
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} />)
    fireEvent.click(screen.getByRole('button', { name: /name/i }))
    const header = screen.getAllByRole('columnheader')[0]
    expect(header).toHaveAttribute('aria-sort', 'ascending')
  })

  it('does not mutate the caller\'s rows array when sorting', () => {
    const original = [...rows]
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} />)
    fireEvent.click(screen.getByRole('button', { name: /name/i }))
    expect(rows).toEqual(original)
  })

  it('supports selection, including select-all', () => {
    const onSelectionChange = jest.fn()
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /select row a/i }))
    expect(onSelectionChange).toHaveBeenCalledWith(['a'])

    fireEvent.click(screen.getByRole('checkbox', { name: /select all rows/i }))
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c'])
  })

  it('ticking a row does not trigger the row click handler', () => {
    const onRowClick = jest.fn()
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
        selectedIds={[]}
        onSelectionChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /select row a/i }))
    expect(onRowClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Banana clip'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })
})
