// Architecture policy, executed rather than asserted about: run the
// repository's real ESLint config over source that crosses each boundary
// eslint.config.js pins, and check the crossing is actually rejected. Every
// probe spells the crossing a different way, because one file has more than one
// name: `../paths.js`, `../../main/paths.js` and `../../../app/main/paths.js`
// all resolve to app/main/paths.ts.
//
// Every boundary is executed, including the nine website `.vue` SFCs:
// vue-eslint-parser lets the rule run on them rather than a weaker
// text scan standing in for it.
//
// The only override is turning off typescript-eslint's project service, which
// otherwise refuses a path that has no file behind it. The boundary rules
// (no-restricted-imports, no-restricted-syntax) are purely syntactic, so
// nothing under test depends on type information — and this keeps the test from
// writing throwaway files into app/.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const eslint = new ESLint({
  cwd: root,
  overrideConfig: [
    {
      files: ["**/*.ts"],
      languageOptions: { parserOptions: { projectService: false, project: false } },
    },
  ],
});

const BOUNDARY_RULES = new Set(["no-restricted-imports", "no-restricted-syntax"]);

const REJECTED = [
  {
    what: "app/main/core imports electron",
    file: "app/main/core/probe.ts",
    source: 'import { app } from "electron";\nexport const probe = app;\n',
  },
  {
    what: "app/main/core type-imports electron",
    file: "app/main/core/probe.ts",
    source: 'import type { App } from "electron";\nexport type Probe = App;\n',
  },
  {
    what: "app/main/core dynamically imports electron",
    file: "app/main/core/probe.ts",
    source: 'export const probe = async () => import("electron");\n',
  },
  {
    what: "app/main/core imports a submodule of electron",
    file: "app/main/core/probe.ts",
    source: 'import { app } from "electron/main";\nexport const probe = app;\n',
  },
  {
    what: "app/main/core requires electron through createRequire",
    file: "app/main/core/probe.ts",
    source:
      'import { createRequire } from "node:module";\nexport const probe = createRequire(import.meta.url)("electron");\n',
  },
  {
    what: "app/main/core requires electron through an aliased createRequire binding",
    // The rule used to key on the callee, so `createRequire(url)("electron")`
    // and the binding literally named `require` were rejected while any other
    // name for the same function was not.
    file: "app/main/core/probe.ts",
    source:
      'import { createRequire } from "node:module";\nconst load = createRequire(import.meta.url);\nexport const probe = load("electron");\n',
  },
  {
    what: "app/main/core dynamically imports electron, spelled with a template literal",
    file: "app/main/core/probe.ts",
    source: "export const probe = async () => import(`electron`);\n",
  },
  {
    what: "app/main/core imports upward from app/main",
    file: "app/main/core/probe.ts",
    source:
      'import { userDataDir } from "../paths.js";\nexport const probe = userDataDir;\n',
  },
  {
    what: "app/main/core imports upward from app/main, spelled through app/main",
    file: "app/main/core/probe.ts",
    source:
      'import { userDataDir } from "../../main/paths.js";\nexport const probe = userDataDir;\n',
  },
  {
    what: "app/main/core imports upward from app/main, spelled from the repository root",
    file: "app/main/core/probe.ts",
    source:
      'import { userDataDir } from "../../../app/main/paths.js";\nexport const probe = userDataDir;\n',
  },
  {
    what: "a subdirectory of app/main/core imports upward from app/main",
    file: "app/main/core/sub/probe.ts",
    source:
      'import { userDataDir } from "../../paths.js";\nexport const probe = userDataDir;\n',
  },
  {
    what: "app/main/core imports upward through a subdirectory of app/main",
    // app/main has no subdirectory but core today. The rule pins "does not
    // climb out of core", not "does not name one of today's files", so the day
    // app/main/services/ appears this must already be rejected.
    file: "app/main/core/probe.ts",
    source:
      'import { registry } from "../services/registry.js";\nexport const probe = registry;\n',
  },
  {
    what: "app/main/core dynamically imports upward from app/main",
    file: "app/main/core/probe.ts",
    source: 'export const probe = async () => import("../paths.js");\n',
  },
  {
    what: "app/main/core dynamically imports upward through a subdirectory of app/main",
    file: "app/main/core/probe.ts",
    source: 'export const probe = async () => import("../services/registry.js");\n',
  },
  {
    what: "app/main/core dynamically imports upward, spelled through app/main",
    file: "app/main/core/probe.ts",
    source: 'export const probe = async () => import("../../main/paths.js");\n',
  },
  {
    what: "app/main/core dynamically imports upward, spelled with a template literal",
    file: "app/main/core/probe.ts",
    source: "export const probe = async () => import(`../paths.js`);\n",
  },
  {
    what: "app/main/core requires upward through createRequire",
    // The require-flavoured selectors were wired to the Electron pattern only,
    // so this crossing was reported by nothing but an unrelated stylistic rule.
    file: "app/main/core/probe.ts",
    source:
      'import { createRequire } from "node:module";\nexport const probe = createRequire(import.meta.url)("../paths.js");\n',
  },
  {
    what: "app/main/core imports one level up into a sibling of app/main/core named shared",
    // app/shared is `../../shared/` from core and deeper from its
    // subdirectories. A single `../shared/` is app/main/shared — upward.
    file: "app/main/core/probe.ts",
    source: 'import { log } from "../shared/log.js";\nexport const probe = log;\n',
  },
  {
    // The proof runs in a utilityProcess, which resolves no `electron` module.
    // While it lived in app/main/core/** the directory rule said so; here only
    // the two named Electron callers are exempt.
    what: "app/client/certification imports electron",
    file: "app/client/certification/probe.ts",
    source: 'import { app } from "electron";\nexport const probe = app;\n',
  },
  {
    what: "app/client/certification dynamically imports electron",
    file: "app/client/certification/probe.ts",
    source: 'export const probe = async () => import("electron");\n',
  },
  {
    // Banning the `electron` specifier alone leaves every file in app/main that
    // imports it one `../` away, and the utilityProcess graph would break at
    // runtime rather than at lint.
    what: "app/client/certification imports upward from app/main",
    file: "app/client/certification/probe.ts",
    source:
      'import { createWindow } from "../window.js";\nexport const probe = createWindow;\n',
  },
  {
    what: "app/client/certification imports upward from app/main, spelled through app/main",
    file: "app/client/certification/probe.ts",
    source:
      'import { createWindow } from "../../main/window.js";\nexport const probe = createWindow;\n',
  },
  {
    what: "app/client/certification imports upward from app/main, spelled from the repository root",
    file: "app/client/certification/probe.ts",
    source:
      'import { createWindow } from "../../../app/main/window.js";\nexport const probe = createWindow;\n',
  },
  {
    what: "app/client/certification dynamically imports upward from app/main",
    file: "app/client/certification/probe.ts",
    source: 'export const probe = async () => import("../ipc.js");\n',
  },
  {
    what: "app/client/certification dynamically imports upward, spelled with a template literal",
    file: "app/client/certification/probe.ts",
    source: "export const probe = async () => import(`../ipc.js`);\n",
  },
  {
    what: "app/client/certification imports one level up into a sibling of app/client/certification named shared",
    file: "app/client/certification/probe.ts",
    source: 'import { log } from "../shared/log.js";\nexport const probe = log;\n',
  },
  {
    // The two exempt files are the chain's outside. A sibling specifier climbs
    // out of nothing, so only naming them keeps them off the proof's graph.
    what: "app/client/certification imports the exempt verifier host",
    file: "app/client/certification/probe.ts",
    source:
      'import { verifyLocally } from "./local-client-verifier-host.js";\nexport const probe = verifyLocally;\n',
  },
  {
    what: "app/client/certification imports the exempt enhancement policy",
    file: "app/client/certification/probe.ts",
    source:
      'import { enhancementPolicy } from "./enhancement-policy.js";\nexport const probe = enhancementPolicy;\n',
  },
  {
    what: "app/client/certification dynamically imports the exempt enhancement policy",
    file: "app/client/certification/probe.ts",
    source: 'export const probe = async () => import("./enhancement-policy.js");\n',
  },
  {
    what: "app/renderer imports app/main",
    file: "app/renderer/probe.js",
    source:
      'import { userDataDir } from "../main/paths.js";\nexport const probe = userDataDir;\n',
  },
  {
    what: "a subdirectory of app/renderer imports app/main",
    file: "app/renderer/sub/probe.js",
    source:
      'import { userDataDir } from "../../main/paths.js";\nexport const probe = userDataDir;\n',
  },
  {
    what: "a app/renderer TypeScript declaration imports app/main",
    file: "app/renderer/probe.d.ts",
    source: 'import type { UserDataDir } from "../main/paths.js";\nexport type Probe = UserDataDir;\n',
  },
  {
    what: "a app/renderer module imports app/main",
    file: "app/renderer/probe.mjs",
    source:
      'import { userDataDir } from "../main/paths.js";\nexport const probe = userDataDir;\n',
  },
  {
    what: "app/renderer dynamically imports app/main",
    file: "app/renderer/probe.js",
    source: 'export const probe = async () => import("../main/paths.js");\n',
  },
  {
    what: "app/renderer dynamically imports app/main, spelled with a template literal",
    file: "app/renderer/probe.js",
    source: "export const probe = async () => import(`../main/paths.js`);\n",
  },
  {
    what: "app/renderer requires app/main through createRequire",
    file: "app/renderer/probe.js",
    source:
      'import { createRequire } from "node:module";\nexport const probe = createRequire(import.meta.url)("../main/paths.js");\n',
  },
  {
    what: "an website .vue SFC imports app/main",
    file: "website/app/pages/probe.vue",
    source:
      '<script setup lang="ts">\nimport { userDataDir } from "../../../app/main/paths";\nconst probe = userDataDir;\n</script>\n<template><div>{{ probe }}</div></template>\n',
  },
  {
    what: "an website .vue SFC dynamically imports app/renderer",
    file: "website/app/pages/probe.vue",
    source:
      '<script setup lang="ts">\nconst probe = () => import("../../../app/renderer/harness.js");\n</script>\n<template><div @click="probe" /></template>\n',
  },
  {
    what: "website imports app/main",
    file: "website/app/probe.ts",
    source:
      'import { userDataDir } from "../../../app/main/paths";\nexport const probe = userDataDir;\n',
  },
  {
    what: "website dynamically imports app/main",
    file: "website/app/probe.ts",
    source: 'export const probe = async () => import("../../../app/main/paths");\n',
  },
  {
    what: "website dynamically imports app/main, spelled with a template literal",
    file: "website/app/probe.ts",
    source: "export const probe = async () => import(`../../../app/main/paths`);\n",
  },
  {
    what: "website requires app/main through createRequire",
    file: "website/app/probe.ts",
    source:
      'import { createRequire } from "node:module";\nexport const probe = createRequire(import.meta.url)("../../../app/main/paths");\n',
  },
  {
    what: "website imports developer tooling under app/tools-cli",
    // "only app/shared" is the boundary; main, renderer and preload were the
    // only names spelled out, so app/tools-cli/** crossed it with lint green.
    file: "website/app/probe.ts",
    source:
      'import { validate } from "../../../app/tools-cli/diagnostics/validate";\nexport const probe = validate;\n',
  },
  {
    what: "an website .vue SFC imports developer tooling under app/tools-cli",
    file: "website/app/pages/probe.vue",
    source:
      '<script setup lang="ts">\nimport { validate } from "../../../app/tools-cli/diagnostics/validate";\nconst probe = validate;\n</script>\n<template><div>{{ probe }}</div></template>\n',
  },
];

