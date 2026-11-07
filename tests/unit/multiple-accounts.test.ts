/** The account-mode documents preserve Single and reject ambiguous profiles. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  addMultiProfile,
  archiveMultiProfile,
  beginArchivedProfileDeletion,
  createMultiWorkspace,
  loadAccountMode,
  loadMultiWorkspace,
  quarantineAccountDocument,
  removeArchivedMultiProfile,
  restoreMultiProfile,
  saveMultiWorkspace,
  updateMultiProfile,
} from "../../app/main/core/multiple-accounts.js";
import {
  LEGACY_PRIMARY_PROFILE_ID,
  parseMultiWorkspace,
  parseProfileId,
  profileNameKey,
} from "../../app/shared/multiple-accounts.js";
import { AppError } from "../../app/shared/errors.js";

const ID = "2d31e565-9fc8-4dde-9fd4-9d644f8283ae";

describe("Multiple Accounts documents", () => {
  it("preserves an adopted account name and refuses ambiguous ownership", () => {
    const workspace = {
      ...addMultiProfile(createMultiWorkspace(), { id: ID, name: "Heroes", templates: "shared", builds: "private" }),
      legacyPrimaryProfileId: LEGACY_PRIMARY_PROFILE_ID,
      legacyPrimaryProfileName: "Main",
    };
    assert.deepEqual(parseMultiWorkspace(workspace), workspace);
    assert.throws(() => parseMultiWorkspace({ ...workspace, legacyPrimaryProfileName: "heroes" }));
    assert.throws(() => parseMultiWorkspace({ ...workspace, legacyPrimaryProfileId: null }));
  });

  it("keeps a missing mode and workspace on the legacy Single path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-accounts-"));
    assert.equal(await loadAccountMode(join(dir, "launcher-mode.json")), "single");
    assert.equal(await loadMultiWorkspace(join(dir, "workspace.json")), null);
  });

  it("reads a released Multi mode document beside a published workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-accounts-"));
    const workspacePath = join(dir, "multi", "workspace.json");
    const modePath = join(dir, "launcher-mode.json");
    const workspace = addMultiProfile(createMultiWorkspace(), {
      id: ID,
      name: "Main",
      templates: "shared",
      builds: "private",
    });
    await saveMultiWorkspace(workspacePath, workspace);
    assert.equal(await loadAccountMode(modePath), "single");
    await writeFile(modePath, JSON.stringify({ formatVersion: 1, mode: "multi" }));
    assert.equal(await loadAccountMode(modePath), "multi");
    assert.deepEqual(await loadMultiWorkspace(workspacePath), workspace);
  });

  it("fails closed for corrupt or future documents", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-accounts-"));
    const modePath = join(dir, "launcher-mode.json");
    const workspacePath = join(dir, "workspace.json");
    await writeFile(modePath, "{broken");
    await assert.rejects(loadAccountMode(modePath), AppError);
    await writeFile(modePath, JSON.stringify({ formatVersion: 2, mode: "single" }));
    await assert.rejects(loadAccountMode(modePath), AppError);
    await writeFile(workspacePath, JSON.stringify({ formatVersion: 2, profiles: [] }));
    await assert.rejects(loadMultiWorkspace(workspacePath), AppError);
  });

  it("quarantines a damaged document without rewriting its bytes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-accounts-"));
    const workspacePath = join(dir, "workspace.json");
    await writeFile(workspacePath, "{damaged");
    const backup = await quarantineAccountDocument(workspacePath);
    assert.ok(backup);
    assert.equal(await readFile(backup, "utf8"), "{damaged");
    assert.equal(await loadMultiWorkspace(workspacePath), null);
  });

  it("accepts only lowercase UUID v4 identifiers", () => {
    assert.equal(parseProfileId(ID), ID);
    assert.throws(() => parseProfileId("../single"), AppError);
    assert.throws(() => parseProfileId(ID.toUpperCase()), AppError);
    assert.throws(
      () => parseProfileId("2d31e565-9fc8-3dde-9fd4-9d644f8283ae"),
      AppError,
    );
  });

  it("rejects duplicate labels after normalization and case folding", () => {
    assert.equal(profileNameKey("  MAIN  "), "main");
    assert.throws(
      () => parseMultiWorkspace({
        formatVersion: 1,
        deletingProfileIds: [],
        profiles: [
          { id: ID, name: "Main", archived: false, templates: "shared", builds: "shared" },
          {
            id: "6038c349-435a-4483-933f-0a792563a370",
            name: "  main ",
            archived: false,
            templates: "private",
            builds: "private",
          },
        ],
      }),
      AppError,
    );
  });

  it("accepts an empty onboarding workspace but rejects an all-archived workspace", () => {
    assert.deepEqual(createMultiWorkspace(), {
      formatVersion: 1,
      profiles: [],
      deletingProfileIds: [],
    });
    assert.throws(
      () => parseMultiWorkspace({
        formatVersion: 1,
        deletingProfileIds: [],
        profiles: [{
          id: ID,
          name: "Main",
          archived: true,
          templates: "shared",
          builds: "private",
        }],
      }),
      AppError,
    );
  });

  it("requires valid binary sharing choices", () => {
    assert.throws(
      () => addMultiProfile(createMultiWorkspace(), {
        id: ID,
        name: "Main",
        templates: "linked" as never,
        builds: "private",
      }),
      AppError,
    );
  });

  it("accepts the additive rollback-safe legacy marker", () => {
    assert.deepEqual(parseMultiWorkspace({
      formatVersion: 1,
      profiles: [],
      deletingProfileIds: [],
      legacyPrimaryProfileId: LEGACY_PRIMARY_PROFILE_ID,
      ignoredByCandidateAndStable: true,
    }), {
      formatVersion: 1,
      profiles: [],
      deletingProfileIds: [],
      legacyPrimaryProfileId: LEGACY_PRIMARY_PROFILE_ID,
    });
    assert.throws(() => parseMultiWorkspace({
      formatVersion: 1,
      profiles: [],
      deletingProfileIds: [],
      legacyPrimaryProfileId: ID,
    }), AppError);
  });

  it("never archives Main account, the first active account in the list", () => {
    const one = parseProfileId("00000000-0000-4000-8000-000000000001");
    const two = parseProfileId("00000000-0000-4000-8000-000000000002");
    const three = parseProfileId("00000000-0000-4000-8000-000000000003");
    const fresh = [one, two, three].reduce((workspace, id) => addMultiProfile(workspace, { id, name: `Account ${id.at(-1)}`, templates: "private", builds: "private" }), createMultiWorkspace());
    const firstArchived = parseMultiWorkspace({ ...fresh, profiles: fresh.profiles.map((candidate) => candidate.id === one ? { ...candidate, archived: true } : candidate) });
    const adopted = { ...fresh, legacyPrimaryProfileId: LEGACY_PRIMARY_PROFILE_ID };
    const cases = [
      ["fresh install, first account", fresh, one, false],
      ["fresh install, later account", fresh, two, true],
      ["first account archived, next one is Main", firstArchived, two, false],
      ["first account archived, later account", firstArchived, three, true],
      ["adopted Main account", adopted, LEGACY_PRIMARY_PROFILE_ID, false],
      ["adopted install, first listed profile", adopted, one, true],
    ] as const;
    for (const [label, workspace, id, allowed] of cases) {
      if (allowed) assert.equal(archiveMultiProfile(workspace, id).profiles.find((candidate) => candidate.id === id)?.archived, true, label);
      else assert.throws(() => archiveMultiProfile(workspace, id), /Main account cannot be archived/u, label);
    }
  });

  it("adds, updates, and archives profiles without changing stable IDs", () => {
    const first = addMultiProfile(createMultiWorkspace(), {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Primary",
      templates: "private",
      builds: "private",
    });
    const added = addMultiProfile(first, {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Storage",
      templates: "shared",
      builds: "shared",
    });
    const updated = updateMultiProfile(added, added.profiles[1]!.id, {
      name: "Storage Alt",
      templates: "private",
      builds: "shared",
    });
    const archived = archiveMultiProfile(updated, updated.profiles[1]!.id);
    assert.equal(archived.profiles[0]!.name, "Primary");
    assert.equal(archived.profiles[1]!.id, added.profiles[1]!.id);
    assert.equal(archived.profiles[1]!.name, "Storage Alt");
    assert.equal(archived.profiles[1]!.archived, true);
    const restored = restoreMultiProfile(archived, archived.profiles[1]!.id);
    assert.equal(restored.profiles[1]!.archived, false);
    const archivedAgain = archiveMultiProfile(restored, restored.profiles[1]!.id);
    const pending = beginArchivedProfileDeletion(
      archivedAgain,
      archivedAgain.profiles[1]!.id,
    );
    assert.deepEqual(pending.deletingProfileIds, [archivedAgain.profiles[1]!.id]);
    const removed = removeArchivedMultiProfile(
      pending,
      pending.profiles[1]!.id,
    );
    assert.deepEqual(removed.profiles.map((profile) => profile.name), ["Primary"]);
    assert.deepEqual(removed.deletingProfileIds, []);
  });
});
