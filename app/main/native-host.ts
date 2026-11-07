/**
 * Finding and loading gwonmac's one native macOS host addon.
 *
 * A packaged build resolves it inside `app.asar.unpacked` because a `.node`
 * binary cannot load from within an archive. The boundary is shape-checked so
 * a stale or mismatched addon fails before it can own secrets or native input.
 *
 * The host also reports macOS Command-held key releases that AppKit consumes
 * before Chromium sees them. The focused game window receives one physical-key
 * release through the existing renderer command boundary.
 */
import { createRequire } from "node:module";
import { physicalCodeForMacKeyCode } from "./core/macos-key-code.js";
import type { NativeKeychain } from "./core/native-keychain.js";
import { unpackedPath, type BundleLayout } from "./core/paths.js";

export interface NativeHost extends NativeKeychain {
  /**
   * Observe app-local key releases owned by a Command chord. Returning true
   * consumes that release only while Command remains down, after the renderer
   * owns its replacement.
   */
  monitorCommandKeyUps(handler: (keyCode: number) => boolean): () => void;
}

export type NativeHostLayout = BundleLayout;

export function nativeHostPath(layout: NativeHostLayout): string {
  return unpackedPath(layout, "build/native/host.node");
}

function isNativeHost(value: unknown): value is NativeHost {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Record<keyof NativeHost, unknown>>;
  return (
    typeof candidate.load === "function" &&
    typeof candidate.save === "function" &&
    typeof candidate.clear === "function" &&
    typeof candidate.monitorCommandKeyUps === "function"
  );
}

export function loadNativeHost(layout: NativeHostLayout): NativeHost {
  const loaded: unknown = createRequire(import.meta.url)(nativeHostPath(layout));
  if (!isNativeHost(loaded)) {
    throw new TypeError("native host module has an invalid shape");
  }
  return loaded;
}

export interface MacosCommandKeyUpRouting<T> {
  focusedGameTarget(): T | null;
  release(target: T, code: string): void;
}

export function installMacosCommandKeyUps<T>(
  nativeHost: Pick<NativeHost, "monitorCommandKeyUps">,
  routing: MacosCommandKeyUpRouting<T>,
): () => void {
  return nativeHost.monitorCommandKeyUps((keyCode) => {
    const code = physicalCodeForMacKeyCode(keyCode);
    if (!code) return false;
    const target = routing.focusedGameTarget();
    if (!target) return false;
    routing.release(target, code);
    return true;
  });
}
