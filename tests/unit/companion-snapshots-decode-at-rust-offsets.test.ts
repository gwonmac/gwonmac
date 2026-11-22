/**
 * The companion kernel writes each snapshot through the `repr(C)` structs in
 * `kernels/companion/abi.rs`; the renderer reads it back with literal offsets
 * in the `companion-*-snapshot.ts` decoders. Nothing generates one side from
 * the other, so this test is the link: it computes every field offset from the
 * Rust source, writes one valid publication per region by Rust field name, and
 * requires the real TypeScript decoder to return exactly those values.
 *
 * A same-size field swap, a moved offset on either side, a wrong record stride,
 * or a drifted magic, ABI or byte count fails here, in `pnpm check`, without a
 * cargo build. The computed sizes are checked against the literal size
 * assertions rustc enforces at the end of `abi.rs`, so the layout arithmetic
 * below is pinned to the compiler's.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COMPANION_ABI } from "../../app/shared/companion-abi.ts";
import { readCompanionAlcohol } from "../../app/renderer/companion-alcohol-snapshot.ts";
import { readCompanionCharacterList } from "../../app/renderer/companion-character-list-snapshot.ts";
import {
  readCompanionCursorHeader,
  readCompanionCursorPixels,
} from "../../app/renderer/companion-cursor-snapshot.ts";
import {
  readCompanionEffectIcons,
  readCompanionPlayerEffects,
} from "../../app/renderer/companion-effect-snapshot.ts";
import { readCompanionFriends } from "../../app/renderer/companion-friend-snapshot.ts";
import { readCompanionPlayRegion } from "../../app/renderer/companion-play-region-snapshot.ts";
import {
  readCompanionSkillCooldowns,
  readCompanionSkillSlots,
} from "../../app/renderer/companion-skill-snapshot.ts";
import {
  readCompanionParty,
  readCompanionSnapshot,
  readCompanionToolbox,
} from "../../app/renderer/companion-snapshot.ts";
import { createCompanionProgressReader } from "../../app/renderer/companion-progress-snapshot.ts";
import { readCompanionWhispers } from "../../app/renderer/companion-chat-snapshot.ts";

const rustSource = readFileSync(
  new URL("../../kernels/companion/abi.rs", import.meta.url),
  "utf8",
);

// ---------------------------------------------------------------------------
// repr(C) layout of the Rust wire structs

type Scalar = "u16" | "u32" | "f32";
type RustType =
  | Readonly<{ kind: "scalar"; scalar: Scalar; size: number; align: number }>
  | Readonly<{ kind: "array"; element: RustType; length: number; size: number; align: number }>
  | Readonly<{
      kind: "struct";
      name: string;
      fields: ReadonlyMap<string, Readonly<{ type: RustType; offset: number }>>;
      size: number;
      align: number;
    }>;

const SCALARS: Readonly<Record<Scalar, RustType>> = {
  u16: { kind: "scalar", scalar: "u16", size: 2, align: 2 },
  u32: { kind: "scalar", scalar: "u32", size: 4, align: 4 },
  f32: { kind: "scalar", scalar: "f32", size: 4, align: 4 },
};

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");
}

function captured(match: RegExpMatchArray | null, index: number, label: string): string {
  const value = match?.[index];
  if (value === undefined) throw new Error(`abi.rs: missing ${label}`);
  return value;
}

const alignUp = (value: number, align: number) => Math.ceil(value / align) * align;

function parseRust(source: string) {
  const clean = withoutComments(source);
  const lengths = new Map<string, number>();
  for (const match of clean.matchAll(/const ([A-Z0-9_]+): usize = (\d+);/gu)) {
    lengths.set(captured(match, 1, "usize name"), Number(captured(match, 2, "usize value")));
  }
  const bodies = new Map<string, string>();
  for (const match of clean.matchAll(
    /((?:#\[[^\]]*\]\s*)*)pub\(crate\) struct ([A-Za-z]+)\s*\{([\s\S]*?)\n\}/gu,
  )) {
    // Only `repr(C)` structs have a layout a reader can rely on.
    if (/#\[repr\(C\)\]/u.test(match[1] ?? "")) {
      bodies.set(captured(match, 2, "struct name"), captured(match, 3, "struct body"));
    }
  }
  const structs = new Map<string, RustType>();

  function typeOf(text: string): RustType {
    const trimmed = text.trim();
    if (trimmed === "u16" || trimmed === "u32" || trimmed === "f32") return SCALARS[trimmed];
    const array = trimmed.match(/^\[(.*);\s*([A-Z0-9_]+)\]$/u);
    if (array !== null) {
      const element = typeOf(captured(array, 1, "array element"));
      const count = captured(array, 2, "array length");
      const length = /^\d+$/u.test(count) ? Number(count) : lengths.get(count);
      if (length === undefined) throw new Error(`abi.rs: unknown array length ${count}`);
      return { kind: "array", element, length, size: element.size * length, align: element.align };
    }
    return structOf(trimmed);
  }

  function structOf(name: string): RustType {
    const known = structs.get(name);
    if (known !== undefined) return known;
    const body = bodies.get(name);
    if (body === undefined) throw new Error(`abi.rs: ${name} is not a repr(C) struct`);
    const fields = new Map<string, Readonly<{ type: RustType; offset: number }>>();
    let end = 0;
    let align = 1;
    for (const line of body.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
      const declaration = line.match(/^pub\(crate\) ([a-z0-9_]+): (.+),$/u);
      if (declaration === null) throw new Error(`abi.rs: unsupported field in ${name}: ${line}`);
      const type = typeOf(captured(declaration, 2, "field type"));
      const offset = alignUp(end, type.align);
      fields.set(captured(declaration, 1, "field name"), { type, offset });
      end = offset + type.size;
      align = Math.max(align, type.align);
    }
    const layout: RustType = { kind: "struct", name, fields, size: alignUp(end, align), align };
    structs.set(name, layout);
    return layout;
  }

  function u32Constant(name: string): string {
    return captured(
      clean.match(new RegExp(`const ${name}: u32 = ([^;]+);`, "u")),
      1,
      `const ${name}`,
    ).trim();
  }

  /** `size_of::<S>() as u32`, or another byte constant plus a literal. */
  function byteConstant(name: string): number {
    const expression = u32Constant(name);
    const sized = expression.match(/^size_of::<([A-Za-z]+)>\(\) as u32$/u);
    if (sized !== null) return structOf(captured(sized, 1, "sized struct")).size;
    const sum = expression.match(/^([A-Z_]+) \+ (\d+)$/u);
    if (sum !== null) {
      return byteConstant(captured(sum, 1, "byte term")) + Number(captured(sum, 2, "byte literal"));
    }
    throw new Error(`abi.rs: unsupported byte constant ${name} = ${expression}`);
  }

  return {
    structOf,
    byteConstant,
    magic: (name: string) => Number(u32Constant(name).replaceAll("_", "")),
    /** The ABI number in `(X_BYTES << 16) | abi`, refusing a mismatched size name. */
    abi(name: string, bytesName: string) {
      const expression = u32Constant(name);
      const packed = expression.match(/^\(([A-Z_]+) << 16\) \| (\d+)$/u);
      assert.equal(captured(packed, 1, `${name} size term`), bytesName, `${name} packs ${bytesName}`);
      return Number(captured(packed, 2, `${name} ABI`));
    },
    /** Every `const _: [(); N] = [(); size_of::<S>()];` rustc enforces. */
    pinnedSizes() {
      return [...clean.matchAll(/const _: \[\(\); ([\d_]+)\] = \[\(\); size_of::<([A-Za-z]+)>\(\)\];/gu)]
        .map((match) => ({
          struct: captured(match, 2, "pinned struct"),
          bytes: Number(captured(match, 1, "pinned size").replaceAll("_", "")),
        }));
    },
  };
}

