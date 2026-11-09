/**
 * Defines the exact executable boundary for the private Cartography reachability module.
 * Changes to memory, imports, exports, or function types must update this one contract.
 */
export const CARTOGRAPHY_REACHABILITY_ABI = 5;
export const CARTOGRAPHY_REACHABILITY_MAX_CELLS = 131_072;
export const CARTOGRAPHY_REACHABILITY_REGION_BYTES = 584_776;
/** The separate region a route search writes; the host allocates it on the first route. */
export const CARTOGRAPHY_REACHABILITY_ROUTE_BYTES = 1_698_880;
/** The most trapezoids one route crosses. */
export const CARTOGRAPHY_REACHABILITY_ROUTE_MAX_STEPS = 4_096;
export const CARTOGRAPHY_REACHABILITY_RUNTIME_BYTES = 65_536;
export const CARTOGRAPHY_REACHABILITY_RUNTIME_ALIGN = 16;

export const CARTOGRAPHY_REACHABILITY_IMPORTS = Object.freeze([
  "env.__memory_base:global",
  "env.__stack_pointer:global",
  "env.__table_base:global",
  "env.memory:memory",
]);

export const CARTOGRAPHY_REACHABILITY_SIGNATURES = Object.freeze([
  { name: "cartography_reachability_classify", typeIndex: 0 },
  { name: "cartography_reachability_abi", typeIndex: 1 },
  { name: "cartography_reachability_region_bytes", typeIndex: 1 },
  { name: "cartography_reachability_install", typeIndex: 2 },
  { name: "cartography_reachability_route", typeIndex: 3 },
  { name: "cartography_reachability_route_bytes", typeIndex: 1 },
]);

export const CARTOGRAPHY_REACHABILITY_EXPORTS = Object.freeze(
  CARTOGRAPHY_REACHABILITY_SIGNATURES
    .map(({ name }) => `${name}:function`)
    .sort(),
);

function uleb(value: number): number[] {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value = Math.floor(value / 0x80);
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}

function name(value: string): number[] {
  const bytes = new TextEncoder().encode(value);
  return [...uleb(bytes.byteLength), ...bytes];
}

function functionType(parameters: readonly number[]): number[] {
  return [
    0x60,
    ...uleb(parameters.length),
    ...parameters,
    0x01,
    0x7f,
  ];
}

function section(id: number, payload: number[]): number[] {
  return [id, ...uleb(payload.length), ...payload];
}

/** Module importing the canonical functions solely to make Wasm check types. */
export function cartographyReachabilitySignatureBytes(): Uint8Array<ArrayBuffer> {
  const types = [
    functionType([
      0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f,
      0x7d, 0x7d, 0x7f, 0x7f,
      0x7d, 0x7d, 0x7d, 0x7d,
      0x7f,
    ]),
    functionType([]),
    functionType([0x7f, 0x7f, 0x7f]),
    functionType([0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7d, 0x7d]),
  ];
  const typeSection = [...uleb(types.length), ...types.flat()];
  const importSection = [
    ...uleb(CARTOGRAPHY_REACHABILITY_SIGNATURES.length),
    ...CARTOGRAPHY_REACHABILITY_SIGNATURES.flatMap(({ name: exportName, typeIndex }) => [
      ...name("kernel"),
      ...name(exportName),
      0x00,
      ...uleb(typeIndex),
    ]),
  ];
  return Uint8Array.of(
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...section(1, typeSection),
    ...section(2, importSection),
  );
}
