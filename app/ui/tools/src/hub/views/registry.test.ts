/**
 * The page registry is complete: every page HubPageProps declares has a component in some page
 * folder, and no folder names a page HubPageProps does not declare. The folders are collected at
 * build time, so the type checker cannot see them; this list is total by type instead.
 */
import { expect, test } from 'vitest';
import type { HubPageProps } from '../../../../../shared/ui/hub-pages';
import { HUB_PAGE_NAMES } from '.';

const DECLARED = {
  confirm: true, phraseForm: true, preferences: true, rates: true, priceDetails: true,
  buildDetails: true, leaveArea: true, settingsHost: true, characters: true,
} as const satisfies Record<keyof HubPageProps, true>;

test('every declared Hub page has a component, and every component a declaration', () => {
  expect([...HUB_PAGE_NAMES].sort()).toEqual(Object.keys(DECLARED).sort());
});
