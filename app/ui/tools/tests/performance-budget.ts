// Shared CI runners add scheduling jitter of tens of milliseconds, so wall-clock
// budgets get three times the room there. Real regressions (hundreds of ms of
// synchronous work) still fail in both places. A runner stall of that size hits
// one attempt only; the macOS job retries a failed spec once (playwright.config.ts).
// The budgets are measured on the Macs the app ships on, so specs that use them
// carry the @macos tag.
export const timeBudget = (ms: number) => (process.env.CI ? ms * 3 : ms);