function locate(root: RustType, path: string): Readonly<{ offset: number; type: RustType }> {
  let offset = 0;
  let type = root;
  for (const [, name, index] of path.matchAll(/(?:^|\.)([a-z][a-z0-9_]*)|\[(\d+)\]/gu)) {
    if (name !== undefined) {
      if (type.kind !== "struct") throw new Error(`${path}: ${name} is not inside a struct`);
      const field = type.fields.get(name);
      if (field === undefined) throw new Error(`${path}: ${type.name} has no field ${name}`);
      offset += field.offset;
      type = field.type;
    } else {
      if (type.kind !== "array") throw new Error(`${path}: [${index}] is not an array index`);
      const element = Number(index);
      if (element >= type.length) throw new Error(`${path}: index ${element} is out of bounds`);
      offset += element * type.element.size;
      type = type.element;
    }
  }
  return { offset, type };
}

// ---------------------------------------------------------------------------
// Regions: the Rust names behind each COMPANION_ABI entry

const REGIONS = {
  snapshot: { struct: "Snapshot", magic: "MAGIC", abi: "ABI_AND_SIZE", bytes: "SNAPSHOT_BYTES" },
  friends: { struct: "FriendSnapshot", prefix: "FRIEND" },
  whispers: { struct: "WhisperSnapshot", prefix: "WHISPER" },
  cursor: { struct: "CursorSnapshot", prefix: "CURSOR" },
  toolbox: { struct: "ToolboxSnapshot", prefix: "TOOLBOX" },
  party: { struct: "PartySnapshot", prefix: "PARTY" },
  skillSlots: { struct: "SkillSlotSnapshot", prefix: "SKILL_SLOT" },
  skillCooldowns: { struct: "SkillCooldownSnapshot", prefix: "SKILL_COOLDOWN" },
  playRegion: { struct: "PlayRegionSnapshot", prefix: "PLAY_REGION" },
  characterList: { struct: "CharacterListSnapshot", prefix: "CHARACTER_LIST" },
  alcohol: { struct: "AlcoholSnapshot", prefix: "ALCOHOL" },
  progress: { struct: "ProgressSnapshot", prefix: "PROGRESS" },
  playerEffects: { struct: "PlayerEffectSnapshot", prefix: "PLAYER_EFFECT" },
  effectIcons: { struct: "EffectIconSnapshot", prefix: "EFFECT_ICON" },
} as const;
type Region = keyof typeof REGIONS;

