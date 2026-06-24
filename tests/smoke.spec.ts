import { expect, test } from "@playwright/test";

// Smoke + client-wiring checks against a deployed build (BASE_URL). The submission
// test intercepts the request, so it asserts the form posts correctly WITHOUT hitting
// the server (no real email) and without depending on Turnstile — the client posts
// regardless of whether the widget issued a token.

test("home page renders the hero and contact form", async ({ page }) => {
	const res = await page.goto("/");
	expect(res?.status()).toBe(200);

	await expect(page.locator("h1")).toContainText("benefit-led");
	await expect(page.locator("#services")).toBeVisible();
	await expect(
		page.locator('#contact form[action="/api/contact"]'),
	).toBeVisible();
});

test("thanks page renders", async ({ page }) => {
	const res = await page.goto("/thanks");
	expect(res?.status()).toBe(200);
	await expect(page.locator("h1")).toContainText("on its way");
});

test("submitting the form posts the expected request and shows success", async ({
	page,
}) => {
	await page.goto("/");

	// Intercept the POST so nothing reaches the server (no real email sent).
	await page.route("**/api/contact", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ ok: true }),
		}),
	);

	await page.fill("#name", "Test User");
	await page.fill("#email", "test@example.com");
	await page.fill("#message", "Just testing the form wiring.");

	const requestPromise = page.waitForRequest("**/api/contact");
	await page.click('#contact-form button[type="submit"]');
	const request = await requestPromise;

	// The request the client actually made.
	expect(request.method()).toBe("POST");
	expect(request.headers().accept).toContain("application/json");
	expect(request.postData() ?? "").toContain("Test User");
	expect(request.postData() ?? "").toContain("test@example.com");

	// The client's success branch ran.
	await expect(page.locator(".form-status[data-kind='ok']")).toBeVisible();
});

test("theme switcher applies a theme and persists it across reload", async ({
	page,
}) => {
	await page.goto("/");

	// Default: no data-theme on <html>.
	await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

	// Open the panel and pick a non-default theme.
	await page.click("#ts-fab");
	await page.check('.ts-radio[value="noir"]');

	// The choice is applied to <html> and saved to localStorage (no cookies).
	await expect(page.locator("html")).toHaveAttribute("data-theme", "noir");
	expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("noir");

	// It survives a reload, applied before paint (no flash back to default).
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "noir");
});
