/**
 * How one setting is declared: its default, how a stored or sent value is read,
 * and which surfaces may see or change it. Core settings (./core.ts) and every
 * feature's settings (app/features/<id>/feature.ts) use these helpers; ./index.ts
 * builds the one table, the `AppSettings` type and every derived list from them.
 *
 * This module holds no setting and imports no feature, so a feature manifest can
 * import it without forming a cycle through the table.
 */

/**
 * Which surfaces see a setting. Absent means none: the setting stays in main.
 * - `hub`: the game window's Settings page reads and changes it; the launcher
 *   draws the same page, so `hub` includes `launcher`.
 * - `launcher`: only the launcher's Settings reads and changes it.
 * - `rendererWritable`: a game renderer may write it through generic settings IPC.
 * - `tools`: the game renderer reads it through `window.gwToolsSettings()`.
 */
export type SettingScope = Readonly<{
  hub?: true;
  launcher?: true;
  rendererWritable?: true;
  tools?: true;
}>;

type SettingMessages = Readonly<{
  /** The settings-file refusal; absent uses the kind's sentence. */
  error?: string;
  /** The launcher's refusal for the same value; absent uses the kind's sentence. */
  launcherError?: string;
}>;

export type SettingOptions = SettingScope & SettingMessages & Readonly<{
  /**
   * A released key that a dormant profile may still hold for this setting. It is
   * read only when the setting's own key is absent, and never written back.
   */
  alias?: string;
}>;

export type SettingSpec<T> = SettingOptions & Readonly<{
  kind: "boolean" | "integer" | "enum" | "value";
  fallback: T;
  /** The value to store, or `undefined` when the value is not this setting's shape. */
  read(value: unknown): T | undefined;
  /** A copy of the default for a freshly parsed profile, when the default must not be shared. */
  fresh?: () => T;
  range?: Readonly<{ min: number; max: number }>;
}>;

export type SettingSpecs = Readonly<Record<string, SettingSpec<unknown>>>;
export type SettingValue<Spec> = Spec extends SettingSpec<infer T> ? T : never;

/**
 * Each helper keeps its options in the returned type, so ./index.ts can derive
 * typed key lists (`RendererWritableSetting`, `LauncherSettings`, …) from the flags.
 */
export const setting = {
  boolean: <const Options extends SettingOptions = {}>(
    fallback: boolean,
    options: Options = {} as Options,
  ): SettingSpec<boolean> & Options => ({
    ...options,
    kind: "boolean",
    fallback,
    read: (value: unknown) => typeof value === "boolean" ? value : undefined,
  }),
  /**
   * A whole number inside a closed range. The bounds are the setting's meaning,
   * not a guard: a panel below 65% opacity stops being readable over moving art.
   * Refusing out-of-range keeps every reader from deciding what a nonsense value
   * should look like.
   */
  integer: <const Options extends SettingOptions = {}>(
    fallback: number,
    range: Readonly<{ min: number; max: number }>,
    options: Options = {} as Options,
  ): SettingSpec<number> & Options => ({
    ...options,
    kind: "integer",
    fallback,
    range,
    read: (value: unknown) => typeof value === "number" && Number.isSafeInteger(value)
      && value >= range.min && value <= range.max ? value : undefined,
  }),
  enum: <const T extends string | number, const Options extends SettingOptions = {}>(
    values: readonly T[],
    fallback: NoInfer<T>,
    options: Options = {} as Options,
  ): SettingSpec<T> & Options => ({
    ...options,
    kind: "enum",
    fallback,
    read: (value: unknown) => values.includes(value as T) ? value as T : undefined,
  }),
  /**
   * Any other stored shape, read by its owner's validator; `read` returns a copy the
   * caller may keep. The stored type is `read`'s declared return type.
   */
  value: <T, const Options extends SettingOptions & Readonly<{ fresh?: () => T }> = {}>(
    fallback: NoInfer<T>,
    read: (value: unknown) => T | undefined,
    options: Options = {} as Options,
  ): SettingSpec<T> & Options => ({ ...options, kind: "value", fallback, read }),
};

/** The settings-file refusal for an invalid value of `key`. */
export function settingError(key: string, spec: SettingSpec<unknown>): string {
  if (spec.kind === "boolean") return `settings.${key} must be a boolean`;
  if (spec.kind === "integer" && spec.range) {
    return `settings.${key} must be an integer from ${spec.range.min} to ${spec.range.max}`;
  }
  return spec.error ?? `settings.${key} is invalid`;
}

/** The launcher's refusal for an invalid value of `key`. */
export function launcherSettingError(key: string, spec: SettingSpec<unknown>): string {
  if (spec.kind === "boolean") return `${key} must be a boolean`;
  return spec.launcherError ?? `${key} is invalid`;
}
