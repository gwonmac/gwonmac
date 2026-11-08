import { app, BrowserWindow } from "electron";

// `pnpm typecheck` runs on a checkout with no build/ (the CI check job). Resolve
// the compiled host at runtime so this fixture exercises the shipped entry
// without making generated output a typecheck prerequisite.
const hostUrl = new URL(
  "../../../../build/client/certification/local-client-verifier-host.js",
  import.meta.url,
);
/** @type {typeof import("../../../../app/client/certification/local-client-verifier-host.ts")} */
const verifier = await import(hostUrl.href);
/** @type {typeof import("../../../../app/shared/enhancement-contracts.ts")} */
const contracts = await import(new URL(
  "../../../../build/shared/enhancement-contracts.js", import.meta.url,
).href);

const [wasmPath, wasmSha256, jsPath, jsSha256] = process.argv.slice(-4);
if (!wasmPath || !wasmSha256 || !jsPath || !jsSha256) {
  throw new Error("local verifier fixture requires wasm, js and their hashes");
}
const profile = (/** @type {keyof typeof contracts.RELEASE_ENHANCEMENT_CAPABILITIES} */ name) => {
  const value = contracts.enhancementCapabilityProfile(
    contracts.RELEASE_ENHANCEMENT_CAPABILITIES[name],
  );
  if (!value) throw new Error(`no ${name} profile`);
  return value;
};

const state = /** @type {{
 *   localVerifierCompleted?: boolean;
 *   localVerifierOutcome?: unknown;
 * }} */ (globalThis);
state.localVerifierCompleted = false;
state.localVerifierOutcome = null;
void app.whenReady().then(async () => {
  // Both release launches, Tools first, as a launch with Tools on asks for them.
  const pass = verifier.runVerifierPass({
    wasmPath,
    wasmSha256,
    jsPath,
    jsSha256,
    launches: [
      { requestedProfile: profile("tools"), cartography: true },
      { requestedProfile: profile("core"), cartography: false },
    ],
  });
  const [requested, complete] = await Promise.all([pass.requested, pass.complete]);
  state.localVerifierOutcome = { requested, complete };
  state.localVerifierCompleted = true;
  const window = new BrowserWindow({ show: false });
  await window.loadURL("data:text/html,local-verifier-complete");
});