function rustRegion(region: Region, source: string) {
  const rust = parseRust(source);
  const names = REGIONS[region];
  const magic = "prefix" in names ? `${names.prefix}_MAGIC` : names.magic;
  const abi = "prefix" in names ? `${names.prefix}_ABI_AND_SIZE` : names.abi;
  const bytes = "prefix" in names ? `${names.prefix}_BYTES` : names.bytes;
  return {
    struct: names.struct,
    layout: rust.structOf(names.struct),
    magic: rust.magic(magic),
    abi: rust.abi(abi, bytes),
    bytes: rust.byteConstant(bytes),
  };
}

test("rust layout arithmetic matches every size rustc pins in abi.rs", () => {
  const rust = parseRust(rustSource);
  const pinned = rust.pinnedSizes();
  assert.ok(pinned.length >= 20, "abi.rs size assertions were found");
  for (const { struct, bytes } of pinned) {
    assert.equal(rust.structOf(struct).size, bytes, `computed repr(C) size of ${struct}`);
  }
});

test("every Rust region size, ABI and count equals COMPANION_ABI", () => {
  const rust = parseRust(rustSource);
  for (const region of Object.keys(REGIONS) as Region[]) {
    const { struct, abi, bytes } = rustRegion(region, rustSource);
    assert.equal(bytes, COMPANION_ABI[region].bytes, `${region}: ${struct} region bytes in abi.rs vs COMPANION_ABI.${region}.bytes`);
    assert.equal(abi, COMPANION_ABI[region].abi, `${region}: ${struct} ABI in abi.rs vs COMPANION_ABI.${region}.abi`);
  }
  assert.equal(rust.byteConstant("CONFIG_BYTES"), COMPANION_ABI.config.bytes, "config: Layout bytes");
  assert.equal(rust.byteConstant("WHISPER_SNAPSHOT_BYTES"), COMPANION_ABI.whispers.snapshotBytes, "whispers: snapshot bytes");

  const lengthOf = (struct: string, path: string) => {
    const { type } = locate(rust.structOf(struct), path);
    if (type.kind !== "array") throw new Error(`${struct}.${path} is not an array`);
    return type.length;
  };
  const counts: ReadonlyArray<readonly [string, number, string, string]> = [
    ["friends.slots", COMPANION_ABI.friends.slots, "FriendSnapshot", "records"],
    ["friends.nameUnits (alias)", COMPANION_ABI.friends.nameUnits, "FriendRecord", "alias"],
    ["friends.nameUnits (character)", COMPANION_ABI.friends.nameUnits, "FriendRecord", "character"],
    ["whispers.slots", COMPANION_ABI.whispers.slots, "WhisperSnapshot", "slots"],
    ["whispers.nameUnits", COMPANION_ABI.whispers.nameUnits, "WhisperSlot", "sender"],
    ["whispers.messageUnits", COMPANION_ABI.whispers.messageUnits, "WhisperSlot", "message"],
    ["travelUnlockWords", COMPANION_ABI.travelUnlockWords, "PlayRegionSnapshot", "unlocked_maps"],
    ["characterList.slots", COMPANION_ABI.characterList.slots, "CharacterListSnapshot", "records"],
    ["characterList.nameUnits", COMPANION_ABI.characterList.nameUnits, "CharacterRecord", "name"],
    ["progress.missionSets", COMPANION_ABI.progress.missionSets, "ProgressSnapshot", "missions"],
    ["progress mission words", COMPANION_ABI.travelUnlockWords, "ProgressSnapshot", "missions[0]"],
    ["progress.titles", COMPANION_ABI.progress.titles, "ProgressSnapshot", "titles"],
    ["progress.areaRows", COMPANION_ABI.progress.areaRows, "ProgressSnapshot", "areas"],
    ["progress.areaWords", COMPANION_ABI.progress.areaWords, "ProgressSnapshot", "areas[0]"],
    ["playerEffects.records", COMPANION_ABI.playerEffects.records, "PlayerEffectSnapshot", "effects"],
    ["effectIcons.records", COMPANION_ABI.effectIcons.records, "EffectIconSnapshot", "icons"],
  ];
  for (const [label, expected, struct, path] of counts) {
    assert.equal(lengthOf(struct, path), expected, `${label}: ${struct}.${path} length in abi.rs`);
  }
});

