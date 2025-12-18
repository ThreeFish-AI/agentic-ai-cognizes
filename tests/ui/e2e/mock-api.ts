import { Page } from "@playwright/test";
import papersData from "../fixtures/papers.json";

export async function setupMockApi(page: Page) {
  // Helper to get fresh copy of data for each test
  // Helper to get fresh copy of data for each test
  let dbPapers = JSON.parse(JSON.stringify(papersData));

  // Handle all API requests
  await page.route("**/api/papers*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    // GET /api/papers (Search and List)
    if (method === "GET" && !url.pathname.match(/\/api\/papers\/.+/)) {
      const search =
        url.searchParams.get("search") || url.searchParams.get("q");
      const status = url.searchParams.get("status");
      const pageNum = Number(url.searchParams.get("page")) || 1;
      const limit = Number(url.searchParams.get("limit")) || 10;

      let results = [...dbPapers];

      if (search) {
        const q = search.toLowerCase();
        results = results.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.authors.some((a: string) => a.toLowerCase().includes(q))
        );
      }

      if (status && status !== "all") {
        results = results.filter((p) => p.status === status);
      }

      const total = results.length;
      const start = (pageNum - 1) * limit;
      const paginated = results.slice(start, start + limit);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          items: paginated,
          pagination: {
            page: pageNum,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }),
      });
      return;
    }

    // POST /api/papers (Upload)
    if (method === "POST" && url.pathname === "/api/papers") {
      const newPaper = {
        ...papersData[0], // fallback for fields
        id: String(Date.now()),
        title: "New Paper",
        authors: ["Unknown"],
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
        // Mock other fields
        abstract: "Mock abstract",
        fileSize: 12345,
      };
      dbPapers.push(newPaper);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: newPaper }),
      });
      return;
    }

    // Batch process
    if (method === "POST" && url.pathname.endsWith("/batch-process")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Batch process started",
        }),
      });
      return;
    }

    // Single item operations
    // Extract ID from path
    const match = url.pathname.match(/\/api\/papers\/([^/]+)/);
    if (match) {
      const id = match[1];

      if (method === "DELETE") {
        dbPapers = dbPapers.filter((p) => p.id !== id);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      if (method === "POST" && url.pathname.includes("/process")) {
        // Update status to processing
        const p = dbPapers.find((x) => x.id === id);
        if (p) p.status = "processing";

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      if (method === "GET") {
        const p = dbPapers.find((x) => x.id === id);
        if (p) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true, data: p }),
          });
        } else {
          await route.fulfill({ status: 404 });
        }
        return;
      }
    }

    await route.continue();
  });
}
