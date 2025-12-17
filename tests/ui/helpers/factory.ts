import { Paper, SearchResult, Task, User } from "@/types";
import { faker } from "@faker-js/faker";

// Paper factory
export const createPaper = (overrides: Partial<Paper> = {}): Paper => ({
  id: faker.string.uuid(),
  title: faker.lorem.words(5),
  authors: [faker.person.fullName(), faker.person.fullName()],
  abstract: faker.lorem.paragraphs(3),
  keywords: [faker.lorem.word(), faker.lorem.word()],
  category: faker.helpers.arrayElement([
    "llm-agents",
    "context-engineering",
    "reasoning",
    "tool-use",
    "planning",
    "memory",
    "multi-agent",
  ]),
  status: faker.helpers.arrayElement([
    "uploaded",
    "processing",
    "processed",
    "failed",
  ]),
  uploadedAt: faker.date.past().toISOString(),
  updatedAt: faker.date.recent().toISOString(),
  fileSize: faker.number.int({ min: 1024, max: 10485760 }),
  fileName: `${faker.lorem.slug()}.pdf`,
  filePath: `/papers/${faker.string.uuid()}.pdf`,
  ...overrides,
});

// Create multiple papers
export const createPapers = (
  count: number,
  overrides: Partial<Paper> = {}
): Paper[] => Array.from({ length: count }, () => createPaper(overrides));

// User factory
export const createUser = (overrides: Partial<User> = {}): User => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  avatar: faker.image.avatar(),
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  preferences: {
    theme: faker.helpers.arrayElement(["light", "dark", "system"]),
    language: faker.helpers.arrayElement(["zh-CN", "en-US"]),
    auto_translate: faker.datatype.boolean(),
    notification_email: faker.datatype.boolean(),
    papers_per_page: faker.helpers.arrayElement([10, 20, 50]),
  },
  ...overrides,
});

// Task factory
export const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: faker.string.uuid(),
  type: faker.helpers.arrayElement([
    "upload",
    "process",
    "translate",
    "summarize",
  ]),
  status: faker.helpers.arrayElement([
    "pending",
    "processing",
    "completed",
    "failed",
  ]),
  progress: faker.number.int({ min: 0, max: 100 }),
  created_at: faker.date.recent().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  result: null,
  error: null,
  ...overrides,
});

// Search result factory
export const createSearchResult = (
  overrides: Partial<SearchResult> = {}
): SearchResult => ({
  type: "paper",
  id: faker.string.uuid(),
  title: faker.lorem.words(5),
  excerpt: faker.lorem.sentences(2),
  score: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
  ...overrides,
});

// API response factory
export const createApiResponse = <T>(data: T, overrides: any = {}) => ({
  success: true,
  data,
  message: "",
  ...overrides,
});

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
});

// Error response factory
export const createErrorResponse = (message: string, status = 400) => ({
  success: false,
  message,
  error: {
    status,
    code: faker.lorem.slug(),
    details: faker.lorem.sentence(),
  },
});

// File factory for upload tests
export const createFile = (
  name = "test.pdf",
  type = "application/pdf",
  size = 1024 * 1024
): File => {
  const file = new File(["test content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

// Mock event factory
export const createMockEvent = (overrides: any = {}) => ({
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  target: {
    value: "",
    files: [],
    ...overrides.target,
  },
  ...overrides,
});

// Mock router factory
export const createMockRouter = (overrides: any = {}) => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: "/",
  query: {},
  ...overrides,
});

// Constants for test data
export const TEST_PAPERS = {
  ATTENTION_PAPER: createPaper({
    id: "attention-paper-id",
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer"],
    category: "llm-agents" as const,
    status: "analyzed" as const,
    uploadedAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T12:00:00Z",
  }),
  BERT_PAPER: createPaper({
    id: "bert-paper-id",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: ["Jacob Devlin", "Ming-Wei Chang"],
    category: "context-engineering" as const,
    status: "processing" as const,
    uploadedAt: "2024-01-14T10:00:00Z",
    updatedAt: "2024-01-14T12:00:00Z",
  }),
  GPT3_PAPER: createPaper({
    id: "gpt3-paper-id",
    title: "GPT-3: Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "Benjamin Mann"],
    category: "reasoning" as const,
    status: "uploaded" as const,
    uploadedAt: "2024-01-13T10:00:00Z",
    updatedAt: "2024-01-13T12:00:00Z",
  }),
};

export const TEST_USER = {
  EXAMPLE_USER: createUser({
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
  }),
};

// Helper to reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
};