// ---------------------------------------------------------------------------
// One valid publication per region, written by Rust field name

type Value = number | string | readonly number[];

function publish(region: Region, values: Readonly<Record<string, Value>>, source: string) {
  const rust = rustRegion(region, source);
  const pointer = 64;
  const buffer = new ArrayBuffer(pointer + rust.bytes);
  const view = new DataView(buffer, pointer, rust.bytes);
  const write = (path: string, value: number) => {
    const { offset, type } = locate(rust.layout, path);
    if (type.kind !== "scalar") throw new Error(`${rust.struct}.${path} is not a scalar`);
    if (type.scalar === "f32") view.setFloat32(offset, value, true);
    else if (type.scalar === "u16") view.setUint16(offset, value, true);
    else view.setUint32(offset, value >>> 0, true);
  };
  const all: Record<string, Value> = {
    "header.magic": rust.magic,
    "header.abi_and_size": (rust.bytes << 16) | rust.abi,
    "header.sequence": 2,
    ...values,
  };
  for (const [path, value] of Object.entries(all)) {
    if (typeof value === "number") write(path, value);
    else if (typeof value === "string") [...value].forEach((unit, index) => write(`${path}[${index}]`, unit.charCodeAt(0)));
    else value.forEach((entry, index) => write(`${path}[${index}]`, entry));
  }
  return { buffer, pointer };
}

type Case = Readonly<{
  label: string;
  region: Region;
  values: Readonly<Record<string, Value>>;
  decode: (buffer: ArrayBuffer, pointer: number) => object;
  expected: Readonly<Record<string, unknown>>;
}>;

const words = (entries: Readonly<Record<number, number>>) =>
  Array.from({ length: COMPANION_ABI.travelUnlockWords }, (_, index) => entries[index] ?? 0);
const range = (from: number) => Array.from({ length: 8 }, (_, index) => from + index);
const pixels = new Uint8ClampedArray(32 * 32 * 4);
pixels.set([1, 2, 3, 4], 0);
pixels.set([5, 6, 7, 8], pixels.length - 4);
const ROW_READ = 1 << 31;
const ROW_THUMBNAIL = 1 << 30;

/*
 * Every field a decoder reads gets a value no neighbour shares, so a swap or a
 * shifted offset changes the decoded result. Arrays are written at the first
 * and last (or second) element, so a wrong stride shows too.
 */
