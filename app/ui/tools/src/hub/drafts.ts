/**
 * Owns how the Hub's session drafts reach a page's form fields. Each field is named by its focus
 * key (focusKeyOf), the name the keyboard already uses for it, so a copy change to a label never
 * drops a draft. The controller keeps the drafts; the kit reads the fields and writes a kept
 * value back as an edit the page hears, so the page's own state follows the field.
 */
import type { HubDraftFields } from '../../../../shared/ui/hub-view';
import { focusKeyOf } from './focus-zone';

const FIELDS = 'form input:not([type]), form input[type=text], form input[type=search], form textarea, form select';
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function hubDraftFields(view: HTMLElement): HubDraftFields {
  const fields = () => [...view.querySelectorAll<Field>(FIELDS)].flatMap(field => { const key = focusKeyOf(field); return key ? [[key, field] as const] : []; });
  return {
    read: () => fields().map(([key, field]) => [key, field.value] as const),
    write(key, value) {
      const field = fields().find(([candidate]) => candidate === key)?.[1];
      if (!field) return;
      field.value = value;
      field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    },
  };
}
