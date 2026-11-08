// The two numbers macOS reads out of a release version of this app.
//
// app/shared/release.ts owns the version grammar: plain SemVer
// `MAJOR.MINOR.PATCH`, optionally `-(alpha|beta|rc).N`, with no leading
// zeroes. This file maps that onto Apple's two fields and refuses what they
// cannot hold:
//
//   CFBundleShortVersionString  the release version, without the prerelease
//   CFBundleVersion             a build number that only ever increases
//
// Apple allows 4 digits in the first component of CFBundleVersion and 2 in each
// of the other two. Every bound below is that constraint read backwards:
//
//   releaseLine  = major * 100 + minor            // 1.4 -> 104
//   buildVersion = `${releaseLine}.${patch}.${stage + sequence}`
//                  stage: alpha 0 | beta 30 | rc 60 | release 99
//
// macOS compares CFBundleVersion component by component, so the build number
// rises across a prerelease channel (alpha.1 -> beta.1 -> rc.1 -> the release),
// then across patches, then across minor and major versions.

import {
  formatReleaseVersion,
  parseReleaseVersion,
  type ReleaseChannel,
} from "../app/shared/release.js";

/**
 * Where a channel begins inside the two digits Apple allows for the last
 * component: 30 sequence numbers each, and the release itself at the top.
 */
const STAGE: Record<ReleaseChannel, number> = {
  alpha: 0,
  beta: 30,
  rc: 60,
  stable: 99,
};

export function macOSBundleVersions(version: string) {
  const parsed = parseReleaseVersion(version);
  // The grammar also admits a `v` tag prefix; package.json carries the bare
  // version, and only that canonical text names a build.
  if (!parsed || formatReleaseVersion(parsed) !== version) {
    throw new Error(
      `release version must be MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-(alpha|beta|rc).N ` +
        `with no leading zeroes, not ${JSON.stringify(version)}`,
    );
  }
  const { major, minor, patch, channel, sequence } = parsed;
  if (major < 1 || major > 99) {
    throw new Error(`release major must be 1-99, not ${major}`);
  }
  if (minor > 99) {
    throw new Error(`release minor must be 0-99, not ${minor}`);
  }
  if (patch > 99) {
    throw new Error(`release patch must be 0-99, not ${patch}`);
  }
  if (sequence > 29) {
    throw new Error(`prerelease sequence must be 0-29, not ${sequence}`);
  }
  const releaseLine = major * 100 + minor;
  const stage = STAGE[channel];
  return {
    appVersion: `${major}.${minor}.${patch}`,
    buildVersion: `${releaseLine}.${patch}.${stage + sequence}`,
  };
}
