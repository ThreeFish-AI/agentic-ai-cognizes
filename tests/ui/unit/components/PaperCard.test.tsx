import { render, screen, fireEvent, waitFor } from '../../helpers/render'
import { PaperCard } from '@/components/papers/PaperCard'
import { TEST_PAPERS } from '../../helpers/factory'

describe('PaperCard', () => {
  const defaultProps = {
    paper: TEST_PAPERS.ATTENTION_PAPER,
    onSelect: jest.fn(),
    onDelete: jest.fn(),
    onProcess: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders paper information correctly', () => {
    render(<PaperCard {...defaultProps} />)

    expect(screen.getByText(TEST_PAPERS.ATTENTION_PAPER.title)).toBeInTheDocument()
    expect(screen.getByText(TEST_PAPERS.ATTENTION_PAPER.authors.join(', '))).toBeInTheDocument()
    expect(screen.getByTestId('paper-status')).toHaveTextContent('processed')
  })

  it('handles paper selection', async () => {
    render(<PaperCard {...defaultProps} />)

    const card = screen.getByTestId('paper-card')
    fireEvent.click(card)

    await waitFor(() => {
      expect(defaultProps.onSelect).toHaveBeenCalledWith(TEST_PAPERS.ATTENTION_PAPER.id)
    })
  })

  it('shows action buttons on hover', async () => {
    render(<PaperCard {...defaultProps} />)

    const card = screen.getByTestId('paper-card')
    fireEvent.mouseEnter(card)

    await waitFor(() => {
      expect(screen.getByTestId('action-buttons')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /process/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })
  })

  it('handles process button click', async () => {
    render(<PaperCard {...defaultProps} />)

    const card = screen.getByTestId('paper-card')
    fireEvent.mouseEnter(card)

    const processButton = await screen.findByRole('button', { name: /process/i })
    fireEvent.click(processButton)

    // Mock process dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('process-dialog')).toBeInTheDocument()
    })
  })

  it('handles delete with confirmation', async () => {
    render(<PaperCard {...defaultProps} />)

    const card = screen.getByTestId('paper-card')
    fireEvent.mouseEnter(card)

    const deleteButton = await screen.findByRole('button', { name: /delete/i })
    fireEvent.click(deleteButton)

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(defaultProps.onDelete).toHaveBeenCalledWith(TEST_PAPERS.ATTENTION_PAPER.id)
    })
  })

  it('displays different status colors', () => {
    const statusTests = [
      { paper: TEST_PAPERS.BERT_PAPER, expectedStatus: 'processing' },
      { paper: TEST_PAPERS.GPT3_PAPER, expectedStatus: 'uploaded' },
    ]

    statusTests.forEach(({ paper, expectedStatus }) => {
      const { unmount } = render(
        <PaperCard {...defaultProps} paper={paper} />
      )

      const statusElement = screen.getByTestId('paper-status')
      expect(statusElement).toHaveTextContent(expectedStatus)
      expect(statusElement).toHaveClass(`status-${expectedStatus}`)

      unmount()
    })
  })

  it('shows tags when present', () => {
    const paperWithTags = {
      ...TEST_PAPERS.ATTENTION_PAPER,
      tags: ['transformer', 'attention', 'nlp'],
    }

    render(<PaperCard {...defaultProps} paper={paperWithTags} />)

    paperWithTags.tags.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument()
    })
  })

  it('is accessible', async () => {
    const { container } = render(<PaperCard {...defaultProps} />)

    // Check for proper ARIA attributes
    const card = screen.getByTestId('paper-card')
    expect(card).toHaveAttribute('role', 'button')
    expect(card).toHaveAttribute('tabIndex', '0')

    // Keyboard navigation
    fireEvent.keyDown(card, { key: 'Enter' })
    await waitFor(() => {
      expect(defaultProps.onSelect).toHaveBeenCalled()
    })
  })
})