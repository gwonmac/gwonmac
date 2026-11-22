/**
 * Owns the lock-down every window shares: the hardened `webPreferences`, the
 * refusal of popups and webviews, optional navigation and redirect pinning,
 * and the deny-everything permission default. The game window, the launcher
 * and the Steam sign-in sheet all build from these, so a new hardening step is
 * one edit and no window can miss it. Tightening belongs here; a window that
 * needs something looser (the game window's pointer lock) layers it on top and
 * says why.
 */
import type { Session, WebContents, WebPreferences } from "electron";

export const HARDENED_WEB_PREFERENCES = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  webviewTag: false,
  spellcheck: false,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
} as const satisfies WebPreferences;

export type BlockedWebContentsAction = "popup" | "webview" | "navigation" | "redirect";

/**
 * Refuses new windows and webviews, and, when `allowNavigation` is given,
 * every top-level navigation and redirect it does not accept. `onBlocked`
 * lets each window record the refusal in its own vocabulary.
 */
export function lockDownWebContents(
  contents: WebContents,
  onBlocked: (action: BlockedWebContentsAction) => void,
  allowNavigation?: (url: string) => boolean,
): void {
  contents.setWindowOpenHandler(() => {
    onBlocked("popup");
    return { action: "deny" };
  });
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
    onBlocked("webview");
  });
  if (!allowNavigation) return;
  contents.on("will-navigate", (event, url) => {
    if (allowNavigation(url)) return;
    event.preventDefault();
    onBlocked("navigation");
  });
  contents.on("will-redirect", (event, url) => {
    if (allowNavigation(url)) return;
    event.preventDefault();
    onBlocked("redirect");
  });
}

/** No permission is granted and no permission check passes. */
export function denyAllPermissions(target: Session): void {
  target.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  target.setPermissionCheckHandler(() => false);
}
