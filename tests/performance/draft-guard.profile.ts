import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

for (const workload of [{ name: "small", faces: 1, text: 1000, baseline: "record" }, { name: "multi-face", faces: 8, text: 2000, baseline: "record" }, { name: "maximum-faces", faces: 32, text: 20000, baseline: "record" }, { name: "maximum-inspection", faces: 32, text: 20000, baseline: "null" }]) {
  test(`profile ${workload.name} draft input commits`, async ({ page }) => {
    const results = [];
    for (let trial = 0; trial < 5; trial++) {
      await page.goto(`/tests/draft-guard.html?faces=${workload.faces}&text=${workload.text}&baseline=${workload.baseline}`);
      const input = page.getByLabel("First source", { exact: true });
      await expect(input).toHaveValue("Initial source");
      await input.press("End");
      await input.pressSequentially("warmup");
      await page.evaluate(() => { window.guardProfile.serializations = []; window.guardProfile.commits = []; });
      await input.pressSequentially("abcdefghijklmnopqrstuvwxyz".repeat(4));
      await expect(input).toHaveValue("Initial sourcewarmup" + "abcdefghijklmnopqrstuvwxyz".repeat(4));
      const typing = await page.evaluate(() => structuredClone(window.guardProfile));
      await page.evaluate(() => { window.guardProfile.serializations = []; });
      for (let i = 0; i < 10; i++) await page.getByRole("button", { name: /^Rerender First/ }).click();
      const rerender = await page.evaluate(() => structuredClone(window.guardProfile.serializations));
      page.once("dialog", dialog => dialog.dismiss());
      await page.evaluate(() => { window.guardProfile.serializations = []; });
      await page.getByRole("button", { name: "Navigate", exact: true }).click();
      const navigation = await page.evaluate(() => structuredClone(window.guardProfile.serializations));
      const summary = (samples: number[]) => {
        const sorted = [...samples].sort((a, b) => a - b);
        return { count: samples.length, totalMs: samples.reduce((a, b) => a + b, 0), medianMs: sorted[Math.floor(sorted.length * .5)] ?? 0, p95Ms: sorted[Math.floor(sorted.length * .95)] ?? 0, maxMs: sorted.at(-1) ?? 0 };
      };
      results.push({ typingSerialization: summary(typing.serializations), inputCommit: summary(typing.commits), rerenderSerialization: summary(rerender), navigationSerialization: summary(navigation) });
    }
    const result = { variant: process.env.DRAFT_PROFILE_VARIANT ?? "before", workload, trials: results };
    await writeFile(`node_modules/.tmp/draft-guard-profile/${result.variant}-${workload.name}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  });
}
