/**
 * Binds Template-saving helper calls to their reviewed signatures and complete
 * bodies. Call positions may move only with the independently identified callee.
 */
import type { TemplateSaveModuleView } from "./template-save-module-view.js";
import { perReviewedFacts } from "./reviewed-facts.js";
import { reviewedBodyMatch } from "./wasm-evidence.js";

interface CalleeWitness {
  readonly offset: number;
  readonly signature: string;
  readonly bodyHashes: readonly string[];
}

const reviewed = (signature: string, bodyHashes: readonly string[]) =>
  Object.freeze({ signature, bodyHashes });

// These are feature-local helper bodies, never whole-client launch authority.
// The retained August and October 1 bodies preserve the caller's argument and
// control-flow contract. Later generations add their reviewed bodies in their
// generation files (October 22 changed only relocated string pointers and one
// assertion line number). A relink that changes only callee indices and static
// addresses (November 3) matches through the reviewed relocation identities of
// these bodies. A new helper body must refuse until it is reviewed.
const CALL_WITNESSES: Readonly<Record<string, readonly CalleeWitness[]>> = {
  "screenshot-initializer": [
    { offset: 39, signature: "()->()", bodyHashes: [
      "f61e0d977f1062cdc9eb1604f23685581db8f5f9f86a6d22b7fb2f8add381777",
      "2fccbd179a983ccd28c27502d6d17d53989d02b1ccb0b40e4b139bf55935018f",
      "97cd70b9233c07a24510bffa9b1bcd44846a2620713e091291203644f652ea68",
    ] },
    { offset: 145, signature: "(i32)->(i32)", bodyHashes: [
      "d4ee1c0b9e04c0a9c2ba20c2db8cb27a4374196429d731cea023f0c92d6438a0",
      "47db5be8d94d4d1c66e1fc602e14588b6de79dd55e50830f518dd88d7a9a5ce7",
    ] },
    { offset: 235, signature: "(i32,i32)->()", bodyHashes: [
      "4ab967be169dbe74a1e5f2c4f477ebcaed66b101c8887b812104058de42e0e45",
      "658aaf6e5f8a2b0b5d86ffab032a37ab98b63f2967c18fde2db7afa041086882",
    ] },
  ],
  "writer": [
    { offset: 50, signature: "(i32,i32)->()", bodyHashes: [
      "42e5f136409ef9876e49fac965280f5fdd9be6b8d042b2de0ef4a2faca7f91da",
      "94b7a29936f37b71100e1805725eaaf59df65ec763fc964667fb9166bef6acd7",
    ] },
  ],
  "directory-sink": [
    { offset: 776, signature: "(i32,i32)->()", bodyHashes: [
      "27de9130f902e343143030751962177d77853da9e841eb7afbfd3c6c494e556d",
      "af39ac84af3f910dea532421a1d27a77621d13caf6894de83b62ccf9c56841b7",
    ] },
    { offset: 1104, signature: "(i32,i32)->()", bodyHashes: [
      "27de9130f902e343143030751962177d77853da9e841eb7afbfd3c6c494e556d",
      "af39ac84af3f910dea532421a1d27a77621d13caf6894de83b62ccf9c56841b7",
    ] },
  ],
  "screenshot-sink": [
    { offset: 198, signature: "()->(i32)", bodyHashes: [
      "f63235d97028ffe7bfab880ac8a0f85c88a3b3323fe2e9893ba06d0ea1a3b891",
      "975f8ebc96587696f02406d334da68a2762f9e54393782e07cd8bd694dc3532a",
    ] },
    { offset: 211, signature: "(i32)->(i32)", bodyHashes: [
      "5c8e5494dc3001b6f9e3110466ebada686954f264d7759e782b19246e2e2faa4",
      "2ec8d3270f621a09393cdd241baa010971550cb10d69206de4da883f7bb65524",
    ] },
    { offset: 228, signature: "(i32,i32)->()", bodyHashes: [
      "178b6da0fc63cdec62cb7e2813ec45270d8508f6da86af1194ae2adb074aaf1b",
      "301c3af464b30961e0bb24276782d7176f314baf7391ff280b26d68978604d5e",
    ] },
    { offset: 952, signature: "(i32)->(i32)", bodyHashes: [
      "df3092089ab2fe5a657b174ee6d40c21e06ab1791d3fbfc7a2c017844ad44f87",
      "65d0ad5584cb83ea51954f0f2c11f9de9e92a814fc9c01be299dd0f31224efeb",
    ] },
    { offset: 1215, signature: "(i32,i32)->()", bodyHashes: [
      "27de9130f902e343143030751962177d77853da9e841eb7afbfd3c6c494e556d",
      "af39ac84af3f910dea532421a1d27a77621d13caf6894de83b62ccf9c56841b7",
    ] },
    { offset: 1235, signature: "(i32,i32)->()", bodyHashes: [
      "27de9130f902e343143030751962177d77853da9e841eb7afbfd3c6c494e556d",
      "af39ac84af3f910dea532421a1d27a77621d13caf6894de83b62ccf9c56841b7",
    ] },
    { offset: 1275, signature: "()->()", bodyHashes: [
      "c80071ce142d86c2fe30af2e5559a706c2fae7ff85070d0fd1c22514a54aa12e",
      // The October sink wrapper. November 3 shifted both one-call wrappers
      // by one index, so the initializer wrapper at offset 39 has these bytes.
      "97cd70b9233c07a24510bffa9b1bcd44846a2620713e091291203644f652ea68",
    ] },
    { offset: 1412, signature: "(i32,i32)->()", bodyHashes: [
      "4ab967be169dbe74a1e5f2c4f477ebcaed66b101c8887b812104058de42e0e45",
      "658aaf6e5f8a2b0b5d86ffab032a37ab98b63f2967c18fde2db7afa041086882",
    ] },
  ],
  "skill-scan": [
    { offset: 585, signature: "(i32,i32)->(i32)", bodyHashes: [
      "d674b5ca59ca7108de5892ebeb26ddbc640eb58ce88db2cb2155262f78e70e21",
      "c40c500091fd2b07b07eb17db068fad70814fe8e1fe52ec336bc3838e0e68892",
    ] },
    { offset: 898, signature: "(i32,i32,i32)->()", bodyHashes: [
      "2d9c21a01d2ea73b47cba5da45fd09648fc01c49d0bd3e7957a2b8f4952a778a",
      "7360f098727dd1b104924223849d92074c517ddccbcf03a3ef3f55789622035c",
    ] },
    { offset: 1013, signature: "(i32,i32,i32)->()", bodyHashes: [
      "bfd9130ffc32c0866207bacd52684127f19affc9c4a29d14d9862de924bd0113",
      "10c0e2dd4cbe0782b9c9d92126eadc01bff409612ad3e03e104dcde520515311",
    ] },
  ],
  "equipment-scan": [
    { offset: 613, signature: "(i32,i32)->(i32)", bodyHashes: [
      "90de93d9c38a832d11cb22e6e59b69bad31732f462942edf3b3114a9106dc500",
      "bcbe21869c2763fa664de3bc9d9c21d7964ed62814f41223c1734e8f48848f04",
    ] },
    { offset: 1055, signature: "(i32,i32,i32)->()", bodyHashes: [
      "2d9c21a01d2ea73b47cba5da45fd09648fc01c49d0bd3e7957a2b8f4952a778a",
      "7360f098727dd1b104924223849d92074c517ddccbcf03a3ef3f55789622035c",
    ] },
    { offset: 1211, signature: "(i32,i32,i32)->()", bodyHashes: [
      "3ec70d19cc641ee9483ee336bfc421dac0768902bb0a2666b669633ca195b7b3",
      "66a258793ca455cfa84e66cfe57cec1561149520bf43ec6bcbce8c0f02fdb7c5",
    ] },
  ],
};