const CASES: readonly Case[] = [
  {
    label: "game snapshot",
    region: "snapshot",
    values: {
      flags: 0b111, tick_count: 101, map_id: 102, instance_and_region: 0x101, player_id: 103,
      player_x: 1.5, player_y: 2.5, target_id: 104, target_type: 0xdb, target_x: 3.5,
      target_y: 4.5, distance: 5.5, range_band: 3,
    },
    decode: readCompanionSnapshot,
    expected: {
      status: "ready", sequence: 2, tickCount: 101, mapId: 102, instanceType: 1, playRegion: "pve",
      playerId: 103, playerX: 1.5, playerY: 2.5, targetId: 104, agentTypeBits: 0xdb,
      targetX: 3.5, targetY: 4.5, distance: 5.5, rangeBand: 3,
    },
  },
  {
    label: "toolbox",
    region: "toolbox",
    values: {
      flags: 0b11, player_chat_count: 11, cursor_event_count: 12, hero_count: 3,
      first_hero_id: 14, first_hero_agent_id: 15,
    },
    decode: readCompanionToolbox,
    expected: {
      status: "ready", sequence: 2, heroAvailable: true, partyObserved: true, playerChatCount: 11,
      cursorEventCount: 12, heroCount: 3, firstHeroId: 14, firstHeroAgentId: 15,
    },
  },
  {
    label: "party",
    region: "party",
    values: {
      flags: 0x3f, generation: 21, slot_count: 1,
      unlocked_low: 1 << 22, unlocked_high: 1 << 7,
      unlock_known_low: (1 << 22) | (1 << 5), unlock_known_high: (1 << 7) | (1 << 1),
      play_region: 1, hard_mode: 1, player_profession_probe: [5 | (6 << 8), 0x1234, 0xabc, 0b101],
      "account_professions[39]": 3 | (4 << 8),
      "slots[0].agent_id": 31, "slots[0].professions": 1 | (2 << 8), "slots[0].level": 20,
      "slots[0].flags": 0b11011, "slots[0].disabled": 0x05, "slots[0].skills": range(101),
      "slots[0].attributes": [3 | (12 << 8), 17 | (9 << 8)],
      "slots[7].hero_id": 22, "slots[7].agent_id": 32, "slots[7].professions": 7 | (8 << 8),
      "slots[7].level": 19, "slots[7].behaviour": 2, "slots[7].flags": 0b11111,
      "slots[7].disabled": 0x80, "slots[7].skills": range(201), "slots[7].attributes[8]": 44 | (1 << 8),
      account_skill_words: 2, character_skill_words: 70,
      "account_skills[1]": 1 << 3, "character_skills[0]": 1, "character_skills[69]": 1 << 31,
    },
    decode: (buffer, pointer) => {
      const party = readCompanionParty(buffer, pointer);
      return party.status === "ready"
        ? { ...party, slot0: party.slots[0], slot7: party.slots[7] }
        : party;
    },
    expected: {
      status: "ready", sequence: 2, generation: 21, rosterObserved: true, unlockObserved: true,
      playRegion: "pve", hardMode: true, inOutpost: true, slotCount: 1, unlocked: [22, 39],
      accountProfessions: [{ hero: 39, professions: [3, 4] }],
      accountSkills: { knownThrough: 64, unlocked: [35] },
      characterSkills: { knownThrough: 2240, unlocked: [0, 2239] },
      playerProfessionProbe: {
        statePrimary: 5, stateSecondary: 6, attributeIdsLow: 0x1234, attributeIdsHigh: 0xabc,
        stateRowObserved: true, stateAccepted: false, attributeRowObserved: true,
      },
      slot0: {
        index: 0, occupied: true, hero: null, agentId: 31, level: 20, professions: [1, 2],
        behaviour: null, skills: range(101), disabled: 0x05, attributes: [[3, 12], [17, 9]],
      },
      slot7: {
        index: 7, occupied: true, hero: 22, agentId: 32, level: 19, professions: [7, 8],
        behaviour: 2, skills: range(201), disabled: 0x80, attributes: [[44, 1]],
      },
    },
  },
  {
    label: "cursor",
    region: "cursor",
    values: {
      flags: 0b11, generation: 41, width: 32, height: 32, hotspot_x: 5, hotspot_y: 6,
      pixel_hash: 0xdeadbeef, "pixels[0]": 0x04030201, "pixels[1023]": 0x08070605,
    },
    decode: (buffer, pointer) => ({
      header: readCompanionCursorHeader(buffer, pointer),
      pixels: readCompanionCursorPixels(buffer, pointer)?.pixels,
    }),
    expected: {
      header: {
        status: "ready", generation: 41, flags: 0b11, hotspotX: 5, hotspotY: 6,
        pixelHash: 0xdeadbeef, hidden: true,
      },
      pixels,
    },
  },
  {
    label: "skill slots",
    region: "skillSlots",
    values: {
      flags: 1, frame_id: 51, viewport_width: 1000, viewport_height: 800,
      ...Object.fromEntries(range(0).flatMap((index) => [
        [`slots[${index}].left`, 10 + index * 20], [`slots[${index}].bottom`, 5 + index],
        [`slots[${index}].right`, 20 + index * 20], [`slots[${index}].top`, 30 + index],
      ])),
    },
    decode: readCompanionSkillSlots,
    expected: {
      status: "ready", sequence: 2, frameId: 51, viewportWidth: 1000, viewportHeight: 800,
      slots: range(0).map((index) => ({
        left: 10 + index * 20, bottom: 5 + index, right: 20 + index * 20, top: 30 + index,
      })),
    },
  },
  {
    label: "skill slots (refusal)",
    region: "skillSlots",
    values: { outcome: 7, candidate_count: 3 },
    decode: readCompanionSkillSlots,
    expected: { status: "waiting", reason: "slot-ambiguous", candidateCount: 3 },
  },
  {
    label: "skill cooldowns",
    region: "skillCooldowns",
    values: {
      flags: 1, generation: 61, game_timer: 100_000, player_agent_id: 62,
      recharge_timestamps: range(101).map((value) => value * 1_000),
    },
    decode: readCompanionSkillCooldowns,
    expected: {
      status: "ready", sequence: 2, generation: 61, gameTimer: 100_000, playerAgentId: 62,
      rechargeTimestamps: range(101).map((value) => value * 1_000),
    },
  },
  {
    label: "play region",
    region: "playRegion",
    values: {
      flags: 1 | 4 | 8 | 64, map_id: 71, instance_type: 1, play_region: 2,
      character_key_low: 0x72, character_key_high: 0x73,
      unlocked_maps: words({ 0: 0x11, 27: 0x8000_0000 }),
    },
    decode: readCompanionPlayRegion,
    expected: {
      status: "ready", sequence: 2, mapId: 71, instanceType: 1, playRegion: "pvp",
      travelContext: "world", characterKey: "0000007300000072",
      unlockedMapWords: words({ 0: 0x11, 27: 0x8000_0000 }), guildHall: false, hasGuildHall: true,
    },
  },
  {
    label: "character list",
    region: "characterList",
    values: {
      flags: 1, count: 2, selected_index: 1,
      "records[0].name": "Ann", "records[0].primary_profession": 1,
      "records[0].secondary_profession": 2, "records[0].character_type": 0,
      "records[0].campaign": 3, "records[0].level": 20, "records[0].map_id": 4,
      "records[0].character_key_low": 0x45, "records[0].character_key_high": 0x46,
      "records[1].name": "Ben", "records[1].primary_profession": 5,
      "records[1].secondary_profession": 6, "records[1].character_type": 1,
      "records[1].campaign": 0, "records[1].level": 7, "records[1].map_id": 8,
      "records[1].character_key_low": 0x49, "records[1].character_key_high": 0x4a,
    },
    decode: readCompanionCharacterList,
    expected: {
      status: "ready", sequence: 2, selectedIndex: 1,
      characters: [
        {
          name: "Ann", characterKey: "0000004600000045", primaryProfession: 1,
          secondaryProfession: 2, characterType: "roleplaying", campaign: 3, level: 20, mapId: 4,
        },
        {
          name: "Ben", characterKey: "0000004a00000049", primaryProfession: 5,
          secondaryProfession: 6, characterType: "pvp", campaign: 0, level: 7, mapId: 8,
        },
      ],
    },
  },
  {
    label: "friends",
    region: "friends",
    values: {
      ready: 1, generation: 81, count: 2,
      "records[0].key_low": 0x82, "records[0].key_high": 0x83, "records[0].status": 1,
      "records[0].map_id": 84, "records[0].alias": "Ally", "records[0].character": "Char",
      "records[1].key_low": 0x85, "records[1].key_high": 0x86, "records[1].status": 3,
      "records[1].map_id": 87, "records[1].alias": "Bee",
    },
    decode: readCompanionFriends,
    expected: {
      status: "ready", sequence: 2, generation: 81,
      friends: [
        { key: "0000008300000082", status: "online", mapId: 84, alias: "Ally", character: "Char" },
        { key: "0000008600000085", status: "away", mapId: 87, alias: "Bee", character: "" },
      ],
    },
  },
  {
    label: "player effects",
    region: "playerEffects",
    values: {
      flags: 1, generation: 91, game_timer: 92, count: 2, player_agent_id: 93,
      "effects[0].effect_id": 1, "effects[0].skill_id": 2, "effects[0].attribute_level": 3,
      "effects[0].maintainer_agent_id": 4, "effects[0].duration_ms": 5,
      "effects[0].applied_at_game_ms": 6,
      "effects[1].effect_id": 11, "effects[1].skill_id": 12, "effects[1].attribute_level": 13,
      "effects[1].maintainer_agent_id": 14, "effects[1].duration_ms": 15,
      "effects[1].applied_at_game_ms": 16,
    },
    decode: readCompanionPlayerEffects,
    expected: {
      status: "ready", sequence: 2, generation: 91, gameTimer: 92, playerAgentId: 93,
      effects: [
        { effectId: 1, skillId: 2, attributeLevel: 3, maintainerAgentId: 4, durationMs: 5, appliedAtGameMs: 6 },
        { effectId: 11, skillId: 12, attributeLevel: 13, maintainerAgentId: 14, durationMs: 15, appliedAtGameMs: 16 },
      ],
    },
  },
  {
    label: "player effects (refusal)",
    region: "playerEffects",
    values: { outcome: 12 | (5 << 8) },
    decode: readCompanionPlayerEffects,
    expected: { status: "waiting", reason: "inactive", activeFeatures: 5 },
  },
  {
    label: "effect icons",
    region: "effectIcons",
    values: {
      flags: 1, generation: 101, frame_id: 102, count: 2, viewport_width: 1000,
      viewport_height: 800, "anchor.left": 1, "anchor.bottom": 2, "anchor.right": 3, "anchor.top": 4,
      "icons[0].skill_id": 5, "icons[0].rectangle.left": 6, "icons[0].rectangle.bottom": 7,
      "icons[0].rectangle.right": 8, "icons[0].rectangle.top": 9,
      "icons[1].skill_id": 10, "icons[1].rectangle.left": 11, "icons[1].rectangle.bottom": 12,
      "icons[1].rectangle.right": 13, "icons[1].rectangle.top": 14,
    },
    decode: readCompanionEffectIcons,
    expected: {
      status: "ready", sequence: 2, generation: 101, frameId: 102, viewportWidth: 1000,
      viewportHeight: 800, anchor: { left: 1, bottom: 2, right: 3, top: 4 },
      icons: [
        { skillId: 5, left: 6, bottom: 7, right: 8, top: 9 },
        { skillId: 10, left: 11, bottom: 12, right: 13, top: 14 },
      ],
    },
  },
  {
    label: "effect icons (refusal)",
    region: "effectIcons",
    values: { outcome: 6, candidate_count: 4 },
    decode: readCompanionEffectIcons,
    expected: { status: "waiting", reason: "ambiguous", candidateCount: 4 },
  },
  {
    label: "alcohol",
    region: "alcohol",
    values: {
      ready: 1, game_timer: 111, remaining_ms: 112, character_key_low: 113, character_key_high: 114,
    },
    decode: readCompanionAlcohol,
    expected: { status: "ready", sequence: 2, gameTimer: 111, remainingMs: 112 },
  },
  {
    label: "progress",
    region: "progress",
    values: {
      flags: 0x3f, map_id: 121, character_key_low: 0x7a, character_key_high: 0x7b,
      area_count: COMPANION_ABI.progress.areaRows,
      "missions[0][0]": 1, "missions[1][1]": 2, "missions[2][2]": 3, "missions[3][27]": 4,
      "vanquished[27]": 5, "titles[0]": [1, 250], "titles[1]": [1, 500], "titles[2]": [1, 1_000],
      "areas[0]": [ROW_READ | ROW_THUMBNAIL | 1 | (2 << 8) | (3 << 16) | (4 << 24), 0x10, 0x11, 0x12, 0x13],
      "areas[899]": [ROW_READ | 5 | (6 << 8) | (7 << 16) | (8 << 24), 0x20, 0x21, 0x22, 0x23],
    },
    decode: (buffer, pointer) => createCompanionProgressReader()(buffer, pointer),
    expected: {
      status: "ready", sequence: 2, mapId: 121, characterKey: "0000007b0000007a",
      missions: {
        completed: words({ 0: 1 }), bonus: words({ 1: 2 }),
        completedHm: words({ 2: 3 }), bonusHm: words({ 27: 4 }),
      },
      vanquished: words({ 27: 5 }),
      cartographer: [25, 50, 100],
      areas: [
        {
          mapId: 0, campaign: 1, continent: 2, region: 3, type: 4, thumbnail: true,
          flags: 0x10, nameId: 0x11, x: 0x12, y: 0x13,
        },
        {
          mapId: 899, campaign: 5, continent: 6, region: 7, type: 8, thumbnail: false,
          flags: 0x20, nameId: 0x21, x: 0x22, y: 0x23,
        },
      ],
    },
  },
  {
    label: "whispers",
    region: "whispers",
    values: {
      write_count: 2, rejected_count: 7,
      "slots[0].id": 1, "slots[0].sender_and_message_units": 3 | (5 << 16),
      "slots[0].sender": "Bob", "slots[0].message": "hello",
      "slots[1].id": 2, "slots[1].sender_and_message_units": 3 | 0x4000_0000,
      "slots[1].sender": "Amy",
    },
    decode: (buffer, pointer) => readCompanionWhispers(buffer, pointer, 0),
    expected: {
      status: "ready", sequence: 2, writeCount: 2, rejectedCount: 7, dropped: 0,
      messages: [
        { id: 1, sender: "Bob", message: "hello", direction: "incoming" },
        { id: 2, sender: "Amy", direction: "participant" },
      ],
    },
  },
];

