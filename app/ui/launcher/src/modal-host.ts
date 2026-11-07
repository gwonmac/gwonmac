/**
 * Owns where a launcher modal is drawn. In the launcher a modal goes on <body>,
 * which carries the launcher tokens. The game document does not, so the Hub's
 * Settings page provides a host inside .settings-view, where they apply.
 */
import type { InjectionKey, Ref } from "vue";

export const MODAL_HOST: InjectionKey<Readonly<Ref<HTMLElement | null>>> = Symbol("modal host");
