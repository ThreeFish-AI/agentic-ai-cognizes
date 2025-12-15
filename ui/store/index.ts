import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Types
export interface Paper {
  paper_id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  abstract: string;
  doi?: string;
  keywords?: string[];
  status: string;
  created_at: string;
  updated_at: string;
  selected?: boolean;
}

export interface Task {
  task_id: string;
  task_type: string;
  status: string;
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: any;
}

export interface TaskUpdate {
  task_id: string;
  status?: string;
  progress?: number;
  message?: string;
  error?: string;
}

// App store
interface AppStore {
  // UI State
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    timestamp: number;
  }>;

  // Papers
  papers: Paper[];
  selectedPapers: Set<string>;
  currentPaper: Paper | null;
  papersLoading: boolean;
  papersError: string | null;
  papersPage: number;
  papersPerPage: number;
  papersTotal: number;
  papersFilters: {
    category?: string;
    status?: string;
    search?: string;
  };

  // Tasks
  tasks: Task[];
  taskUpdates: Record<string, TaskUpdate>;
  tasksLoading: boolean;
  tasksError: string | null;
  tasksPage: number;
  tasksPerPage: number;
  tasksTotal: number;
  tasksFilters: {
    status?: string;
    task_type?: string;
  };

  // WebSocket
  wsConnected: boolean;

  // Actions
  // UI Actions
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addNotification: (notification: Omit<AppStore['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Papers Actions
  setPapers: (papers: Paper[]) => void;
  addPaper: (paper: Paper) => void;
  updatePaper: (id: string, updates: Partial<Paper>) => void;
  removePaper: (id: string) => void;
  setCurrentPaper: (paper: Paper | null) => void;
  togglePaperSelection: (id: string) => void;
  selectAllPapers: () => void;
  deselectAllPapers: () => void;
  setPapersLoading: (loading: boolean) => void;
  setPapersError: (error: string | null) => void;
  setPapersPage: (page: number) => void;
  setPapersPerPage: (perPage: number) => void;
  setPapersTotal: (total: number) => void;
  setPapersFilters: (filters: AppStore['papersFilters']) => void;

  // Tasks Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setTaskUpdate: (taskId: string, update: TaskUpdate) => void;
  clearTaskUpdate: (taskId: string) => void;
  setTasksLoading: (loading: boolean) => void;
  setTasksError: (error: string | null) => void;
  setTasksPage: (page: number) => void;
  setTasksPerPage: (perPage: number) => void;
  setTasksTotal: (total: number) => void;
  setTasksFilters: (filters: AppStore['tasksFilters']) => void;

  // WebSocket Actions
  setWsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial UI State
      sidebarOpen: true,
      theme: 'system',
      notifications: [],

      // Initial Papers State
      papers: [],
      selectedPapers: new Set(),
      currentPaper: null,
      papersLoading: false,
      papersError: null,
      papersPage: 1,
      papersPerPage: 20,
      papersTotal: 0,
      papersFilters: {},

      // Initial Tasks State
      tasks: [],
      taskUpdates: {},
      tasksLoading: false,
      tasksError: null,
      tasksPage: 1,
      tasksPerPage: 20,
      tasksTotal: 0,
      tasksFilters: {},

      // WebSocket State
      wsConnected: false,

      // UI Actions
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),
      addNotification: (notification) => set((state) => ({
        notifications: [
          ...state.notifications,
          {
            ...notification,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
          },
        ],
      })),
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
      clearNotifications: () => set({ notifications: [] }),

      // Papers Actions
      setPapers: (papers) => set({ papers }),
      addPaper: (paper) => set((state) => ({
        papers: [paper, ...state.papers],
      })),
      updatePaper: (id, updates) => set((state) => ({
        papers: state.papers.map((p) =>
          p.paper_id === id ? { ...p, ...updates } : p
        ),
        currentPaper:
          state.currentPaper?.paper_id === id
            ? { ...state.currentPaper, ...updates }
            : state.currentPaper,
      })),
      removePaper: (id) => set((state) => ({
        papers: state.papers.filter((p) => p.paper_id !== id),
        currentPaper:
          state.currentPaper?.paper_id === id ? null : state.currentPaper,
        selectedPapers: new Set([...state.selectedPapers].filter((s) => s !== id)),
      })),
      setCurrentPaper: (paper) => set({ currentPaper: paper }),
      togglePaperSelection: (id) => set((state) => {
        const newSelected = new Set(state.selectedPapers);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        return { selectedPapers: newSelected };
      }),
      selectAllPapers: () => set((state) => ({
        selectedPapers: new Set(state.papers.map((p) => p.paper_id)),
      })),
      deselectAllPapers: () => set({ selectedPapers: new Set() }),
      setPapersLoading: (loading) => set({ papersLoading: loading }),
      setPapersError: (error) => set({ papersError: error }),
      setPapersPage: (page) => set({ papersPage: page }),
      setPapersPerPage: (perPage) => set({ papersPerPage: perPage }),
      setPapersTotal: (total) => set({ papersTotal: total }),
      setPapersFilters: (filters) => set((state) => ({
        papersFilters: { ...state.papersFilters, ...filters },
      })),

      // Tasks Actions
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({
        tasks: [task, ...state.tasks],
      })),
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.task_id === id ? { ...t, ...updates } : t
        ),
      })),
      removeTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.task_id !== id),
      })),
      setTaskUpdate: (taskId, update) => set((state) => ({
        taskUpdates: {
          ...state.taskUpdates,
          [taskId]: update,
        },
      })),
      clearTaskUpdate: (taskId) => set((state) => {
        const newUpdates = { ...state.taskUpdates };
        delete newUpdates[taskId];
        return { taskUpdates: newUpdates };
      }),
      setTasksLoading: (loading) => set({ tasksLoading: loading }),
      setTasksError: (error) => set({ tasksError: error }),
      setTasksPage: (page) => set({ tasksPage: page }),
      setTasksPerPage: (perPage) => set({ tasksPerPage: perPage }),
      setTasksTotal: (total) => set({ tasksTotal: total }),
      setTasksFilters: (filters) => set((state) => ({
        tasksFilters: { ...state.tasksFilters, ...filters },
      })),

      // WebSocket Actions
      setWsConnected: (connected) => set({ wsConnected: connected }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        papersFilters: state.papersFilters,
        tasksFilters: state.tasksFilters,
        papersPerPage: state.papersPerPage,
        tasksPerPage: state.tasksPerPage,
      }),
    }
  )
);