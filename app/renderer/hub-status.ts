/**
 * Owns what the Hub's status line says: the latest report, the progress of a running action it
 * falls back to when it has nothing newer to say (KEY-19), and whether its text is a receipt,
 * which outlives the typing that ended its session. Nothing here touches the DOM: each change
 * returns the line to draw, or null when the line stays, and hub.ts puts it into its view model.
 * Node tests hold these rules (tests/unit/hub-status.test.ts).
 */
export type HubStatusLine = Readonly<{ text: string; busy: boolean }>;

export function createHubStatus() {
  let progress: Readonly<{ owner: object; message: string }> | null = null;
  let text = '', receipt = false, showingProgress = false;
  /** A report replaces the line; an empty one falls back to the progress still running. */
  function report(message: string, isReceipt = false): HubStatusLine {
    text = message || progress?.message || '';
    receipt = isReceipt && !!message; showingProgress = !message && !!text;
    return { text, busy: showingProgress };
  }
  return {
    report,
    get text() { return text; },
    /** The line shows a receipt: typing or a new page keeps it. */
    get receipt() { return receipt; },
    /** The line shows an action's progress, so the Hub shows it busy. */
    get busy() { return showingProgress; },
    /** The player moved on (typed, opened a page): the line clears, unless it shows a receipt. */
    moved: (): HubStatusLine | null => receipt ? null : report(''),
    /**
     * An action's progress. It repaints only on its own page (`live`), over other progress or
     * over an empty line: a newer message, e.g. a refusal or another action's failure, stays.
     */
    progress(owner: object, message: string, live: boolean): HubStatusLine | null {
      progress = { owner, message };
      return live || showingProgress || !text ? report('') : null;
    },
    /** An action ended: its own progress never stays behind; another action's progress does. */
    end(owner: object): HubStatusLine | null {
      if (progress?.owner !== owner) return null;
      progress = null;
      return showingProgress ? report('') : null;
    },
    /** An observer withdrew its resolved failure: only the receipt that names it clears. */
    withdraw: (message: string): HubStatusLine | null => receipt && text === message ? report('') : null,
  };
}
