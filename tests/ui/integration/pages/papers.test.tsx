import { render, screen, fireEvent, waitFor } from '../../helpers/render'
import PapersPage from '@/app/papers/page'
import { setupUserEvent } from '../../helpers/test-utils'
import { createFile, createPaper } from '../../helpers/factory'

describe('Papers Page Integration', () => {
  let user: ReturnType<typeof setupUserEvent>

  beforeEach(() => {
    user = setupUserEvent()
    // Reset any initial navigation
    window.history.pushState({}, 'Papers', '/papers')
  })

  it('loads and displays papers', async () => {
    render(<PapersPage />)

    // Loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    // Papers loaded
    await waitFor(() => {
      expect(screen.getByTestId('paper-list')).toBeInTheDocument()
      expect(screen.getAllByTestId('paper-card').length).toBeGreaterThan(0)
    })
  })

  it('handles paper upload flow', async () => {
    render(<PapersPage />)

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: /upload/i })
    await user.click(uploadButton)

    // Upload modal appears
    await waitFor(() => {
      expect(screen.getByTestId('upload-modal')).toBeInTheDocument()
      expect(screen.getByTestId('upload-zone')).toBeInTheDocument()
    })

    // Simulate file upload
    const file = createFile('test.pdf')
    const uploadZone = screen.getByTestId('upload-zone')

    await user.upload(
      screen.getByLabelText('drop files here', { exact: false }),
      file
    )

    // Upload success notification
    await waitFor(() => {
      expect(screen.getByText(/upload successful/i)).toBeInTheDocument()
    })

    // Close modal
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument()
    })
  })

  it('handles paper deletion with confirmation', async () => {
    render(<PapersPage />)

    // Wait for papers to load
    await waitFor(() => {
      expect(screen.getAllByTestId('paper-card').length).toBeGreaterThan(0)
    })

    // Find and hover over first paper to show actions
    const firstCard = screen.getAllByTestId('paper-card')[0]
    await user.hover(firstCard)

    // Find and click delete button
    const deleteButton = await screen.findByRole('button', { name: /delete/i })
    await user.click(deleteButton)

    // Confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    // Success notification
    await waitFor(() => {
      expect(screen.getByText(/deleted successfully/i)).toBeInTheDocument()
    })
  })

  it('handles search functionality', async () => {
    render(<PapersPage />)

    // Wait for papers to load
    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    // Search for a paper
    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, 'Attention')

    // Wait for search results
    await waitFor(() => {
      const visibleCards = screen.getAllByTestId('paper-card')
      expect(visibleCards.length).toBeGreaterThan(0)
      visibleCards.forEach(card => {
        expect(card.textContent).toMatch(/attention/i)
      })
    })
  })

  it('handles status filtering', async () => {
    render(<PapersPage />)

    // Wait for papers to load
    await waitFor(() => {
      expect(screen.getByTestId('status-filter')).toBeInTheDocument()
    })

    // Click status filter dropdown
    const statusFilter = screen.getByTestId('status-filter')
    await user.click(statusFilter)

    // Select a status
    const statusOption = await screen.findByText('Processed')
    await user.click(statusOption)

    // Verify filtering
    await waitFor(() => {
      const visibleCards = screen.getAllByTestId('paper-card')
      visibleCards.forEach(card => {
        const statusBadge = within(card).getByTestId('paper-status')
        expect(statusBadge).toHaveTextContent('processed')
      })
    })
  })

  it('handles batch selection and operations', async () => {
    render(<PapersPage />)

    // Wait for papers to load
    await waitFor(() => {
      expect(screen.getAllByTestId('paper-card').length).toBeGreaterThan(0)
    })

    const cards = screen.getAllByTestId('paper-card')

    // Select multiple papers
    await user.click(within(cards[0]).getByRole('checkbox'))
    await user.click(within(cards[1]).getByRole('checkbox'))

    // Batch actions should appear
    await waitFor(() => {
      expect(screen.getByText(/selected 2 papers/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /process selected/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument()
    })

    // Click batch process
    const batchProcessButton = screen.getByRole('button', { name: /process selected/i })
    await user.click(batchProcessButton)

    // Process dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('batch-process-dialog')).toBeInTheDocument()
    })
  })

  it('handles pagination', async () => {
    render(<PapersPage />)

    // Wait for papers to load
    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })

    // Click next page
    const nextPageButton = screen.getByRole('button', { name: /next page/i })
    await user.click(nextPageButton)

    // Verify page change
    await waitFor(() => {
      expect(screen.getByText(/page 2/i)).toBeInTheDocument()
    })
  })

  it('handles error states', async () => {
    // Mock API error
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    render(<PapersPage />)

    // Error state should be shown
    await waitFor(() => {
      expect(screen.getByText(/failed to load papers/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    // Click retry
    const retryButton = screen.getByRole('button', { name: /retry/i })
    await user.click(retryButton)

    // Should attempt to reload
    expect(fetch).toHaveBeenCalled()
  })

  it('handles empty state', async () => {
    // Mock empty response
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: [],
        total: 0
      }))
    )

    render(<PapersPage />)

    // Empty state should be shown
    await waitFor(() => {
      expect(screen.getByText(/no papers found/i)).toBeInTheDocument()
      expect(screen.getByText(/upload your first paper/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /upload paper/i })).toBeInTheDocument()
    })
  })

  it('handles keyboard navigation', async () => {
    render(<PapersPage />)

    // Wait for papers to load
    await waitFor(() => {
      expect(screen.getAllByTestId('paper-card').length).toBeGreaterThan(0)
    })

    const firstCard = screen.getAllByTestId('paper-card')[0]
    firstCard.focus()

    // Navigate with keyboard
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    // Should open paper details
    await waitFor(() => {
      expect(screen.getByTestId('paper-details-modal')).toBeInTheDocument()
    })
  })
})