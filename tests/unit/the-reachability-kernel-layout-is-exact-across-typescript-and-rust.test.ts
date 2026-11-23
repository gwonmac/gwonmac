import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CARTOGRAPHY_REACHABILITY_ABI,
  CARTOGRAPHY_REACHABILITY_MAX_CELLS,
  CARTOGRAPHY_REACHABILITY_REGION_BYTES,
  CARTOGRAPHY_REACHABILITY_ROUTE_BYTES,
  CARTOGRAPHY_REACHABILITY_ROUTE_MAX_STEPS,
} from "../../app/shared/cartography-reachability-kernel-contract.ts";

// The Rust kernel writes two regions that the renderer decodes by hand. The
// sealed kernel contract checks only the ABI, the region sizes and the module
// boundary, so a reordered header word or a moved scratch area that keeps
// those sizes would pass sealing and leave the map without reachability.
const rustSource = readFileSync(
  new URL("../../kernels/reachability/lib.rs", import.meta.url),
  "utf8",
);
const typescriptSource = readFileSync(
  new URL("../../app/features/cartography/renderer/reachability-kernel.ts", import.meta.url),
  "utf8",
);

/** Rust `publish` value → the name the TypeScript decoder reads it into. */
const SNAPSHOT_HEADER = Object.freeze([
  ["MAGIC", "MAGIC"],
  ["ABI", "CARTOGRAPHY_REACHABILITY_ABI"],
  ["REGION_BYTES", "CARTOGRAPHY_REACHABILITY_REGION_BYTES"],
  ["writing", "first"],
  ["status", "status"],
  ["map_id", "mapId"],
  ["area_epoch", "areaEpoch"],
  ["layout_id", "layoutId"],
  ["width", "width"],
  ["height", "height"],
  ["RESOURCE_GENERATION", "resourceGeneration"],
  ["total_traps", "totalTrapezoids"],
  ["reachable_traps", "reachableTrapezoids"],
  ["ground_cells", "groundCells"],
  ["doorway_count", "doorwayCount"],
  ["visual_width", "terrainWidth"],
  ["visual_height", "terrainHeight"],
  ["visual_map_units_per_pixel", "mapUnitsPerPixel"],
] as const);

/** Rust `publish_route` word → its decoder name; null for words no decoder reads. */
const ROUTE_HEADER = Object.freeze([
  ["ROUTE_MAGIC", "ROUTE_MAGIC"],
  ["ABI", "CARTOGRAPHY_REACHABILITY_ABI"],
  ["ROUTE_BYTES", "CARTOGRAPHY_REACHABILITY_ROUTE_BYTES"],
  ["writing", "first"],
  ["status", "READY"],
  ["map_id", "mapId"],
  ["area_epoch", "areaEpoch"],
  ["layout_id", null],
  ["steps", "steps"],
  ["reached", "reached"],
  ["expanded", null],
] as const);

type Field = Readonly<{ offset: number; type: "u32" | "f32" }>;

function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/.*$/gmu, "");
}

function body(source: string, start: string): string {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`missing ${start}`);
  const to = source.indexOf("\n}\n", from);
  if (to < 0) throw new Error(`unterminated ${start}`);
  return source.slice(from, to);
}

function integer(literal: string): number {
  return Number(literal.replaceAll("_", ""));
}

