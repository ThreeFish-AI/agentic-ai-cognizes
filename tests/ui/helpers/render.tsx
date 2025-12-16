import { render, RenderOptions } from '@testing-library/react'
import { ReactElement, ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { PaperProvider } from '@/components/papers/PaperContext'
import { AuthProvider } from '@/components/auth/AuthContext'

// Create a new query client for each test
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
})

// Custom providers wrapper
interface AllTheProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
  theme?: string
}

const AllTheProviders = ({
  children,
  queryClient = createTestQueryClient(),
  theme = 'light'
}: AllTheProvidersProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme={theme} enableSystem={false}>
        <SWRConfig value={{
          provider: () => new Map(),
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
        }}>
          <AuthProvider>
            <PaperProvider>
              {children}
            </PaperProvider>
          </AuthProvider>
        </SWRConfig>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  theme?: string
  initialRoute?: string
}

const customRender = (
  ui: ReactElement,
  {
    queryClient,
    theme = 'light',
    initialRoute = '/',
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  // Mock Next.js router if needed
  if (initialRoute) {
    window.history.pushState({}, 'Test', initialRoute)
  }

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient} theme={theme}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }

// Custom render without providers for isolated component tests
export const renderWithoutProviders = (
  ui: ReactElement,
  options?: RenderOptions
) => render(ui, options)

// Helper to wait for next tick
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0))

// Helper to create mock props
export const createMockProps = <T extends Record<string, any>>(
  defaultProps: T,
  overrides: Partial<T> = {}
): T => ({ ...defaultProps, ...overrides })

// Helper to mock async functions
export const createMockAsyncFn = <T extends any[], R>(
  implementation?: (...args: T) => Promise<R>
) => jest.fn().mockImplementation(implementation || (() => Promise.resolve({})))