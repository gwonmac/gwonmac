import type { TestInfo } from '@playwright/test';

// Shared CI runners add scheduling jitter of tens of milliseconds, so wall-clock
// budgets get three times the room there. Real regressions (hundreds of ms of
// synchronous work) still fail in both places. A runner stall of that size hits
// one attempt only; the macOS job retries a failed spec once (playwright.config.ts).
// The budgets are measured on the Macs the app ships on, so specs that use them
// carry the @macos tag.
export const timeBudget = (ms: number) => (process.env.CI ? ms * 3 : ms);

/**
 * Reports times a spec measured without judging them. A busy hosted runner stalls for
 * longer than any frame budget, so the 1000-row specs gate on work they can count (the
 * rows one task draws) and report their times here: attached to the test, and printed
 * on one line in the run's log, where a slow trend stays visible.
 */
export async function reportTimings(info: TestInfo, name: string, timings: unknown) {
  await info.attach(`${name}.json`, { body: JSON.stringify(timings, null, 2), contentType: 'application/json' });
  console.log(`[hub timings] ${name} ${JSON.stringify(timings)}`);
}
