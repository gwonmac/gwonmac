/**
 * Owns how a Settings select's value becomes a setting value: it is looked up in
 * the values the select offers, so no select casts its value, and a value none of
 * them matches is not saved.
 */
export function saveChoice<T extends string | number>(event: Event, values: readonly T[], save: (value: T) => unknown): void {
  const select = event.currentTarget;
  const value = select instanceof HTMLSelectElement ? values.find((each) => String(each) === select.value) : undefined;
  if (value !== undefined) void save(value);
}
