import { render, screen, fireEvent, within } from '@testing-library/react'
import { PageShell, PageHeader, Toolbar, DetailLayout } from '../page'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}))

describe('PageShell', () => {
  it('applies the density-aware frame by default', () => {
    const { container } = render(<PageShell>body</PageShell>)
    const shell = container.firstElementChild as HTMLElement
    expect(shell.className).toContain('ds-density-pad')
    expect(shell.className).toContain('max-w-7xl')
  })

  it('flush drops the frame and the stack wrapper', () => {
    const { container } = render(<PageShell flush>body</PageShell>)
    const shell = container.firstElementChild as HTMLElement
    expect(shell.className).not.toContain('ds-density-pad')
    expect(container.querySelector('.ds-density-stack')).toBeNull()
  })

  it('narrow width is used for reading-width pages', () => {
    const { container } = render(<PageShell width="narrow">body</PageShell>)
    expect((container.firstElementChild as HTMLElement).className).toContain('max-w-3xl')
  })
})

describe('PageHeader', () => {
  it('renders exactly one h1 for the route', () => {
    render(<PageHeader title="Content" description="Everything you've made" />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Content')
    expect(screen.getByText("Everything you've made")).toBeInTheDocument()
  })

  it('renders breadcrumbs, linking all but the last', () => {
    render(
      <PageHeader
        title="Clip 4"
        breadcrumbs={[
          { label: 'Content', href: '/dashboard/content' },
          { label: 'Clip 4' },
        ]}
      />
    )
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(nav).getByRole('link', { name: 'Content' })).toHaveAttribute('href', '/dashboard/content')
    // The current page is marked, not linked.
    expect(within(nav).queryByRole('link', { name: 'Clip 4' })).toBeNull()
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent('Clip 4')
  })

  it('renders actions and tabs slots', () => {
    render(
      <PageHeader
        title="Analytics"
        actions={<button type="button">Export</button>}
        tabs={<div data-testid="tabs">tabs</div>}
      />
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(screen.getByTestId('tabs')).toBeInTheDocument()
  })
})

describe('Toolbar', () => {
  it('shows filters when nothing is selected', () => {
    render(<Toolbar left={<input aria-label="Search" />} right={<button type="button">Sort</button>} />)
    expect(screen.getByRole('toolbar', { name: /filters and actions/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
  })

  it('swaps to bulk actions once rows are selected', () => {
    const onClear = jest.fn()
    render(
      <Toolbar
        left={<input aria-label="Search" />}
        selectionCount={3}
        selectionActions={<button type="button">Delete</button>}
        onClearSelection={onClear}
      />
    )
    expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument()
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    // The filter row is replaced, not stacked on top of the bulk bar.
    expect(screen.queryByLabelText('Search')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('DetailLayout', () => {
  it('renders main content and a complementary aside', () => {
    render(
      <DetailLayout aside={<div>metadata</div>}>
        <p>main body</p>
      </DetailLayout>
    )
    expect(screen.getByText('main body')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveTextContent('metadata')
  })
})
