/**
 * Owns the change handler of every Settings select: the shown value goes through
 * optionFor, so no select casts its value, and a value none of the offered values
 * matches is not saved.
 */
import { optionFor } from "@shared/setting-copy";

export function saveChoice<T extends string | number>(event: Event, values: readonly T[], save: (value: T) => unknown): void {
  const select = event.currentTarget;
  const value = select instanceof HTMLSelectElement ? optionFor(values, select.value) : undefined;
  if (value !== undefined) void save(value);
}