/** Evaluates `+ - * /` over integers and earlier constants, as Rust's const items do. */
function evaluate(expression: string, known: ReadonlyMap<string, number>): number {
  const tokens = expression.match(/0x[0-9a-fA-F_]+|\d[\d_]*|[A-Za-z_]\w*|[-+*/()]|\S/gu) ?? [];
  let index = 0;
  const factor = (): number => {
    const token = tokens[index++];
    if (token === "(") {
      const value = sum();
      if (tokens[index++] !== ")") throw new Error(`unbalanced: ${expression}`);
      return value;
    }
    if (token !== undefined && /^(0x|\d)/u.test(token)) return integer(token);
    const value = token === undefined ? undefined : known.get(token);
    if (value === undefined) throw new Error(`unsupported term ${token} in ${expression}`);
    return value;
  };
  const product = (): number => {
    let value = factor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = factor();
      value = operator === "*" ? value * right : Math.floor(value / right);
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = product();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const value = sum();
  if (index !== tokens.length) throw new Error(`unsupported expression: ${expression}`);
  return value;
}

function rustConstants(source: string): Map<string, number> {
  const constants = new Map<string, number>();
  for (const [, name, expression] of withoutComments(source).matchAll(
    /^const ([A-Z][A-Z0-9_]*): u32 = ([^;]+);/gmu,
  )) {
    if (name === undefined || expression === undefined) continue;
    // `u32::MAX` and float casts are not layout; everything else must evaluate.
    if (expression.includes("::")) continue;
    constants.set(name, evaluate(expression, constants));
  }
  return constants;
}

function typescriptConstants(source: string): Map<string, number> {
  const constants = new Map<string, number>();
  for (const [, name, literal] of source.matchAll(
    /^const ([A-Z][A-Z0-9_]*) = (0x[0-9a-fA-F_]+|\d[\d_]*);/gmu,
  )) {
    if (name !== undefined && literal !== undefined) constants.set(name, integer(literal));
  }
  return constants;
}

function constant(constants: ReadonlyMap<string, number>, name: string): number {
  const value = constants.get(name);
  if (value === undefined) throw new Error(`missing constant ${name}`);
  return value;
}

function record(fields: Map<string, Field>, name: string, field: Field): void {
  const existing = fields.get(name);
  if (existing && (existing.offset !== field.offset || existing.type !== field.type)) {
    throw new Error(`${name} is at both ${existing.offset} and ${field.offset}`);
  }
  fields.set(name, field);
}

function rustSnapshotHeader(source: string): Map<string, Field> {
  const fields = new Map<string, Field>();
  for (const [, type, offset, name] of body(source, "unsafe fn publish(").matchAll(
    /store_(u32|f32)\((?:add\(region, (\d+)\)\.unwrap_or\(0\)|region), ([A-Za-z_]\w*)/gu,
  )) {
    record(fields, name!, { offset: Number(offset ?? 0), type: type as Field["type"] });
  }
  return fields;
}

function rustRouteHeader(source: string): Map<string, Field> {
  const publish = body(source, "unsafe fn publish_route(");
  const words = publish.match(/let words = \[([\s\S]*?)\];/u)?.[1];
  if (words === undefined) throw new Error("missing Rust route words");
  // Split on top-level commas only: `map_or(0, ...)` carries its own.
  const elements: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of words) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      elements.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) elements.push(current);
  const fields = new Map<string, Field>();
  elements.forEach((element, index) => {
    const name = element.match(/value\.(\w+)/u)?.[1] ?? element.trim().match(/^[A-Za-z_]\w*/u)?.[0];
    if (name === undefined) throw new Error(`unnamed Rust route word: ${element}`);
    record(fields, name, { offset: index * 4, type: "u32" });
  });
  return fields;
}

function typescriptHeader(source: string): Map<string, Field> {
  const fields = new Map<string, Field>();
  for (const [, name, type, offset] of source.matchAll(
    /(\w+)(?::|\s*=)\s*header\.get(Uint32|Float32)\((\d+), true\)/gu,
  )) {
    record(fields, name!, { offset: Number(offset), type: type === "Float32" ? "f32" : "u32" });
  }
  for (const [, offset, name] of source.matchAll(
    /header\.getUint32\((\d+), true\) !== (\w+)/gu,
  )) {
    record(fields, name!, { offset: Number(offset), type: "u32" });
  }
  return fields;
}

function assertHeader(
  table: readonly (readonly [string, string | null])[],
  rust: ReadonlyMap<string, Field>,
  typescript: ReadonlyMap<string, Field>,
  headerBytes: number,
): void {
  assert.deepEqual([...rust.keys()].sort(), table.map(([name]) => name).sort());
  assert.deepEqual(
    [...typescript.keys()].sort(),
    table.flatMap(([, name]) => (name === null ? [] : [name])).sort(),
  );
  for (const [rustName, typescriptName] of table) {
    const written = rust.get(rustName)!;
    assert.ok(written.offset + 4 <= headerBytes, `${rustName} is inside the header`);
    if (typescriptName !== null) {
      assert.deepEqual(typescript.get(typescriptName), written, `${rustName} ↔ ${typescriptName}`);
    }
  }
}

