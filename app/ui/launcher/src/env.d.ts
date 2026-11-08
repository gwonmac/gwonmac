/// <reference types="vite/client" />
import type { LauncherNativeApi } from "@shared/launcher-contracts";

declare global {
  interface Window {
    launcherNative?: LauncherNativeApi;
  }
  /**
   * `container: "nearest"` scrolls only the nearest scroll container (Chromium 140+; Electron's is
   * newer), so a Settings scroll never moves the Hub panel around the page. TypeScript 5.9's DOM
   * types do not list it yet.
   */
  interface ScrollIntoViewOptions {
    container?: "all" | "nearest";
  }
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}

export {};
