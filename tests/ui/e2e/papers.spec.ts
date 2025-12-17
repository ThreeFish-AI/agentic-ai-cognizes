import { expect, test } from "@playwright/test";
import { setupMockApi } from "./mock-api";

test.describe("Papers Management", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/papers");
  });

  test("displays papers list correctly", async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Papers/);

    // Check main heading
    await expect(page.locator("h1")).toContainText("论文管理");

    // Check paper cards are displayed
    await expect(page.locator('[data-testid="paper-card"]')).toHaveCount(5);
  });

  test("searches papers", async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill("Attention");

    // Should show filtered results
    await expect(page.locator('[data-testid="paper-card"]')).toHaveCount(1);
    await expect(page.locator("text=Attention Is All You Need")).toBeVisible();
  });

  test("filters papers by status", async ({ page }) => {
    // Click status filter
    await page.click('[data-testid="status-filter"]');

    // Select 'Processed' status
    await page.click("text=Processed");

    // Verify filtered results
    const processedCards = page.locator('[data-testid="paper-card"]');
    const count = await processedCards.count();

    for (let i = 0; i < count; i++) {
      const statusBadge = processedCards
        .nth(i)
        .locator('[data-testid="paper-status"]');
      await expect(statusBadge).toHaveText("processed");
    }
  });

  test("uploads a new paper", async ({ page }) => {
    // Click upload button
    await page.click('button:has-text("上传论文")');

    // Verify upload modal
    await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible();

    // Upload a file (simulate file upload)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("../tests/ui/fixtures/sample.pdf");

    // Wait for upload to complete
    await expect(page.locator("text=上传成功")).toBeVisible();

    // Close modal
    await page.click('[data-testid="upload-modal"] button[aria-label="Close"]');

    // Verify new paper appears in list
    await expect(page.locator('[data-testid="paper-card"]')).toHaveCount(6);
  });

  test("processes a paper", async ({ page }) => {
    // Hover over first paper to show actions
    const firstCard = page.locator('[data-testid="paper-card"]').first();
    await firstCard.hover();

    // Click process button
    await firstCard.locator('button:has-text("处理")').click();

    // Select processing type
    await page.click('[data-testid="process-dialog"]');
    await page.click("text=翻译成中文");
    await page.click('button:has-text("开始处理")');

    // Verify processing started
    await expect(page.locator("text=处理已开始")).toBeVisible();

    // Verify paper status updated
    await expect(firstCard.locator('[data-testid="paper-status"]')).toHaveText(
      "processing"
    );
  });

  test("batch processes multiple papers", async ({ page }) => {
    // Select multiple papers
    const checkboxes = page.locator(
      '[data-testid="paper-card"] input[type="checkbox"]'
    );
    await checkboxes.first().check();
    await checkboxes.nth(1).check();

    // Verify selection count
    await expect(page.locator("text=已选择 2 篇论文")).toBeVisible();

    // Click batch process
    await page.click('button:has-text("批量处理")');

    // Select workflow
    await page.click("text=翻译成中文");
    await page.click('button:has-text("开始批量处理")');

    // Verify processing started
    await expect(page.locator("text=批量处理已开始")).toBeVisible();
  });

  test("deletes a paper with confirmation", async ({ page }) => {
    // Get initial count
    const initialCount = await page
      .locator('[data-testid="paper-card"]')
      .count();

    // Hover over first paper
    const firstCard = page.locator('[data-testid="paper-card"]').first();
    await firstCard.hover();

    // Click delete button
    await firstCard.locator('button:has-text("删除")').click();

    // Verify confirmation dialog
    await expect(page.locator("text=确定要删除这篇论文吗？")).toBeVisible();
    await expect(page.locator('button:has-text("确认")')).toBeVisible();

    // Confirm deletion
    await page.click('button:has-text("确认")');

    // Verify deletion success message
    await expect(page.locator("text=删除成功")).toBeVisible();

    // Verify paper removed from list
    await expect(page.locator('[data-testid="paper-card"]')).toHaveCount(
      initialCount - 1
    );
  });

  test("views paper details", async ({ page }) => {
    // Click on first paper
    const firstCard = page.locator('[data-testid="paper-card"]').first();
    await firstCard.click();

    // Verify details modal
    await expect(
      page.locator('[data-testid="paper-details-modal"]')
    ).toBeVisible();
    await expect(page.locator('h2:has-text("论文详情")')).toBeVisible();

    // Check paper information
    await expect(page.locator('[data-testid="paper-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="paper-authors"]')).toBeVisible();
    await expect(page.locator('[data-testid="paper-abstract"]')).toBeVisible();

    // Close modal
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-testid="paper-details-modal"]')
    ).not.toBeVisible();
  });

  test("handles empty state", async ({ page }) => {
    // Mock empty state by filtering non-existent papers
    await page.fill('[data-testid="search-input"]', "NonExistentPaper");

    // Verify empty state message
    await expect(page.locator("text=没有找到相关论文")).toBeVisible();
    await expect(page.locator("text=上传您的第一篇论文")).toBeVisible();
    await expect(page.locator('button:has-text("上传论文")')).toBeVisible();
  });

  test("handles error state", async ({ page }) => {
    // Intercept and mock error response
    await page.route("/api/papers", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Internal server error",
        }),
      });
    });

    // Reload page to trigger error
    await page.reload();

    // Verify error message
    await expect(page.locator("text=加载论文失败")).toBeVisible();
    await expect(page.locator('button:has-text("重试")')).toBeVisible();

    // Click retry
    await page.click('button:has-text("重试")');

    // Should attempt to reload
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  });

  test("handles pagination", async ({ page }) => {
    // Wait for pagination to appear
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();

    // Click next page
    await page.click('button[aria-label="Next page"]');

    // Verify URL and page indicator
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("text=第 2 页")).toBeVisible();

    // Go back to previous page
    await page.click('button[aria-label="Previous page"]');
    await expect(page).toHaveURL(/page=1/);
  });

  test("responsive design works on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();

    // Test mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Test swipe gestures (if implemented)
    await page.touchstart('[data-testid="paper-card"]', { x: 100, y: 100 });
    await page.touchmove(200, 100);
    await page.touchend();
  });

  test("accessibility features", async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    // Test ARIA labels
    await expect(page.locator('[aria-label="论文列表"]')).toBeVisible();
    await expect(
      page.locator('[role="button"][aria-label="上传论文"]')
    ).toBeVisible();

    // Test screen reader support
    const paperCard = page.locator('[data-testid="paper-card"]').first();
    await expect(paperCard).toHaveAttribute("role", "button");
    await expect(paperCard).toHaveAttribute("tabindex");
  });

  test("dark mode toggle", async ({ page }) => {
    // Find theme toggle button
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    await themeToggle.click();

    // Verify dark mode is applied
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Toggle back to light mode
    await themeToggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