// Helper calls that first moved in the November 3 client, when ArenaNet
// inserted functions below them. Each callee is identified by its signature
// and a complete reviewed body, or that body's relocation identity on a
// relink. Bodies below are shared with older clients; October 22 adds the rest
// in its generation file.
const MOVED_CALLEES = {
  callee01: reviewed("(i32,i32)->()", [
    "fab95ac17337f47eb40041e800b82b5e5eab7f5c19a7cebf59955a3db9e136c4",
  ]),
  callee02: reviewed("(i32,i32,i32,i32)->()", []),
  callee03: reviewed("(i32,i32,i32,i32)->()", []),
  callee04: reviewed("(i32,i32,i32)->()", [
    "1c87ab4b0831420341935898d106c902d85897a116b4beb7492bf4ab3b1ea9c7",
  ]),
  callee05: reviewed("(i32,i32,i32)->()", []),
  callee06: reviewed("(i32,i32,i32)->(i32)", [
    "6b212ed9b073a98a778eb517317f9859cdbf464cf452697860b87a0e5e8d92ff",
  ]),
  callee07: reviewed("(i32,i32,i32,i32)->(i32)", []),
  callee08: reviewed("(i32)->(i32)", [
    "483e9a39a81c93a2b4744034d338355bd6a8647998676d4384e134e8347ae88e",
  ]),
  callee09: reviewed("(i32,i32,i32,i32,i32)->(i32)", []),
  callee10: reviewed("(i32)->()", []),
  callee11: reviewed("(i32,i32,i32)->()", []),
  callee12: reviewed("(i32,i32)->(i32)", [
    "b8ede3a030d6dbe916834d24b05d2a1d1e90c77bbf992e38ecfef314f36a328c",
  ]),
  callee13: reviewed("(i32,i32,i32)->()", []),
  callee14: reviewed("(i32,i32,i32)->()", []),
  callee15: reviewed("(i32)->(i32)", [
    "e283934ec12bc0c0dc23d2afd90ea0443fc75b7168da5a4c9ec5a55021180771",
  ]),
  callee16: reviewed("(i32)->(i32)", [
    "b2b4bd7f836a436542ece35d84651d7f1fc403f19363707a30fe5a7730895ba6",
  ]),
  callee17: reviewed("(i32,i32,i32)->(i32)", [
    "c7da1da4f3c1d8f53d3bf6463b088fe12557de59888dc4e47130120529b275ea",
  ]),
  callee18: reviewed("(i32,i32,i32)->(i32)", []),
  callee19: reviewed("(i32,i32,i32,i32)->(i32)", []),
  callee20: reviewed("(i32,i32,i32)->(i32)", []),
  callee21: reviewed("(i32,i32,i32)->()", []),
  callee22: reviewed("(i32,i32,i32)->(i32)", []),
  callee23: reviewed("(i32,i32,i32)->()", []),
  callee24: reviewed("(i32)->()", []),
  callee25: reviewed("(i32,i32)->()", []),
  callee26: reviewed("(i32,i32)->(i32)", []),
  callee27: reviewed("(i32,i32,i32,i32)->(i32)", [
    "4d08a3cde5c979729cf97e90ae3873d3633da52793334638395efafd0dd29622",
  ]),
  callee28: reviewed("(i32,i32,i32,i32)->()", []),
  callee29: reviewed("(i32,i32,i32,i32,i32,i32)->(i32)", []),
  callee30: reviewed("(i32)->()", [
    "d30f207317d2f41fb835151734edb4f8a942a81d5c54052ed90a2197aede80fa",
  ]),
  callee31: reviewed("(i32,i32,i32,i32)->()", []),
  callee32: reviewed("(i32,i32,i32,i32,i32,i32,i32,i32,i32)->()", []),
  callee33: reviewed("(i32)->(i32)", [
    "4c7c4590e83e2eb3e9014a2dabd7ad2556f00f93a37a425121347e12e65aad37",
  ]),
  callee34: reviewed("(i32)->()", [
    "c6136e2323c751086990dc6ded74644906739a4ec2d148aa1881224aad3fc202",
  ]),
  callee35: reviewed("(i32)->()", [
    "9c753eb67c287ac128bbdd725290aaa3079e7711e787b2c9c337cafa5ac7bc26",
  ]),
  callee36: reviewed("(i32)->()", []),
  callee37: reviewed("(i32,i32)->()", []),
  callee38: reviewed("(i32,i32,i32,i32)->()", []),
  callee39: reviewed("()->()", [
    "8476683033ad31f0b011834d9caad51f0a23c8e1ba88e10ac0c583146eb4c156",
  ]),
  callee40: reviewed("(i32,i32,i32)->(i32)", [
    "4635f44aaacc946ac089da8203845c02e5c3b5a190ccf70fa35b1769f86686a0",
  ]),
  callee41: reviewed("(i32,i32,i32,i32,i32)->(i32)", []),
  callee42: reviewed("(i32,i32,i32)->(i32)", []),
  callee43: reviewed("(i32,i32,i32)->(i32)", []),
  callee44: reviewed("(i32,i32,i32,i32,i32)->(i32)", []),
  callee45: reviewed("(i32)->(i32)", []),
} as const;

