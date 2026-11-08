import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
} from "@playwright/test";

const fixture = fileURLToPath(
  new URL("./fixtures/local-verifier-app", import.meta.url),
);
const electronPath = path.resolve(
  "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
);

test("proves an unknown exact build in one isolated pass", { tag: "@journey" }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gw-local-verifier-"));
  const wasmPath = path.join(root, "Gw.jspi.wasm");
  const jsPath = path.join(root, "Gw.jspi.js");
  // The smallest valid module has none of the certified shapes. That is useful:
  // the IPC path must return a safe negative decision rather than crash.
  const wasm = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0);
  const js = "var getHeapMax = () => 2147483648;";
  const digest = (value: Uint8Array | string) =>
    createHash("sha256").update(value).digest("hex");
  await Promise.all([writeFile(wasmPath, wasm), writeFile(jsPath, js)]);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && entry[0] !== "ELECTRON_RUN_AS_NODE",
    ),
  );

  const run = async (wasmSha256: string) => {
    const application = await electron.launch({
      cwd: path.resolve("."),
      args: [fixture, wasmPath, wasmSha256, jsPath, digest(js)],
      executablePath: electronPath,
      env,
    });
    try {
      await expect.poll(() => completed(application), { timeout: 20_000 }).toBe(true);
      return await outcome(application);
    } finally {
      await application.close();
    }
  };

  try {
    const sha256 = digest(wasm);
    const refusal = {
      officialSha256: sha256,
      fileVerdict: {
        status: "refused",
        inputSha256: sha256,
        reason: "template-shape-changed",
      },
      templateSaveBuild: null,
      enhancementBuild: null,
      reasons: ["enhancement-layout-changed"],
    };
    const first = await run(sha256);
    // The requested launch arrives first; the complete pass holds both, and no
    // later stage (friends, Cartography, double-click, 4 GB) proved anything.
    expect(first).toMatchObject({
      requested: { launches: [{ cartography: true, verification: refusal }] },
      complete: {
        launches: [
          { cartography: true, verification: refusal },
          { cartography: false, verification: refusal },
        ],
        friendObserver: [],
        cartography: [],
        nativeDoubleClick: [],
        extendedMemory: [],
      },
    });

    // The pass re-reads the bytes: a hash that no longer matches them gets no
    // answer, which callers report as a failed check.
    await writeFile(wasmPath, Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 1));
    expect(await run(sha256)).toEqual({ requested: null, complete: null });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function completed(application: ElectronApplication): Promise<boolean> {
  return application.evaluate(
    () => Boolean(
      (
        globalThis as typeof globalThis & {
          localVerifierCompleted?: boolean;
        }
      ).localVerifierCompleted,
    ),
  );
}

function outcome(application: ElectronApplication): Promise<unknown> {
  return application.evaluate(
    () => (
      globalThis as typeof globalThis & {
        localVerifierOutcome?: unknown;
      }
    ).localVerifierOutcome ?? null,
  );
}
