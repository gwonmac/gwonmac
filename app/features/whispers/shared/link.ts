/**
 * Owns the link Whispers offers other Features (its manifest `offers`). Whispers owns the
 * conversation; a caller only names the person.
 */
export type WhispersLink = Readonly<{
  /** Opens a conversation with `name` and shows the panel; "unavailable" while Guild Wars chat is not ready. */
  open(name: string): "opened" | "unavailable";
}>;