const ALLOWED = [
  {
    what: "app/main/core imports app/shared",
    file: "app/main/core/probe.ts",
    source: 'import { IPC } from "../../shared/contracts.js";\nexport const probe = IPC;\n',
  },
  {
    what: "app/main/core imports a sibling",
    file: "app/main/core/probe.ts",
    source: 'import { parseManifest } from "./manifest.js";\nexport const probe = parseManifest;\n',
  },
  {
    what: "app/main/core dynamically imports a sibling",
    file: "app/main/core/probe.ts",
    source: 'export const probe = async () => import("./manifest.js");\n',
  },
  {
    what: "a subdirectory of app/main/core imports app/shared",
    file: "app/main/core/sub/probe.ts",
    source: 'import { IPC } from "../../../shared/contracts.js";\nexport const probe = IPC;\n',
  },
  {
    what: "app/main/core requires a node builtin through createRequire",
    file: "app/main/core/probe.ts",
    source:
      'import { createRequire } from "node:module";\nexport const probe = createRequire(import.meta.url)("node:fs");\n',
  },
  {
    what: "app/main imports electron",
    file: "app/main/probe.ts",
    source: 'import { app } from "electron";\nexport const probe = app;\n',
  },
  {
    what: "the certification host imports electron",
    file: "app/client/certification/local-client-verifier-host.ts",
    source:
      'import { utilityProcess } from "electron";\nexport const probe = utilityProcess;\n',
  },
  {
    what: "app/client/certification imports the codec that stayed in app/main/core",
    file: "app/client/certification/probe.ts",
    source:
      'import { splitSections } from "../../main/core/wasm-binary.js";\nexport const probe = splitSections;\n',
  },
  {
    what: "app/client/certification imports app/shared",
    file: "app/client/certification/probe.ts",
    source: 'import { IPC } from "../../shared/contracts.js";\nexport const probe = IPC;\n',
  },
  {
    what: "app/client/certification imports a sibling that is not an Electron caller",
    file: "app/client/certification/probe.ts",
    source:
      'import { findEnhancementBuild } from "./enhancement-builds.js";\nexport const probe = findEnhancementBuild;\n',
  },
  {
    what: "app/renderer imports app/shared",
    file: "app/renderer/probe.js",
    source: 'import { IPC } from "../shared/contracts.js";\nexport const probe = IPC;\n',
  },
  {
    what: "an website .vue SFC imports app/shared",
    file: "website/app/pages/probe.vue",
    source:
      '<script setup lang="ts">\nimport { EXTERNAL_URLS } from "../../../app/shared/contracts";\nconst probe = EXTERNAL_URLS;\n</script>\n<template><div>{{ probe }}</div></template>\n',
  },
  {
    what: "website imports app/shared",
    file: "website/app/probe.ts",
    source:
      'import { EXTERNAL_URLS } from "../../../app/shared/contracts";\nexport const probe = EXTERNAL_URLS;\n',
  },
];

async function lint(probe: { file: string; source: string }): Promise<string[]> {
  const [result] = await eslint.lintText(probe.source, {
    filePath: path.join(root, probe.file),
  });
  assert.ok(result, `ESLint reported nothing at all for ${probe.file}`);
  return result.messages.map(
    (message) => message.ruleId ?? `fatal: ${message.message}`,
  );
}

for (const probe of REJECTED) {
  test(`lint rejects: ${probe.what}`, async () => {
    const fired = await lint(probe);
    assert.ok(
      fired.some((ruleId) => BOUNDARY_RULES.has(ruleId)),
      `expected a boundary rule to fire, got ${JSON.stringify(fired)}`,
    );
  });
}

for (const probe of ALLOWED) {
  test(`lint allows: ${probe.what}`, async () => {
    assert.deepEqual(await lint(probe), []);
  });
}

test("the .vue sources this boundary covers still exist", () => {
  // If the website ever stops using SFCs, the probes above would pass while
  // proving nothing about any real file.
  const sfcs = execFileSync("git", ["ls-files", "--", "website/**/*.vue"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);

  assert.ok(sfcs.length > 0, "expected the website to still have .vue sources");
});
