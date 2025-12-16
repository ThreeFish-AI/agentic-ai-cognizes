import { renderHook, act, waitFor } from '@testing-library/react'
import { usePaperStore } from '@/store/paperStore'
import { server } from '../../__mocks__/server'
import { createPaper, createPapers } from '../../helpers/factory'

describe('usePaperStore', () => {
  beforeEach(() => {
    // Reset store before each test
    usePaperStore.setState({
      papers: [],
      loading: false,
      error: null,
    })
  })

  it('has initial state', () => {
    const { result } = renderHook(() => usePaperStore())

    expect(result.current.papers).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('fetches papers successfully', async () => {
    const { result } = renderHook(() => usePaperStore())

    await act(async () => {
      await result.current.fetchPapers()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.papers).toHaveLength(5) // Based on fixture data
    expect(result.current.error).toBe(null)
  })

  it('handles fetch error', async () => {
    // Mock error response
    server.use(
      rest.get('/api/papers', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({
            success: false,
            message: 'Internal server error'
          })
        )
      })
    )

    const { result } = renderHook(() => usePaperStore())

    await act(async () => {
      await result.current.fetchPapers()
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.papers).toHaveLength(0)
  })

  it('filters papers by search term', async () => {
    const { result } = renderHook(() => usePaperStore())

    // First fetch papers
    await act(async () => {
      await result.current.fetchPapers()
    })

    // Then search
    await act(async () => {
      result.current.setSearchTerm('Attention')
    })

    await waitFor(() => {
      expect(result.current.filteredPapers).toHaveLength(1)
      expect(result.current.filteredPapers[0].title).toContain('Attention')
    })
  })

  it('filters papers by status', async () => {
    const { result } = renderHook(() => usePaperStore())

    // First fetch papers
    await act(async () => {
      await result.current.fetchPapers()
    })

    // Then filter by status
    await act(async () => {
      result.current.setStatusFilter('processed')
    })

    await waitFor(() => {
      const processedPapers = result.current.filteredPapers.filter(
        p => p.status === 'processed'
      )
      expect(processedPapers).toEqual(result.current.filteredPapers)
    })
  })

  it('adds a new paper', async () => {
    const { result } = renderHook(() => usePaperStore())
    const newPaper = createPaper()

    await act(async () => {
      await result.current.addPaper(newPaper)
    })

    expect(result.current.papers).toContainEqual(newPaper)
  })

  it('updates a paper', async () => {
    const { result } = renderHook(() => usePaperStore())
    const paper = createPaper({ id: 'test-id', status: 'uploaded' })

    // Add paper first
    await act(async () => {
      await result.current.addPaper(paper)
    })

    // Update paper
    await act(async () => {
      await result.current.updatePaper('test-id', { status: 'processed' })
    })

    const updatedPaper = result.current.papers.find(p => p.id === 'test-id')
    expect(updatedPaper?.status).toBe('processed')
  })

  it('deletes a paper', async () => {
    const { result } = renderHook(() => usePaperStore())
    const paper = createPaper({ id: 'test-id' })

    // Add paper first
    await act(async () => {
      await result.current.addPaper(paper)
    })

    // Delete paper
    await act(async () => {
      await result.current.deletePaper('test-id')
    })

    expect(result.current.papers).not.toContainEqual(paper)
  })

  it('handles bulk operations', async () => {
    const { result } = renderHook(() => usePaperStore())
    const papers = createPapers(3)

    // Add papers
    await act(async () => {
      papers.forEach(paper => {
        result.current.addPaper(paper)
      })
    })

    // Select papers
    await act(async () => {
      result.current.selectPaper(papers[0].id)
      result.current.selectPaper(papers[1].id)
    })

    expect(result.current.selectedPaperIds).toHaveLength(2)

    // Clear selection
    await act(async () => {
      result.current.clearSelection()
    })

    expect(result.current.selectedPaperIds).toHaveLength(0)
  })

  it('processes multiple papers', async () => {
    const { result } = renderHook(() => usePaperStore())
    const papers = createPapers(3, { status: 'uploaded' })

    // Add papers
    await act(async () => {
      papers.forEach(paper => {
        result.current.addPaper(paper)
      })
    })

    // Process selected papers
    await act(async () => {
      await result.current.processSelectedPapers('translate')
    })

    // Check if papers are being processed
    await waitFor(() => {
      const processedPapers = result.current.papers.filter(
        p => p.status === 'processing'
      )
      expect(processedPapers.length).toBeGreaterThan(0)
    })
  })

  it('persists state in localStorage', () => {
    const { result } = renderHook(() => usePaperStore())

    // Change some state
    act(() => {
      result.current.setSearchTerm('test')
      result.current.setStatusFilter('processed')
    })

    // Check localStorage
    expect(localStorage.getItem('paper-store-search')).toBe('test')
    expect(localStorage.getItem('paper-store-status')).toBe('processed')
  })

  it('loads state from localStorage on initialization', () => {
    // Set localStorage values
    localStorage.setItem('paper-store-search', 'test-search')
    localStorage.setItem('paper-store-status', 'test-status')

    const { result } = renderHook(() => usePaperStore())

    expect(result.current.searchTerm).toBe('test-search')
    expect(result.current.statusFilter).toBe('test-status')
  })
})