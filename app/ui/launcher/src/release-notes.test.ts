import { describe, expect, it } from "vitest";
import { version } from "../../../../package.json";
import { releaseNotesFor } from "./release-notes";

describe("release notes", () => {
  it("bundles a release post for the version this app ships as", () => {
    // Without it, players who update see no "What's new". See docs/releasing.md.
    expect(releaseNotesFor(version)?.title).toBe(`GWonMac ${version}`);
  });
});
