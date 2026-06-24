import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Enforce WCAG 2.2 AA — the A + AA success criteria across WCAG 2.0/2.1/2.2.
// The Turnstile widget is excluded: its injected iframe is Cloudflare's markup, not ours.
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const path of ["/", "/thanks"]) {
  test(`a11y: ${path} meets WCAG 2.2 AA`, async ({ page }) => {
    await page.goto(path);

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_AA)
      .exclude(".cf-turnstile")
      .analyze();

    const report = violations
      .map(
        (v) =>
          `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes
            .map((n) => n.target.join(" "))
            .join("\n  ")}\n  ${v.helpUrl}`,
      )
      .join("\n\n");

    expect(violations.length, report || "no violations").toBe(0);
  });
}