const MOVED_CALL_SITES: Readonly<Record<string, readonly (readonly [number, keyof typeof MOVED_CALLEES])[]>> = {
  "skill-scan": [
    [30, "callee01"], [63, "callee02"], [90, "callee02"], [117, "callee03"],
    [178, "callee04"], [199, "callee05"], [411, "callee06"], [606, "callee07"],
    [675, "callee08"], [724, "callee09"], [750, "callee10"], [858, "callee11"],
    [997, "callee08"], [1006, "callee12"], [1052, "callee10"],
  ],
  "equipment-scan": [
    [30, "callee01"], [63, "callee02"], [90, "callee02"], [117, "callee03"],
    [178, "callee04"], [199, "callee05"], [298, "callee13"], [432, "callee06"],
    [651, "callee07"], [733, "callee11"], [755, "callee07"], [825, "callee08"],
    [874, "callee09"], [900, "callee10"], [1015, "callee11"], [1195, "callee08"],
    [1204, "callee12"], [1250, "callee10"],
  ],
  "directory-sink": [
    [42, "callee11"], [102, "callee01"], [127, "callee02"], [170, "callee02"],
    [247, "callee14"], [273, "callee14"], [387, "callee15"], [402, "callee16"],
    [423, "callee17"], [479, "callee14"], [611, "callee18"], [653, "callee19"],
    [679, "callee02"], [705, "callee10"], [727, "callee10"], [770, "callee20"],
    [817, "callee21"], [853, "callee21"], [935, "callee21"], [1029, "callee22"],
    [1057, "callee23"], [1065, "callee24"], [1098, "callee20"], [1124, "callee10"],
  ],
  "screenshot-sink": [
    [53, "callee25"], [80, "callee01"], [107, "callee02"], [292, "callee19"],
    [317, "callee04"], [345, "callee02"], [375, "callee02"], [481, "callee15"],
    [496, "callee16"], [519, "callee17"], [681, "callee10"], [705, "callee11"],
    [740, "callee19"], [768, "callee02"], [787, "callee10"], [798, "callee26"],
    [812, "callee26"], [856, "callee27"], [881, "callee11"], [914, "callee11"],
    [940, "callee28"], [980, "callee29"], [991, "callee30"], [1021, "callee31"],
    [1041, "callee27"], [1066, "callee11"], [1097, "callee11"], [1126, "callee32"],
    [1152, "callee29"], [1162, "callee30"], [1170, "callee30"], [1209, "callee20"],
    [1229, "callee33"], [1269, "callee34"], [1319, "callee35"], [1343, "callee11"],
    [1353, "callee35"], [1361, "callee36"], [1378, "callee37"], [1395, "callee37"],
    [1433, "callee38"], [1454, "callee38"], [1460, "callee39"],
  ],
  "writer": [
    [65, "callee01"], [88, "callee02"], [111, "callee02"], [138, "callee03"],
    [155, "callee05"], [226, "callee22"], [251, "callee23"], [264, "callee24"],
    [286, "callee10"],
  ],
  "delete": [
    [9, "callee12"], [56, "callee11"], [149, "callee40"],
  ],
  "file-exists": [
    [44, "callee11"], [166, "callee41"], [186, "callee42"], [221, "callee43"],
    [251, "callee07"], [328, "callee44"],
  ],
  "screenshot-initializer": [
    [33, "callee34"], [76, "callee35"], [100, "callee11"], [110, "callee35"],
    [118, "callee36"], [128, "callee45"], [164, "callee26"], [181, "callee45"],
    [198, "callee37"], [208, "callee37"], [249, "callee38"], [263, "callee38"],
    [269, "callee39"], [298, "callee25"],
  ],
};

