/**
 * The exact companion-kernel surface shared by the build sealer and renderer.
 * Each boundary validates independently, but neither restates the ABI. Plain
 * Node loads this file for the build seal, so it imports nothing.
 */
export const COMPANION_KERNEL_IMPORTS = Object.freeze([
  "env.__indirect_function_table:table",
  "env.__memory_base:global",
  "env.__stack_pointer:global",
  "env.__table_base:global",
  "env.memory:memory",
]);

/**
 * companion_init's parameters, in order. A region takes two words, its pointer
 * and its byte count (`<name>_ptr`, `<name>_size` in lib.rs); a scalar takes
 * one. The signature check, the loader's call and the region types below all
 * follow from this list; the ABI test compares it with the Rust signature.
 */
export const COMPANION_KERNEL_INIT_ARGUMENTS = Object.freeze([
  "snapshot",
  "config",
  "cursor",
  "toolbox",
  "party",
  "skillSlots",
  "skillCooldowns",
  "playRegion",
  "characterList",
  "friends",
  "playerEffects",
  "effectIcons",
  "friendRoot",
  "features",
  "whispers",
  "alcohol",
  "progress",
] as const);

export const COMPANION_KERNEL_INIT_SCALARS = Object.freeze(["friendRoot", "features"] as const);

/** companion_init's arity: two words per region, one per scalar. */
export const COMPANION_KERNEL_INIT_WORD_COUNT =
  COMPANION_KERNEL_INIT_ARGUMENTS.length * 2 - COMPANION_KERNEL_INIT_SCALARS.length;

type CompanionKernelInitArgument = (typeof COMPANION_KERNEL_INIT_ARGUMENTS)[number];
type CompanionKernelInitScalar = (typeof COMPANION_KERNEL_INIT_SCALARS)[number];
type CompanionKernelRegionName = Exclude<CompanionKernelInitArgument, CompanionKernelInitScalar>;
export type CompanionKernelRegion = Readonly<{ pointer: number; bytes: number }>;
export type CompanionKernelRegions = Readonly<Record<CompanionKernelRegionName, CompanionKernelRegion>>;

function isInitScalar(name: CompanionKernelInitArgument): name is CompanionKernelInitScalar {
  return COMPANION_KERNEL_INIT_SCALARS.some((scalar) => scalar === name);
}

/**
 * companion_init's words: each region's pointer and byte count, each scalar as
 * itself. An absent region is the zero pair the kernel reads as "not installed".
 */
export function companionKernelInitWords(
  regions: Readonly<Partial<CompanionKernelRegions>>,
  scalars: Readonly<Record<CompanionKernelInitScalar, number>>,
): number[] {
  return COMPANION_KERNEL_INIT_ARGUMENTS.flatMap((name) => {
    if (isInitScalar(name)) return [scalars[name]];
    const region = regions[name];
    return region === undefined ? [0, 0] : [region.pointer, region.bytes];
  });
}

export const COMPANION_KERNEL_SIGNATURES: readonly Readonly<{
  name: string;
  typeIndex: number;
}>[] = Object.freeze([
  { name: "companion_init", typeIndex: 0 },
  { name: "companion_dispatch", typeIndex: 1 },
  { name: "companion_cursor_event_count", typeIndex: 2 },
  { name: "companion_abi", typeIndex: 2 },
  { name: "companion_config_bytes", typeIndex: 2 },
  { name: "companion_snapshot_bytes", typeIndex: 2 },
  { name: "companion_cursor_bytes", typeIndex: 2 },
  { name: "companion_toolbox_bytes", typeIndex: 2 },
  { name: "companion_party_bytes", typeIndex: 2 },
  { name: "companion_skill_slot_bytes", typeIndex: 2 },
  { name: "companion_skill_cooldown_bytes", typeIndex: 2 },
  { name: "companion_play_region_bytes", typeIndex: 2 },
  { name: "companion_character_list_bytes", typeIndex: 2 },
  { name: "companion_friend_bytes", typeIndex: 2 },
  { name: "companion_player_effect_bytes", typeIndex: 2 },
  { name: "companion_effect_icon_bytes", typeIndex: 2 },
  { name: "companion_alcohol_bytes", typeIndex: 2 },
  { name: "companion_whisper_bytes", typeIndex: 2 },
  { name: "companion_progress_bytes", typeIndex: 2 },
]);

export const COMPANION_KERNEL_EXPORTS = Object.freeze(
  COMPANION_KERNEL_SIGNATURES
    .map(({ name }) => `${name}:function`)
    .sort(),
);

function encodeUleb(value: number): number[] {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value = Math.floor(value / 0x80);
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}

function encodeName(value: string): number[] {
  const bytes = new TextEncoder().encode(value);
  return [...encodeUleb(bytes.byteLength), ...bytes];
}

function i32FunctionType(parameterCount: number, returnsI32: boolean): number[] {
  return [
    0x60,
    ...encodeUleb(parameterCount),
    ...Array.from({ length: parameterCount }, () => 0x7f),
    ...(returnsI32 ? [0x01, 0x7f] : [0x00]),
  ];
}

function encodeSection(id: number, payload: number[]): number[] {
  return [id, ...encodeUleb(payload.length), ...payload];
}

/**
 * A tiny Wasm module importing the canonical functions at their exact types.
 * Browser and Node each compile these bytes themselves, so both trust
 * boundaries execute the type check without this shared module needing DOM
 * WebAssembly types.
 */
export function companionKernelSignatureBytes(): Uint8Array<ArrayBuffer> {
  const types = [
    i32FunctionType(COMPANION_KERNEL_INIT_WORD_COUNT, true),
    i32FunctionType(6, false),
    i32FunctionType(0, true),
  ];
  const typeSection = [...encodeUleb(types.length), ...types.flat()];
  const importSection = [
    ...encodeUleb(COMPANION_KERNEL_SIGNATURES.length),
    ...COMPANION_KERNEL_SIGNATURES.flatMap(({ name, typeIndex }) => [
      ...encodeName("kernel"),
      ...encodeName(name),
      0x00,
      ...encodeUleb(typeIndex),
    ]),
  ];
  return Uint8Array.of(
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...encodeSection(1, typeSection),
    ...encodeSection(2, importSection),
  );
}