function assertDecodesAtRustOffsets(entry: Case, source: string): void {
  const { buffer, pointer } = publish(entry.region, entry.values, source);
  const decoded = entry.decode(buffer, pointer);
  const actual = Object.fromEntries(
    Object.entries(decoded).filter(([key]) => key in entry.expected),
  );
  assert.deepEqual(
    actual,
    entry.expected,
    `${entry.label}: the TypeScript decoder does not read ${REGIONS[entry.region].struct} `
      + "at the offsets kernels/companion/abi.rs gives it",
  );
}

test("every COMPANION_ABI region has Rust names and a decoder case", () => {
  const versioned = Object.entries(COMPANION_ABI)
    .filter(([, value]) => typeof value === "object" && "abi" in value)
    .map(([name]) => name);
  assert.deepEqual(new Set(Object.keys(REGIONS)), new Set(versioned), "REGIONS lists every versioned region");
  assert.deepEqual(new Set(CASES.map((entry) => entry.region)), new Set(versioned), "CASES decode every region");
});

for (const entry of CASES) {
  test(`${entry.label} decodes at the abi.rs offsets`, () => {
    assertDecodesAtRustOffsets(entry, rustSource);
  });
}

test("a same-size field swap in abi.rs is caught", () => {
  const swapped = "    pub(crate) remaining_ms: u32,\n    pub(crate) game_timer: u32,";
  const original = "    pub(crate) game_timer: u32,\n    pub(crate) remaining_ms: u32,";
  assert.ok(rustSource.includes(original), "AlcoholSnapshot still declares game_timer before remaining_ms");
  const alcohol = CASES.find((entry) => entry.region === "alcohol");
  assert.ok(alcohol !== undefined);
  assert.throws(
    () => assertDecodesAtRustOffsets(alcohol, rustSource.replace(original, swapped)),
    /alcohol: the TypeScript decoder does not read AlcoholSnapshot/u,
  );
});