// Each generation adds the helper bodies its review accepted, keyed by
// `<role>@<call offset>` or `moved:<callee>`.
const generationBodies = perReviewedFacts((generations) => {
  const bodies = new Map<string, string[]>();
  for (const generation of generations) {
    for (const [key, hashes] of Object.entries(generation.facts?.templateCalleeBodies ?? {})) {
      bodies.set(key, [...bodies.get(key) ?? [], ...hashes]);
    }
  }
  return bodies;
});

export function normalizeTemplateCalleeCalls(
  view: TemplateSaveModuleView,
  local: number,
  role: string,
  normalized: Uint8Array,
): void {
  const reviewedBodies = generationBodies();
  const withGenerations = (witness: CalleeWitness, key: string): CalleeWitness => ({
    ...witness, bodyHashes: [...witness.bodyHashes, ...reviewedBodies.get(key) ?? []],
  });
  const witnesses: readonly CalleeWitness[] = [
    ...(CALL_WITNESSES[role] ?? []).map((witness) => withGenerations(witness, `${role}@${witness.offset}`)),
    ...(MOVED_CALL_SITES[role] ?? []).map(([offset, name]) =>
      withGenerations({ offset, ...MOVED_CALLEES[name] }, `moved:${name}`)),
  ];
  // Small synthetic locator fixtures have no production helper sites.
  if (witnesses.some(({ offset }) => offset + 6 > normalized.byteLength)) return;
  const calls = view.instructions(local).callSites;
  for (const [index, witness] of witnesses.entries()) {
    const site = [...calls].flatMap(([target, sites]) => sites
      .filter(({ offset }) => offset === witness.offset)
      .map((value) => ({ target, ...value })));
    if (site.length !== 1 || site[0]!.operandEnd !== witness.offset + 6) {
      throw new Error(`template-save recertify: ${role} helper call changed`);
    }
    const callee = site[0]!.target - view.importCount;
    if (!view.bodies[callee] || view.signatures[callee] !== witness.signature
      || reviewedBodyMatch(view.module, site[0]!.target, witness.bodyHashes) === null) {
      throw new Error(`template-save recertify: ${role} helper identity changed`);
    }
    normalized.fill(0, witness.offset + 1, witness.offset + 6);
    normalized[witness.offset + 1] = 64 + index;
  }
}