function assertExactLayout(rust: string, typescript: string): void {
  const kernel = rustConstants(rust);
  const decoder = typescriptConstants(typescript);

  assert.equal(constant(kernel, "ABI"), CARTOGRAPHY_REACHABILITY_ABI);
  assert.equal(constant(kernel, "MAX_CELLS"), CARTOGRAPHY_REACHABILITY_MAX_CELLS);
  assert.equal(constant(kernel, "REGION_BYTES"), CARTOGRAPHY_REACHABILITY_REGION_BYTES);
  assert.equal(constant(kernel, "ROUTE_BYTES"), CARTOGRAPHY_REACHABILITY_ROUTE_BYTES);
  assert.equal(constant(kernel, "MAX_ROUTE_STEPS"), CARTOGRAPHY_REACHABILITY_ROUTE_MAX_STEPS);

  assert.equal(constant(decoder, "MAGIC"), constant(kernel, "MAGIC"));
  assert.equal(constant(decoder, "ROUTE_MAGIC"), constant(kernel, "ROUTE_MAGIC"));
  assert.equal(constant(decoder, "READY"), constant(kernel, "STATUS_READY"));
  // The decoder reads the cell bits right after the header, the terrain bits
  // where the visual raster starts, and the route steps after their header.
  assert.equal(constant(decoder, "HEADER_BYTES"), constant(kernel, "HEADER_BYTES"));
  assert.equal(constant(kernel, "CELL_BITS"), constant(kernel, "HEADER_BYTES"));
  assert.equal(constant(decoder, "WALKABLE_TERRAIN_BITS_OFFSET"), constant(kernel, "VISUAL_BITS"));
  assert.equal(
    constant(decoder, "MAX_TERRAIN_RASTER_CELLS"),
    constant(kernel, "MAX_VISUAL_RASTER_CELLS"),
  );
  assert.equal(constant(decoder, "ROUTE_HEADER_BYTES"), constant(kernel, "ROUTE_HEADER_BYTES"));
  assert.equal(constant(kernel, "ROUTE_STEPS"), constant(kernel, "ROUTE_HEADER_BYTES"));
  assert.equal(constant(decoder, "ROUTE_STEP_FLOATS") * 4, constant(kernel, "ROUTE_STEP_BYTES"));

  // Status codes run 1..n; the snapshot decoder's upper bound must be one of them.
  const statuses = [...kernel].filter(([name]) => name.startsWith("STATUS_")).map(([, value]) => value);
  assert.deepEqual([...statuses].sort((a, b) => a - b), statuses.map((_, index) => index + 1));
  const decode = body(typescript, "function decode(");
  const bound = Number(decode.match(/status < READY \|\| status > (\d+)/u)?.[1]);
  assert.ok(statuses.includes(bound), `decoder status bound ${bound} is a Rust status`);

  assertHeader(
    SNAPSHOT_HEADER,
    rustSnapshotHeader(rust),
    typescriptHeader(decode + body(typescript, "function diagnostic(")),
    constant(kernel, "HEADER_BYTES"),
  );

  const decodeRoute = body(typescript, "function decodeRoute(");
  assertHeader(
    ROUTE_HEADER,
    rustRouteHeader(rust),
    typescriptHeader(decodeRoute),
    constant(kernel, "ROUTE_HEADER_BYTES"),
  );
  // The four route end points: start x, y, then end x, y.
  const pointBase = Number(body(rust, "unsafe fn publish_route(")
    .match(/store_f32\(add\(region, (\d+) \+ index as u32 \* 4\)/u)?.[1]);
  const pointOffsets = decodeRoute.match(/\[([\d, ]+)\]\.map\(\(offset\) => header\.getFloat32/u)?.[1];
  assert.deepEqual(
    pointOffsets?.split(",").map((offset) => Number(offset.trim())),
    [0, 4, 8, 12].map((step) => pointBase + step),
  );
  assert.ok(pointBase + 16 <= constant(kernel, "ROUTE_HEADER_BYTES"));
}

function replaced(source: string, from: string, to: string): string {
  assert.ok(source.includes(from), `mutation target is present: ${from}`);
  return source.replace(from, to);
}

test("the reachability kernel's Rust layout and TypeScript decoder match exactly", () => {
  assertExactLayout(rustSource, typescriptSource);
});

test("header swaps, moved regions, and new header words are rejected", () => {
  // Two same-size words swapped in the snapshot header.
  assert.throws(() => assertExactLayout(replaced(
    rustSource,
    "store_u32(add(region, 32).unwrap_or(0), width);\n        store_u32(add(region, 36).unwrap_or(0), height);",
    "store_u32(add(region, 32).unwrap_or(0), height);\n        store_u32(add(region, 36).unwrap_or(0), width);",
  ), typescriptSource));
  // The terrain raster moved while the region size stayed equal.
  assert.throws(() => assertExactLayout(replaced(
    replaced(
      rustSource,
      "const QUEUE_PLANES: u32 = QUEUE_POINTERS + MAX_TRAPS * 4;",
      "const QUEUE_PLANES: u32 = QUEUE_POINTERS + MAX_TRAPS * 4 + 1_024;",
    ),
    "const MAX_VISUAL_RASTER_CELLS: u32 = 262_144;",
    "const MAX_VISUAL_RASTER_CELLS: u32 = 253_952;",
  ), typescriptSource), /552008 !== 553032/u);
  // A word added to the route header.
  assert.throws(() => assertExactLayout(replaced(
    rustSource,
    "outcome.map_or(0, |value| value.expanded),",
    "outcome.map_or(0, |value| value.expanded),\n        outcome.map_or(0, |value| value.cost),",
  ), typescriptSource));
  // A changed magic on one side only.
  assert.throws(() => assertExactLayout(rustSource, replaced(
    typescriptSource,
    "const ROUTE_MAGIC = 0x5452_4347;",
    "const ROUTE_MAGIC = 0x5452_4348;",
  )));
});
