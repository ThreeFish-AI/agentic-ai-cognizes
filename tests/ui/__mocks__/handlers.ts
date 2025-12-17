import { rest } from "msw";
import papers from "../../fixtures/papers.json";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const handlers = [
  // Papers API
  rest.get(`${API_URL}/api/papers`, (req, res, ctx) => {
    const page = Number(req.url.searchParams.get("page")) || 1;
    const limit = Number(req.url.searchParams.get("limit")) || 10;
    const search = req.url.searchParams.get("search");
    const status = req.url.searchParams.get("status");

    let filteredPapers = papers;

    // Apply filters
    if (search) {
      filteredPapers = filteredPapers.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.authors.some((a) => a.toLowerCase().includes(search.toLowerCase()))
      );
    }

    if (status) {
      filteredPapers = filteredPapers.filter((p) => p.status === status);
    }

    // Pagination
    const start = (page - 1) * limit;
    const paginatedPapers = filteredPapers.slice(start, start + limit);

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: paginatedPapers,
        pagination: {
          page,
          limit,
          total: filteredPapers.length,
          totalPages: Math.ceil(filteredPapers.length / limit),
        },
      })
    );
  }),

  rest.get(`${API_URL}/api/papers/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const paper = papers.find((p) => p.id === id);

    if (!paper) {
      return res(
        ctx.status(404),
        ctx.json({
          success: false,
          message: "Paper not found",
        })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: paper,
      })
    );
  }),

  rest.post(`${API_URL}/api/papers`, async (req, res, ctx) => {
    const paper = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: {
          id: "new-paper-id",
          ...paper,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })
    );
  }),

  rest.put(`${API_URL}/api/papers/:id`, async (req, res, ctx) => {
    const { id } = req.params;
    const updates = await req.json();

    const paperIndex = papers.findIndex((p) => p.id === id);
    if (paperIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({
          success: false,
          message: "Paper not found",
        })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          ...papers[paperIndex],
          ...updates,
          updated_at: new Date().toISOString(),
        },
      })
    );
  }),

  rest.delete(`${API_URL}/api/papers/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const paper = papers.find((p) => p.id === id);

    if (!paper) {
      return res(
        ctx.status(404),
        ctx.json({
          success: false,
          message: "Paper not found",
        })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        message: `Paper ${id} deleted successfully`,
      })
    );
  }),

  // File upload API
  rest.post(`${API_URL}/api/upload`, async (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          task_id: "upload-task-id",
          status: "processing",
          message: "File upload started",
        },
      })
    );
  }),

  rest.get(`${API_URL}/api/tasks/:id`, (req, res, ctx) => {
    const { id } = req.params;

    // Mock different task statuses based on ID
    const statuses = ["processing", "completed", "failed"];
    const status = statuses[parseInt(id) % statuses.length];

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          id,
          type: "upload",
          status,
          progress:
            status === "completed"
              ? 100
              : status === "failed"
              ? 0
              : Math.floor(Math.random() * 80) + 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          result:
            status === "completed" ? { paper_id: "processed-paper-id" } : null,
          error: status === "failed" ? "Processing failed" : null,
        },
      })
    );
  }),

  // Auth API
  rest.post(`${API_URL}/api/auth/login`, async (req, res, ctx) => {
    const { email, password } = await req.json();

    // Mock authentication
    if (email === "test@example.com" && password === "password") {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          data: {
            token: "mock-jwt-token",
            user: {
              id: "1",
              email: "test@example.com",
              name: "Test User",
              avatar: "https://example.com/avatar.jpg",
            },
          },
        })
      );
    }

    return res(
      ctx.status(401),
      ctx.json({
        success: false,
        message: "Invalid credentials",
      })
    );
  }),

  rest.post(`${API_URL}/api/auth/register`, async (req, res, ctx) => {
    const user = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: {
          id: "new-user-id",
          ...user,
          created_at: new Date().toISOString(),
        },
      })
    );
  }),

  rest.get(`${API_URL}/api/auth/me`, (req, res, ctx) => {
    // Check for auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes("Bearer mock-jwt-token")) {
      return res(
        ctx.status(401),
        ctx.json({
          success: false,
          message: "Unauthorized",
        })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          id: "1",
          email: "test@example.com",
          name: "Test User",
          avatar: "https://example.com/avatar.jpg",
        },
      })
    );
  }),

  // Search API
  rest.get(`${API_URL}/api/search`, (req, res, ctx) => {
    const query = req.url.searchParams.get("q") || "";
    const type = req.url.searchParams.get("type") || "all";

    let results = [];

    if (type === "papers" || type === "all") {
      results = papers
        .filter(
          (p) =>
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.abstract.toLowerCase().includes(query.toLowerCase())
        )
        .map((p) => ({
          type: "paper",
          id: p.id,
          title: p.title,
          excerpt: p.abstract.substring(0, 200) + "...",
        }));
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: results,
        total: results.length,
      })
    );
  }),

  // Settings API
  rest.get(`${API_URL}/api/settings`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          theme: "light",
          language: "zh-CN",
          auto_translate: true,
          notification_email: true,
          papers_per_page: 10,
        },
      })
    );
  }),

  rest.put(`${API_URL}/api/settings`, async (req, res, ctx) => {
    const settings = await req.json();
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          ...settings,
          updated_at: new Date().toISOString(),
        },
      })
    );
  }),

  // Health check
  rest.get(`${API_URL}/api/health`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          status: "healthy",
          timestamp: new Date().toISOString(),
        },
      })
    );
  }),
];
