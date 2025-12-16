import { faker } from '@faker-js/faker'
import { Paper, User, Task, SearchResult } from '@/types'

// Paper factory
export const createPaper = (overrides: Partial<Paper> = {}): Paper => ({
  id: faker.datatype.uuid(),
  title: faker.lorem.words(5),
  authors: [faker.name.fullName(), faker.name.fullName()],
  abstract: faker.lorem.paragraphs(3),
  status: faker.helpers.arrayElement(['uploaded', 'processing', 'processed', 'failed']),
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  tags: [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()],
  pdf_url: faker.internet.url(),
  arxiv_id: faker.datatype.string({ length: 10 }),
  ...overrides,
})

// Create multiple papers
export const createPapers = (count: number, overrides: Partial<Paper> = {}): Paper[] =>
  Array.from({ length: count }, () => createPaper(overrides))

// User factory
export const createUser = (overrides: Partial<User> = {}): User => ({
  id: faker.datatype.uuid(),
  email: faker.internet.email(),
  name: faker.name.fullName(),
  avatar: faker.internet.avatar(),
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  preferences: {
    theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
    language: faker.helpers.arrayElement(['zh-CN', 'en-US']),
    auto_translate: faker.datatype.boolean(),
    notification_email: faker.datatype.boolean(),
    papers_per_page: faker.helpers.arrayElement([10, 20, 50]),
  },
  ...overrides,
})

// Task factory
export const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: faker.datatype.uuid(),
  type: faker.helpers.arrayElement(['upload', 'process', 'translate', 'summarize']),
  status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
  progress: faker.datatype.number({ min: 0, max: 100 }),
  created_at: faker.date.recent().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  result: null,
  error: null,
  ...overrides,
})

// Search result factory
export const createSearchResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  type: 'paper',
  id: faker.datatype.uuid(),
  title: faker.lorem.words(5),
  excerpt: faker.lorem.sentences(2),
  score: faker.datatype.number({ min: 0, max: 1, precision: 0.01 }),
  ...overrides,
})

// API response factory
export const createApiResponse = <T>(data: T, overrides: any = {}) => ({
  success: true,
  data,
  message: '',
  ...overrides,
})

// Paginated response factory
export const createPaginatedResponse = <T>(
  items: T[],
  page = 1,
  limit = 10,
  overrides: any = {}
) => ({
  success: true,
  data: items,
  pagination: {
    page,
    limit,
    total: items.length,
    totalPages: Math.ceil(items.length / limit),
  },
  ...overrides,
})

// Error response factory
export const createErrorResponse = (message: string, status = 400) => ({
  success: false,
  message,
  error: {
    status,
    code: faker.lorem.slug(),
    details: faker.lorem.sentence(),
  },
})

// File factory for upload tests
export const createFile = (
  name = 'test.pdf',
  type = 'application/pdf',
  size = 1024 * 1024
): File => {
  const file = new File(['test content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// Mock event factory
export const createMockEvent = (overrides: any = {}) => ({
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  target: {
    value: '',
    files: [],
    ...overrides.target,
  },
  ...overrides,
})

// Mock router factory
export const createMockRouter = (overrides: any = {}) => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: '/',
  query: {},
  ...overrides,
})

// Constants for test data
export const TEST_PAPERS = {
  ATTENTION_PAPER: createPaper({
    id: 'attention-paper-id',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer'],
    arxiv_id: '1706.03762',
    status: 'processed' as const,
  }),
  BERT_PAPER: createPaper({
    id: 'bert-paper-id',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: ['Jacob Devlin', 'Ming-Wei Chang'],
    arxiv_id: '1810.04805',
    status: 'processing' as const,
  }),
  GPT3_PAPER: createPaper({
    id: 'gpt3-paper-id',
    title: 'GPT-3: Language Models are Few-Shot Learners',
    authors: ['Tom B. Brown', 'Benjamin Mann'],
    arxiv_id: '2005.14165',
    status: 'uploaded' as const,
  }),
}

export const TEST_USER = {
  EXAMPLE_USER: createUser({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  }),
}

// Helper to reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks()
  jest.resetAllMocks()
}