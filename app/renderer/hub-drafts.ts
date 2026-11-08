/**
 * Owns the Hub's form drafts for the session. A draft is keyed by page path and the field's
 * focus key: leaving a form keeps what was typed, and returning restores it, unless the stored
 * value the field started from changed meanwhile. Nothing here touches the DOM: hub.ts hands in
 * the fields the view reads and writes back what `restore` returns (HubDraftFields). Node tests
 * hold these rules (tests/unit/hub-drafts.test.ts).
 */
export type HubDraftField = readonly [focusKey: string, value: string];

export function createHubDrafts() {
  const drafts = new Map<string, Readonly<{ initial: string; value: string }>>();
  const initials = new Map<string, string>();
  let page: string | null = null;
  const keyOf = (path: string, field: string) => `${path} › ${field}`;
  return {
    /** A form page mounted with these stored values: the drafts to write over them. */
    restore(path: string, fields: Iterable<HubDraftField>): HubDraftField[] {
      page = path; initials.clear();
      const restored: HubDraftField[] = [];
      for (const [field, value] of fields) {
        const key = keyOf(path, field), draft = drafts.get(key);
        initials.set(key, value);
        if (draft && draft.initial !== value) drafts.delete(key);
        else if (draft) restored.push([field, draft.value]);
      }
      return restored;
    },
    /** The form page leaves: a field that differs from where it started is kept. */
    keep(read: () => Iterable<HubDraftField>) {
      if (page === null) return;
      for (const [field, value] of read()) {
        const key = keyOf(page, field), initial = initials.get(key) ?? value;
        if (value === initial) drafts.delete(key); else drafts.set(key, { initial, value });
      }
      page = null;
    },
  };
}
