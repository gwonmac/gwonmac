/**
 * Reviewed facts for one ArenaNet client generation. The November 3, 2026 client.
 * Runtime certification never grants a capability from these facts alone:
 * the isolated semantic verifier re-derives every fact from the bytes first.
 */
import type { ClientGeneration, GenerationFacts } from "./reviewed-facts.js";
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";

// November 3 facts: the October 22 record remapped by unique normalized
// function bodies and a conflict-free static-address map, then reviewed.
const BUILD: KnownEnhancementBuild = Object.freeze({
  sha256: "9e50eae9204aad6a8c5137cb18af23efe09296a94d92a994fa974716be9804d5",
  outputSha256: Object.freeze({
    "features-3fffff": "44d1f2bdc6cfac3a682fbfe2ef9a7b269651b1ba6450d80ae86a4e1b05986d7a",
    "features-01": "81c3764f8a26ae33ab2773c81d9b495f035f7cd983f82b10fc4588edaa423f3b",
    "features-e01": "37a2508693944622ac57e21f6cd31dc0829860120de0d17b69363642a8c90962",
    "features-601": "581c470c09446647648d36865ae09ca18eb81e5cc231b2168bc4434772a88be8",
    "features-200": "bf3fb5ce23379e1983c6690f25876c10cceeb76773da83f5ffab3e857b4a1d86",
    "features-202": "bb74453fb2f4d85fd544e444d9abc7472f26664ef31dde9365f6285031bccaa7",
    "features-284": "be1226cc42b6c8b58223746117aef09bf73bb30e81fd97e250bf0f5021c9bcba",
    "features-285": "6a80a1c459464e934da96c71899219bd90276ab558f7583472b751aaf49d270c",
    "features-270": "a8ff11bbb5b8298d1b35add9feb17b03f654078fbc8c0ed1aa171ee9aa605e21",
    "features-2fc": "d8a3ce9033909e00e6b11caaa2b048d0fff44b162bd5061176dec47aec3f8063",
    "features-c200": "2d68898e4ea8c54fafcd8c45ade19db9dac9f14af4c7640211fc54b589f973ad",
    "features-c204": "c12c93bc9e8f784e92e430cf0819c2ff8bd429bc7409f6427a421393dd8772cf",
  }),
  programId: 1,
  buildId: 0xb19f16fd,
  hookFunction: 447,
  hookParams: Object.freeze(["i32"] as const),
  hookResults: Object.freeze([] as const),
  hookBodySha256: "ef3d53487d8f2e553cc5248c4ad5207b343de8063a49ae06ab468f8bc5909ee5",
  tableSlot: 4682,
  cursorEvent: Object.freeze({
    functionIndex: 2470,
    params: Object.freeze(["i32", "i32", "i32", "i32", "i32"] as const),
    results: Object.freeze([] as const),
    tableSlot: 922,
    producerFunctions: Object.freeze([2829, 2835] as const),
    producerParams: Object.freeze([
      Object.freeze(["i32", "i32"] as const),
      Object.freeze(["i32", "i32"] as const),
    ] as const),
    producerResults: Object.freeze([
      Object.freeze(["i32"] as const),
      Object.freeze(["i32"] as const),
    ] as const),
    bodySha256: "f09a7a12954169ae595d12d870e69a4c0092003157d72523d626d2a3990241e2",
    producerBodySha256: Object.freeze(["d0765085b3f4240996aba6c0c579bcf26577ccd0e52a9e56a1a41ef473b2812e", "92285d228fa08d457cadccf50306c4926e253e3b7ef30d851183b34cd759e04f"] as const),
    tableNeighbourBodySha256: Object.freeze(["f09a7a12954169ae595d12d870e69a4c0092003157d72523d626d2a3990241e2", "cb751dd998dc5591fb1a8d05d08d194a8a7e4670b1a9685816b9a2af8fab7980"] as const),
    layout: Object.freeze({
      cursorActiveArt: 5921600,
      cursorSoftwareModel: 5921604,
      cursorShowCount: 5921608,
      cursorColorBuffer: 2740912,
      cursorArtHotspot: 0,
      cursorArtTexture: 12,
      cursorHandleKey: 8,
      cursorHandleObject: 0,
      cursorViewTexture: 8,
      cursorTextureType: 12,
      cursorTextureWidth: 20,
      cursorTextureHeight: 24,
    }),
  }),
  observationBase: Object.freeze({
    layout: Object.freeze({
      contextRoot: 5919552,
      gameContextSlot: 6,
      characterContext: 68,
      characterUuid: 100,
      mapId: 408,
      isExplorable: 412,
      currentMapId: 564,
      currentInstanceType: 572,
      playerNumber: 688,
      areaInfo: 1891376,
      areaInfoCount: 883,
      areaInfoStride: 124,
      areaInfoFlags: 16,
      agentArray: 5935816,
      agentId: 44,
      agentX: 116,
      agentY: 120,
      agentType: 156,
      agentPlayerNumber: 244,
      agentModelType: 246,
      worldContext: 44,
    }),
  }),
  playRegionObservation: Object.freeze({
    layout: Object.freeze({
      contextRoot: 5919552,
      gameContextSlot: 6,
      characterContext: 68,
      characterUuid: 100,
      mapId: 408,
      isExplorable: 412,
      currentMapId: 564,
      currentInstanceType: 572,
      playerNumber: 688,
      areaInfo: 1891376,
      areaInfoCount: 883,
      areaInfoStride: 124,
      areaInfoFlags: 16,
    }),
  }),
  targetObservation: Object.freeze({
    layout: Object.freeze({
      manualTargetAgentId: 5930428,
      automaticTargetAgentId: 5930424,
    }),
  }),
  uiDispatcher: Object.freeze({
    functionIndex: 6843,
    params: Object.freeze(["i32", "i32", "i32"] as const),
    results: Object.freeze([] as const),
    bodySha256: "807cfc0803e1c82289aa82fbfa97eeca7ae43d1f15eb8eb6284190fc6280d048",
    playerChatMessage: 268435586,
    hideHeroPanelMessage: 268435878,
    showHeroPanelMessage: 268435879,
  }),
  whisperChat: Object.freeze({
    functionIndex: 7880,
    params: Object.freeze(["i32", "i32"] as const),
    results: Object.freeze([] as const),
    bodySha256: "ece875d8de34f7d77a9d1c81ad17604c0318424fce3650e9aeeec8d842f632ac",
  }),
  resignAction: Object.freeze({
    functionIndex: 7880,
    params: Object.freeze(["i32", "i32"] as const),
    results: Object.freeze([] as const),
    bodySha256: "ece875d8de34f7d77a9d1c81ad17604c0318424fce3650e9aeeec8d842f632ac",
  }),
  gameThread: Object.freeze({
    drain: Object.freeze({
      functionIndex: 6662,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      tableSlot: 1722,
      bodySha256: "59bb16c4ae53f13f528d4220dbf1051dbe673dde25f7bc24610283efd63a706f",
    }),
  }),
  travelAction: Object.freeze({
    enqueueExport: "enhancement_travel",
    configureExport: "enhancement_configure_travel",
    toggleExport: "enhancement_take_travel_toggle",
    messageId: 268435846,
    producer: Object.freeze({
      functionIndex: 16197,
      params: Object.freeze(["i32", "i32", "i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "8b013b493f15ab654463a9099e9c7e61857f49641628941364001f4231eae9c8",
    }),
    contextResolver: Object.freeze({
      functionIndex: 11664,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "92e48d31b1612c5e3491afef89b943cc7ac2902dbdaad7cc63ca036ae5aa909f",
    }),
    unlockProof: Object.freeze({
      layout: Object.freeze({
        worldUnlockedMaps: 1548,
      }),
      accessor: Object.freeze({
        functionIndex: 9192,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "24579d9f602bc21a37c0dc8ca88c362a38493c64d101d42081ccd6ed5314f975",
      }),
      consumer: Object.freeze({
        functionIndex: 15976,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "2986b2bda4f3cf4e68d5137a64e51579a3f05b99a0f67384e2e4356e70e31a95",
      }),
    }),
    guildHall: Object.freeze({
      enqueueExport: "enhancement_guild_hall",
      enterMessageId: 268435843,
      leaveMessageId: 268435845,
      layout: Object.freeze({
        guildContextSlot: 15,
        guildHallKey: 100,
      }),
      keyAccessor: Object.freeze({
        functionIndex: 7965,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "f78d0067879c110a5269ab57eaab946525cbc0a7ba09ff02c150db94d5176598",
      }),
      areaTypeAccessor: Object.freeze({
        functionIndex: 9543,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "e648aa327d0a0e4e4667950191f2353c672cb2ce760e2e12f670fbcb52d0574b",
      }),
      producer: Object.freeze({
        functionIndex: 15452,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "3563511b7223799d3cd47d4cc508f59fa540ba5752830c4133a76a26a33a70b0",
      }),
    }),
  }),
  xunlaiAction: Object.freeze({
    openExport: "enhancement_open_storage",
    configureExport: "enhancement_configure_storage",
    accessProof: Object.freeze({
      layout: Object.freeze({
        worldPlayers: 2060,
        playerRecordStride: 80,
        playerRecordAgentId: 0,
        playerRecordAccessFlags: 52,
        playerRecordNumber: 56,
        areaInfoType: 8,
      }),
      readers: Object.freeze({
        "agent-id": Object.freeze({
          functionIndex: 8946,
          params: Object.freeze(["i32"] as const),
          results: Object.freeze(["i32"] as const),
          bodySha256: "da8365ce34f07598914f95a25a4116c557400b8780aff339888fe4e40e726080",
        }),
        "access-flags": Object.freeze({
          functionIndex: 9204,
          params: Object.freeze(["i32"] as const),
          results: Object.freeze(["i32"] as const),
          bodySha256: "f4eb37c4446d7da8a9c2cd8db33a78dc4119dbea73bed8c7407be2c05ee7b1fc",
        }),
        "player-number": Object.freeze({
          functionIndex: 9213,
          params: Object.freeze(["i32"] as const),
          results: Object.freeze(["i32"] as const),
          bodySha256: "cc537ef1cde70210dabc954411d91ea0efb3c6b62c6d13fda630ae1f156e57c7",
        }),
      }),
    }),
    handler: Object.freeze({
      functionIndex: 8985,
      params: Object.freeze(["i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "505da78cc9da1205377fae99f0455a8277bd2b7f48437008cce93fc108ae808e",
    }),
  }),
  chatAliases: Object.freeze({
    parser: Object.freeze({
      functionIndex: 13685,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "8587121e8416dc131fc51b4946d7bb5eb99c05816338db25567711865be2316e",
    }),
  }),
  chatFiltering: Object.freeze({
    writeToChatLogMessage: 268435583,
    packetChannelOffset: 0,
    packetMessageOffset: 4,
    allyDropTemplate: 2033,
    numericSegment: 271,
    encodedNumberBase: 256,
    playerNameToken: 2985,
    encodedStringStart: 263,
    encodedStringEnd: 1,
    maxPlayerNameUnits: 20,
    currentPlayerNameOffset: 116,
    systemPrefix: 33026,
    hallOfHeroesTemplate: 8763,
    titleTemplates: Object.freeze([5187, 9186, 9189, 9190] as const),
    producer: Object.freeze({
      functionIndex: 7885,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "d091ac01f1deb79f9b8b4960fb8445fd307b97a54fccfe6f69428790cde88ab2",
    }),
  }),
  // Each accessor returns `WorldContext + offset` (or a stride-indexed row),
  // so its exact body is the proof of the layout word beside it. The four
  // AreaInfo row fields were checked against Kamadan, Kaineng Center and
  // Embark Beach and ride on the AreaInfo accessor's stride and bound.
  progressObservation: Object.freeze({
    layout: Object.freeze({
      worldMissionsCompleted: 0x5cc,
      worldMissionsBonus: 0x5dc,
      worldMissionsCompletedHm: 0x5ec,
      worldMissionsBonusHm: 0x5fc,
      worldVanquishedAreas: 0x83c,
      worldTitles: 0x81c,
      titleStride: 0x2c,
      titleProps: 0,
      titlePoints: 4,
      areaInfoThumbnail: 0x14,
      areaInfoX: 0x40,
      areaInfoY: 0x44,
      areaInfoName: 0x74,
      areaInfoIcon: 0x48,
    }),
    accessors: Object.freeze({
      missionsCompleted: Object.freeze({
        functionIndex: 9190,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "55083539f7b4cc9735798476c6f1f41132a880f05fe0f80735c3d88df24a5fb4",
      }),
      missionsBonus: Object.freeze({
        functionIndex: 9191,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "b2c8c1c5c29e3d65ee2146c6188a3b424edf312b1aa0f09a33bde70882553835",
      }),
      missionsCompletedHm: Object.freeze({
        functionIndex: 9187,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "9f2fc258978975797eaaea36847eca28e5cea7b301acd36e9c3b49e3659909c9",
      }),
      missionsBonusHm: Object.freeze({
        functionIndex: 9188,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "2400ea801789bf303891d69663d1ddd898ca9f40edb34bd0902af7e9a924244d",
      }),
      vanquishedAreas: Object.freeze({
        functionIndex: 9193,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "2156f57faba6be2669bd8eef6742a4f03e97c11f54fef48ce6551a5c364637d0",
      }),
      titlePoints: Object.freeze({
        functionIndex: 9308,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "a5c1bba06bf15728f177f452f266184ae622085f78ad344baed6c3e5a7133bc6",
      }),
      areaInfo: Object.freeze({
        functionIndex: 17523,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "8a03004d07d4ee46451ba57d61dc246fa32aa1d54639c6aad6c36653f32c55be",
      }),
    }),
    // The client's active-quest lookup: it binary-searches the 52-byte quest
    // records for WorldContext's active quest id and copies the marker x, y
    // (+inf without a marker) and the destination map, so its body proves the
    // whole quest layout. R108 found it on October 22; GWCA Quest.h (e1bc303)
    // names the same offsets.
    quest: Object.freeze({
      layout: Object.freeze({
        worldActiveQuestId: 0x528,
        worldQuestLog: 0x52c,
        questStride: 0x34,
        questMarker: 0x18,
        questMapTo: 0x28,
      }),
      lookup: Object.freeze({
        functionIndex: 9154,
        params: Object.freeze(["i32", "i32", "i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "b430a9b43f474d825473287a8327f81ec82ba9c464d00e61d17d2c64f3e00031",
      }),
    }),
  }),
  // The producer's `chat.valid-message` call (TextValidateCoded). Local chat
  // lines call it first: the producer asserts on any line it rejects.
  chatPrint: Object.freeze({
    validator: Object.freeze({
      functionIndex: 5882,
      params: Object.freeze(["i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "5caccbd29c47d0b4b21773363d1ae25a5677d6a4a249d5dfdee580958c834e6b",
    }),
  }),
  partyObservation: Object.freeze({
    partyDirtyMessages: Object.freeze([268435512, 268435513, 268435596, 268435608, 268435650, 268435729, 268435743, 268435744, 268435749, 268435751] as const),
    playerChatProducer: 8954,
    playerChatSites: 3,
    nearbyPlayerMessages: Object.freeze([268435583, 268435584] as const),
    nearbyPlayerMessageProducers: Object.freeze([7885, 8952] as const),
    layout: Object.freeze({
      partyContext: 76,
      playerParty: 84,
      partyHeroes: 36,
      heroMemberStride: 24,
      heroAgentId: 0,
      heroOwnerPlayerId: 4,
      heroId: 8,
      heroLevel: 20,
      partyPlayers: 4,
      partyHenchmen: 20,
      partyFlag: 20,
      accountContextSlot: 10,
      accountUnlockedSkills: 292,
      worldHeroFlags: 1412,
      heroFlagStride: 36,
      flagHeroId: 0,
      flagAgentId: 4,
      flagBehavior: 12,
      worldHeroInfo: 1428,
      heroInfoStride: 156,
      infoHeroId: 0,
      infoAgentId: 4,
      infoLevel: 8,
      infoPrimary: 12,
      infoSecondary: 16,
      infoAppearanceBitmap: 72,
      worldAttributes: 172,
      attributeStride: 1084,
      attributeAgentId: 0,
      attributeEntries: 4,
      attributeEntryStride: 20,
      attributeEntryId: 0,
      attributeEntryRank: 4,
      worldProfessionStates: 1724,
      professionStateStride: 20,
      worldCharacterSkills: 1808,
    }),
  }),
  preGameControls: Object.freeze({
    characterSwitchAction: Object.freeze({
      enqueueExport: "enhancement_character_action",
      configureExport: "enhancement_configure_character_action",
      logoutMessageId: 268435613,
      frameDispatchOffset: 168,
      frameChild: Object.freeze({
        functionIndex: 6797,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "e685be64793b92276bb35b667c0b80fcec14025fd834a4a4c4e83b5fbb89729c",
      }),
      frameParent: Object.freeze({
        functionIndex: 6798,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "5c903f02d97e7039ced8d5c4b1c7babd88de27bacf1659b86df96a17255cfae8",
      }),
      frameResolver: Object.freeze({
        functionIndex: 6535,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "4cba034e1e172a61e2fecbe50655b929568b4b6d316073338b376ce5690ae8e7",
      }),
      frameDispatch: Object.freeze({
        functionIndex: 6509,
        params: Object.freeze(["i32", "i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "a1ec2678e5a4610b2680ddd33766a053a6e60207ca974f7f40393aa2a92b787a",
      }),
      logoutProducer: Object.freeze({
        functionIndex: 12441,
        params: Object.freeze(["i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "315a494b6555a9b812c3b7f1d79fe03cdd021d9a0debde7d8554e880a4b8bd7d",
      }),
    }),
    characterListLayout: Object.freeze({
      characterArrayPointer: 5939080,
      characterArrayCount: 5939088,
      selectedCharacterName: 5939456,
    }),
    hashFunction: Object.freeze({
      functionIndex: 366,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "b8ede3a030d6dbe916834d24b05d2a1d1e90c77bbf992e38ecfef314f36a328c",
    }),
    labels: Object.freeze({
      play: 1532278,
      selector: 1532500,
      yes: 1533192,
      no: 1533206,
      reconnectDialog: 1533274,
    }),
    labelHashes: Object.freeze({
      play: 184818986,
      selector: 828467986,
      yes: 1398610279,
      no: 3600335809,
      reconnectDialog: 4200678686,
    }),
    layout: Object.freeze({
      frameArray: 5924028,
      frameCount: 5924036,
      frameBytes: 456,
      frameChildOffsetId: 184,
      frameId: 188,
      frameHashId: 308,
      frameRelation: 296,
      frameState: 396,
      contextRoot: 5919552,
      gameContextSlot: 6,
      characterContext: 68,
      characterUuid: 100,
      currentInstanceType: 572,
    }),
  }),
  quickItemMove: Object.freeze({
    moveItemMessageId: 268435890,
    configureExport: "enhancement_configure_quick_item_move",
    modifierExport: "enhancement_quick_item_move_modifiers",
    inventorySlot: Object.freeze({
      functionIndex: 14934,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "dee8016ffdc8ae0903116f9452c847317ba7e6da2e3647b72d3f2bf79b63aef8",
    }),
    materialStorageSlot: Object.freeze({
      functionIndex: 14972,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "0428ae5c52c81b8335b03d591f2d379f637df339abfece497aaa345373490404",
    }),
    numberPreference: Object.freeze({
      functionIndex: 10819,
      params: Object.freeze(["i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "f7abfedeef22ca266f67334ba3fb337c815ffb48a969347097a9d16eef739b26",
    }),
    moveItem: Object.freeze({
      functionIndex: 13616,
      params: Object.freeze(["i32", "i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "bec6f257fbbe8af950b00b7df84b1ba162bb62c87f33ed575b72916f67eee7ca",
    }),
    timer: Object.freeze({
      functionIndex: 249,
      params: Object.freeze([] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "e7a7adeb46c24e4f889e39042d025795a1b801fc854e7058208e5e272f14c8c6",
    }),
    storageFrameHash: 2315448754,
    tradeCartFrameHash: 1928795935,
    tradeDialogFrameHash: 3198579276,
  }),
  playerEffectObservation: Object.freeze({
    accessors: Object.freeze([
      Object.freeze({
        functionIndex: 8912,
        params: Object.freeze(["i32", "i32", "i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "f4c17bb7fb0bc0bb9a06973c06a963ef2fe93d1c35231630b0695f6c172ea202",
      }),
      Object.freeze({
        functionIndex: 8913,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "2f4ff4d5219da4d88211c0f133ad01c1aedfab1fc135f8501b5969feb36607b2",
      }),
      Object.freeze({
        functionIndex: 8914,
        params: Object.freeze(["i32", "i32", "i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "a560a223d9756fc3579f057137601853ec23c2b6bbd57248216b77ce550d29af",
      }),
      Object.freeze({
        functionIndex: 8915,
        params: Object.freeze(["i32", "i32", "i32", "i32", "f32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "6855a6e32260141c19dc6254dde29416a22a749f3ceaf30915ebf1d6b0d4387c",
      }),
      Object.freeze({
        functionIndex: 8916,
        params: Object.freeze(["i32", "i32", "i32", "f32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "0d5710dd6b45cd590a4cbad35cc7cfe1ef8c123566c91b36d252386d7d72c2f2",
      }),
      Object.freeze({
        functionIndex: 8917,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "d6cf9fdadb6b0dbb118f080bfa319be92abc941df93f17606a732d8ca69943fa",
      }),
    ] as const),
    mutations: Object.freeze({
      addTimed: Object.freeze({
        functionIndex: 7211,
        bodySha256: "6c88594d54694899dc3ba794cbc20766cb09818bcd1313b195c23e348f6d2a06",
      }),
      renewTimed: Object.freeze({
        functionIndex: 7212,
        bodySha256: "eeb5dbaafe38feff1f204a88097fee908fba36ae427ba10cb18c319aa2ee30f4",
      }),
      remove: Object.freeze({
        functionIndex: 7213,
        bodySha256: "c09646cce2a296f5a031d9e919fa799285c371c3e9546484a390b9c5c0f4d0c1",
      }),
    }),
    timer: Object.freeze({
      functionIndex: 249,
      params: Object.freeze([] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "e7a7adeb46c24e4f889e39042d025795a1b801fc854e7058208e5e272f14c8c6",
    }),
    dirtyMessages: Object.freeze([268435541, 268435542, 268435543, 268435778] as const),
    layout: Object.freeze({
      worldPartyEffects: 1288,
      agentEffectsStride: 36,
      agentEffectsAgentId: 0,
      agentEffectsEffects: 20,
      effectStride: 24,
      effectSkillId: 0,
      effectAttributeLevel: 4,
      effectId: 8,
      effectMaintainerAgentId: 12,
      effectDuration: 16,
      effectTimestamp: 20,
    }),
  }),
  effectIconGeometry: Object.freeze({
    frameHash: 1726357791,
    initializer: Object.freeze({
      functionIndex: 14257,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "9e2f337f5dac54398615ea2e1f8be49edb450b147558b6046404560e897948dd",
      constructorCallOperand: 168,
    }),
    constructor: Object.freeze({
      functionIndex: 6677,
      params: Object.freeze(["i32", "i32", "i32", "i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "f689546c7e21ec5b0ef42bd806f4714e7a30b1b33220bc6e016903bae196064a",
    }),
    childBuilder: Object.freeze({
      functionIndex: 14285,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "cb2351264724c96192d923cfaf5b1894c366feeff58de8dc75775ba8d40f84f5",
      childOffset: 4,
    }),
    layout: Object.freeze({
      frameArray: 5924028,
      frameCount: 5924036,
      frameBytes: 456,
      frameChildOffsetId: 184,
      frameId: 188,
      framePositionFlags: 216,
      frameViewportWidth: 260,
      frameViewportHeight: 264,
      frameScreenLeft: 268,
      frameScreenBottom: 272,
      frameScreenRight: 276,
      frameScreenTop: 280,
      frameRelation: 296,
      frameState: 396,
    }),
  }),
  alcoholObservation: Object.freeze({
    functionIndex: 8964,
    params: Object.freeze(["i32", "i32"] as const),
    results: Object.freeze([] as const),
    bodySha256: "52b5aaa096cab224944166dd7a7f665003cfeff2e946c35da3d0cb81408956c7",
  }),
  nativeHudRendering: Object.freeze({
    functionBodies: Object.freeze([
      Object.freeze([13173, "3bbc822c71a47f8f19a4cc9cc4cef189df261a47fc859c7e9521dd2eb536763d"] as const),
      Object.freeze([13136, "df2d57f0dce7810ef896c520d05b4d42344ddd9e37912a81a869786c1cb06ba2"] as const),
      Object.freeze([6584, "fd3d40f1b25ee6eda8dce279db1a32953e18c1bf7318bb690658c41354f5218f"] as const),
      Object.freeze([6450, "6916aa4460da4f8daf943da674f1ed5723c5438f40dd5d7935e4ca23984730e8"] as const),
      Object.freeze([6598, "f23e956b8fcb72a5a05877690c69bed18e42bd358590433f5f182701b226f044"] as const),
      Object.freeze([6585, "123fcdb86adbe4c88d450254420146d6b8dabb8b1ccd1320f3e938221849e397"] as const),
      Object.freeze([14076, "22aaeda8b66592b6303ccd0466ea36e9a271d62ee831c49eeb16885c485cba2c"] as const),
      Object.freeze([1554, "034910086d195f29148b9357f7657b6ebd5c64d1bf95c9a1997551209e307b2e"] as const),
      Object.freeze([1572, "25671de11910c9bb0178497a25e75b3a4c6a54d2f972d251b63e2f29fadb2109"] as const),
      Object.freeze([6446, "66782f51d85ccfa80793fe0e99034244ca856cd78511638df8cb159cdb573997"] as const),
      Object.freeze([6447, "46e423238f12da05654400fd44ee7dd27c113845407ceb969b9b27ea6bf4805e"] as const),
      Object.freeze([1563, "d53047d0f2c7e92ef20d58312ec6c5d11d0291766aaf539664f60d96b27bb46f"] as const),
      Object.freeze([6488, "e446fc9b6f0557a10b02fd6bf3dcdf21c684b695d79b0964445a7646bb482680"] as const),
      Object.freeze([6492, "57974d4547c2931412c686c03ed73810688a1608b290e47fff10a717eaf6a87d"] as const),
      Object.freeze([6490, "89094ccffaf91259cc442fc78e4989157f9ac1916421ca5f3af7ce6f0c5d0a6a"] as const),
      Object.freeze([6593, "fd9a3a63443292ecb8ede9746eef83fa10d30dfc88a443f963e35a9b8bce3a0d"] as const),
      Object.freeze([5595, "75ce03879fcbcaee3e0f225ceeb4d56ee2cb6462716ccf73c22abdac9a8254b5"] as const),
      Object.freeze([1569, "a032a1d123be8dea68f425b063665c5bbfe56957de88214572fc3fcfc94b3b81"] as const),
      Object.freeze([1579, "458c24c2997da50bbf039661661f634ce1b3dec4db7ce5efafd10e67b0c328e4"] as const),
      Object.freeze([1559, "2fd7490ab39967f63dea682590c2dbb7efdeca56745228a42becec9e951e3d05"] as const),
      Object.freeze([1444, "0c9d80366576b62a2292874a98d887363d5a8ee0de63c77dff7abcdb03ef8c1e"] as const),
      Object.freeze([1445, "d02167e498f0239edd4fcbc7eb24eea9d0c4ebd1d3e74606a100d9680a9d3cff"] as const),
      Object.freeze([1446, "84a0bdad74c997be930d40cc13a660c841b2b54ec8635ff675bf5c8b498ae619"] as const),
      Object.freeze([1448, "23ef37d7d7ba501fbf2d33da13999609f5cbfeff98fe3a8849c0c6cd8d1fb609"] as const),
      Object.freeze([1449, "738df6d2b288a8f11512ab504f499103fe27e18b29e6d5f2015a879aa3641981"] as const),
      Object.freeze([2249, "3215f76fea3575263a5c0a55d37e48299f38c00196e1ba6145ced3b1e526f43a"] as const),
      Object.freeze([3137, "bd67560da9e5d593a401bd80ed0d14309788375f501dc2a2f29585d78e1d82b1"] as const),
      Object.freeze([748, "ea76feee7b569ef8efb821578b9daa35596f90a8ed002acc77b93df62440d0fe"] as const),
      Object.freeze([1333, "591a0df00c5b820fdba23ee622c2ead65cf27be2942bedf891c328f1b20c84f3"] as const),
      Object.freeze([1334, "244f37d817ffa8948380fddd1646df33b59100e85e50db2e4a917e0123a5f0bf"] as const),
      Object.freeze([1357, "114f27084df400549c52165b97c41f190f498b4150492c34d72407b8612c678d"] as const),
      Object.freeze([264, "3830c5c32eaf8b6065c7aa6ceda30b76ac731d8e513c505c16a5e5e95813e9b8"] as const),
      Object.freeze([2922, "dc227e6ec361b5a3b6915f7077eb24599d881436b7975f94147e222dd9de16e5"] as const),
      Object.freeze([2902, "148db22d2c7d9a287148f85a001b51dfa4eaefc98c0aaf92a2d6120cc303397d"] as const),
      Object.freeze([750, "adbba34c96c4a33047dbac1fa875c6d5af740ad26bc969517576134676f18b6e"] as const),
      Object.freeze([1532, "d04aadc21c7a35ba1376ae6d437dc5a4bf891f2762a364e3e61ac61278e01408"] as const),
    ] as const),
  }),
  playerSkillbarObservation: Object.freeze({
    worldLifecycle: Object.freeze({
      functionIndex: 8819,
      params: Object.freeze(["i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "1ad83f4a0cf5e5009d3816903cffc45413c0ca0c730cab010d8cd3d6265495e9",
    }),
    update: Object.freeze({
      functionIndex: 8705,
      params: Object.freeze([] as const),
      results: Object.freeze([] as const),
      bodySha256: "becb14b7b1e31afe55534f0f6fd824fa72b11a013fc0ec8d97bebb0e0a8b4270",
    }),
    rowReader: Object.freeze({
      functionIndex: 8708,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "7b8b5c65a126fae2edfa517a4706244a0d2352c628fde208d049ecf82dfa4e72",
    }),
    slotReader: Object.freeze({
      functionIndex: 8709,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "ee41be1f4dcaf8e5822fc024e41cbbad74cf293cdafb2b89a8691aeb680e68b5",
    }),
    coreLayout: Object.freeze({
      worldSkillbars: 1776,
      skillbarStride: 188,
      skillbarAgentId: 0,
      skillbarSkills: 4,
      skillSlotStride: 20,
    }),
    partyLayout: Object.freeze({
      skillSlotId: 12,
      skillbarDisabled: 164,
    }),
  }),
  teamApply: Object.freeze({
    thunkExport: "enhancement_command",
    professionTrace: Object.freeze({
      readerExport: "enhancement_profession_trace",
      sender: Object.freeze({
        functionIndex: 5952,
        params: Object.freeze(["i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "abf87594500c150dedce8bb8933eeae779cbf072acd18f5564792ba4c38f0ec3",
      }),
    }),
    entries: Object.freeze([
      Object.freeze({
        opcode: 31,
        functionIndex: 6888,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "73e95e6d756dcc6f96918351588817615c4f3a0b3d4a465072270ae37e173487",
        label: "CharMsgSendHeroDeactivate(heroId)",
      }),
      Object.freeze({
        opcode: 30,
        functionIndex: 6887,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "785932c00f2205489caccd14848aee2f51ba59a2caf6bf13aaef96101f797ddb",
        label: "CharMsgSendHeroActivate(heroId)",
      }),
      Object.freeze({
        opcode: 21,
        functionIndex: 6879,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "b017a6623aeb0b752e777116733dcfeb7360e040121927354313266c4cf69335",
        label: "CharMsgSendCommandAiMode(agentId, behavior)",
      }),
      Object.freeze({
        opcode: 93,
        functionIndex: 6944,
        params: Object.freeze(["i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "3b4464331813947b0af3848328cfaeecfd5f3c533df27ca30230274c01f43dcd",
        label: "skillbar set (agentId, count, skills[])",
      }),
      Object.freeze({
        opcode: 65,
        functionIndex: 6918,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "197a6eb41fb2c136e835c489d5270642057fb545124f75ff52fb9e7b7962d0c4",
        label: "CharMsgSendOrderSetProfessionSecondary(agentId, profession)",
      }),
      Object.freeze({
        opcode: 16,
        functionIndex: 6874,
        params: Object.freeze(["i32", "i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "af6ce61aa83ffc7e4ba109750c573a625a24158e044110271c0981bbeade845f",
        label: "attributes set (agentId, count, ids[], ranks[])",
      }),
      Object.freeze({
        opcode: 155,
        functionIndex: 10662,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "6a84051c7c079e45b567eabc79e0df368b43d21ee4f8ec1b143cf2933afca209",
        label: "CharMsgSendSetHardMode(enabled)",
      }),
    ] as const),
  }),
  skillSlotGeometry: Object.freeze({
    initializer: Object.freeze({
      functionIndex: 15741,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "403a318ba671af0d5d5624c6ba7dde998fb94621f701b9c54ac8b70d4810ef16",
      constructorCallOperand: 2157,
    }),
    constructor: Object.freeze({
      functionIndex: 6677,
      params: Object.freeze(["i32", "i32", "i32", "i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "f689546c7e21ec5b0ef42bd806f4714e7a30b1b33220bc6e016903bae196064a",
    }),
    labelAddress: 1599914,
    layout: Object.freeze({
      frameArray: 5924028,
      frameCount: 5924036,
      frameBytes: 456,
      frameChildOffsetId: 184,
      frameId: 188,
      framePositionFlags: 216,
      frameViewportWidth: 260,
      frameViewportHeight: 264,
      frameScreenLeft: 268,
      frameScreenBottom: 272,
      frameScreenRight: 276,
      frameScreenTop: 280,
      frameRelation: 296,
      frameState: 396,
    }),
  }),
  skillCooldownObservation: Object.freeze({
    reader: Object.freeze({
      functionIndex: 8711,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "0341e9436e95c6befbc7e05cc0ba79dec9cd04af144783d7e39909207425efc2",
      timerCallOperand: 200,
    }),
    timer: Object.freeze({
      functionIndex: 249,
      params: Object.freeze([] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "e7a7adeb46c24e4f889e39042d025795a1b801fc854e7058208e5e272f14c8c6",
    }),
    layout: Object.freeze({
      skillSlotRecharge: 8,
    }),
  }),
});

// Written by `certification reviewed-identities` on this client, less the
// entries an older generation already lists: each reviewed body digest or role
// fingerprint that matched here exactly, with the relocation identity of the
// body it matched.
const IDENTITIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "013beb33a62a8148261e2a67f657f9b2e02bb618136dc62621831f68f6f3bce0":
    ["2ff5607595b18fafeea320ae1076a9850bce9a961cc86a461ea8e03542c4f50b"],
  "034910086d195f29148b9357f7657b6ebd5c64d1bf95c9a1997551209e307b2e":
    ["3e2a2113fca4a5aa7c597425a3d36731d7307a295dfd31226a5c0fc4016f45d0"],
  "0428ae5c52c81b8335b03d591f2d379f637df339abfece497aaa345373490404":
    ["01b1ed90e1edf24375dab1a7c128c4cd4335066f4d710d5d2accbc8e06f7dc6f"],
  "04aeae48a5e6dd724c95f312c65354b2f434cf1ed67d008bf2f667d57cb52fb1":
    ["b5fcf482b465aab30ccd171a99ce1fd60bf8669b2813a8492535744ab7cd8397"],
  "06c0e7ea8532c1ac11c1a0909ea07d6471108d688d94f49c38fccdf45d2968f7":
    ["cee7a410703bc755f2f2c9cb33e0cead8b2790810990c9a2b96fd302cda9dbdb"],
  "0a09c613c93d32df6a0418bc0f253fb8f7358686da92c74ecca515d5302d9e16":
    ["288645520904d58c261ec8715d63f5e80698dde33f97ccf981b8fe0ad7ebc8b5"],
  "0c9d80366576b62a2292874a98d887363d5a8ee0de63c77dff7abcdb03ef8c1e":
    ["64852f5c2ddb5943ee9c53b82595f365140efcd3d98173c95b60f6c1626b734b"],
  "0d5710dd6b45cd590a4cbad35cc7cfe1ef8c123566c91b36d252386d7d72c2f2":
    ["8d92db018216ed702e37826b3f8c3bec27a8618b878d0d24fd32cf2ce80d2c98"],
  "114f27084df400549c52165b97c41f190f498b4150492c34d72407b8612c678d":
    ["0cf49876e56aca6a87a5f91e2d67cf42c6a8f64446ac32266823b51a596b8784"],
  "123fcdb86adbe4c88d450254420146d6b8dabb8b1ccd1320f3e938221849e397":
    ["948fb38c2784a96aac428bf4e241c240230fdb9965401f24bdcb8ffe578c6b57"],
  "148db22d2c7d9a287148f85a001b51dfa4eaefc98c0aaf92a2d6120cc303397d":
    ["79c5f1124476e87ebe358c0107fd8c59a4865e6d53d34d9c69f99156b9066216"],
  "217c7e3c872095c053b651adc245e4bc50dda03d5a120938b4a427b62dfacaa4":
    ["c28d2ef345da8551b0744ac31f79e106e62efcda991c21ba62827c6b8a239266"],
  "2241b6c2c774a5bf31ccc43cf112ebbc7aa061870dfff34a457652e3d47ded55":
    ["d6813f236348c065757d08142b9cd9a26cbc176c52375e6dded8cd0125651f18"],
  "22aaeda8b66592b6303ccd0466ea36e9a271d62ee831c49eeb16885c485cba2c":
    ["5283c89f061b5d3930b79ad43c950331c7502ee98b194ce289d665aa5617983a"],
  "23ef37d7d7ba501fbf2d33da13999609f5cbfeff98fe3a8849c0c6cd8d1fb609":
    ["8ce94c9e58bf17a9159dc4908d6a3caa00341f3029a525c8e97ca12147d59d3a"],
  "244f37d817ffa8948380fddd1646df33b59100e85e50db2e4a917e0123a5f0bf":
    ["0109a32ef6487ea2b983da104370ea96be50a9abd1397792a9245f0114371537"],
  "25671de11910c9bb0178497a25e75b3a4c6a54d2f972d251b63e2f29fadb2109":
    ["d9e04f19238346b2a664cd3941b2be84bdde378714028efa81361a4177d669e2"],
  "2a91d529aa19c39b435491b4567896663bcd99cfea4b16b98d36bc80ef80ea60":
    ["b1576c485ad2e0286122cf366efed176fdf78fb2ec3919b07653c559f2a0da1b"],
  "2c91f376bb30a4cbea12f9557b1e274f993d3e6f008698e3019ee5e9c851554b":
    ["be00b30ae93deb293d96cb9de53d0169d50554054304735d5d9ef60c8047a3e6"],
  "2f4ff4d5219da4d88211c0f133ad01c1aedfab1fc135f8501b5969feb36607b2":
    ["0455cc0d0e80ada2479713c5ab0f027afc3267bfd0475bf1f5b087b8dc597568"],
  "2fd7490ab39967f63dea682590c2dbb7efdeca56745228a42becec9e951e3d05":
    ["3cf03d7503fe42cb85f212e84a177e78686bbc1398edb0802fa4930ec93f84eb"],
  "3215f76fea3575263a5c0a55d37e48299f38c00196e1ba6145ced3b1e526f43a":
    ["64c6741a74c74cf0fff7cfa3dfd00ce7eb1fa1ffafee0f4b5c8c65d74a38d507"],
  "3830c5c32eaf8b6065c7aa6ceda30b76ac731d8e513c505c16a5e5e95813e9b8":
    ["449d14574298b5d9128c6d4a8cb659d38bb89166b10d7e9b3bf299d8380d7a60"],
  "3bbc822c71a47f8f19a4cc9cc4cef189df261a47fc859c7e9521dd2eb536763d":
    ["ecf94366a6eddb5e78065ffcffa8ee26f64136fbc78bb34bac87d78bf3bf36da"],
  "40389b68860c884753ef1fd10af52165f7a2a8457611cb33bf68c8077dba0403":
    ["81878849e725a425039f0bd1110285075198a721b05932d0d463a2e5cb1c4192"],
  "420c3f943c09e0008cfc4d7cefd9890df677ca38343bb1770bf6eeb38d80898b":
    ["b6159272b05c91150ff9c337ebc8352c28cd3d869ecfe885d80d1b69aff12394"],
  "458c24c2997da50bbf039661661f634ce1b3dec4db7ce5efafd10e67b0c328e4":
    ["7851a09c10c50be990c928fe708b4c327a9d73cdb59f8dac807c4bda90577258"],
  "46e423238f12da05654400fd44ee7dd27c113845407ceb969b9b27ea6bf4805e":
    ["080bf7b418f0bb8da6a067a909173ae1288cbfb1249604d63357aa5ffbca1b96"],
  "47b690af00d5ba4191961b5f8eb4e55a40b08cfdd0439a2017b8a6dc69b2afe1":
    ["c0cf967d81a38315f171a7aa8b46aef98307361a22cab07f12f4f12493d17e73"],
  "49739e00e0cd0517475e53a4dfabd88c7c559b77f8943de5144c19412830aeb0":
    ["5209f3b6992c4cbbaea4c5440acfc63a39ed814e7844cc23bfd17639688a1657"],
  "4d3d76ce224db9ada9ffdf70b31e5d2fdc0b16e6e2ab2bad9f2a1d98600690c2":
    ["1c17a82e0f0ea622646fb812d17b689891b5ab959f3c114704b2edda11685356"],
  "4e396c79daa5e7cda8b63cf8bdc22466e791bfeb7b3784749efbfed29a177321":
    ["41b329f3d01e85baeeb28259af86deac2e0e800d8b1842c6105a5da7fd324812"],
  "4f5e46e89797a30c4270945ae2f5dbb0e601035a702523946e7603c995fc06cc":
    ["da15d36e7a5524d573f3b0fbc5abdce52c728c11a53dadb11044bb4801442f66"],
  "57974d4547c2931412c686c03ed73810688a1608b290e47fff10a717eaf6a87d":
    ["9c7c017d15e3ff2604f79676cd5250074283d6a25d07d434d4a336556af5e3bc"],
  "583c263546baf00180e27fe15d08e79e2f37e9b2b84d65d64f017e2078901fd5":
    ["f6e560c11c6c9c8de4eb24c0088e6efc9d0b972060caabf19a82ed62d113ad06"],
  "591a0df00c5b820fdba23ee622c2ead65cf27be2942bedf891c328f1b20c84f3":
    ["b9b44fa3ff0c3023555e9ccae5964a86e3a1bf44c882149e9f3e44af4aa7411b"],
  "5caccbd29c47d0b4b21773363d1ae25a5677d6a4a249d5dfdee580958c834e6b":
    ["4f801dae00b6aa67f7472af909fc48dea2f9a3b0b17400ffae74f8d533b64abc"],
  "6226350aead9ae0f1e94c6baf4810da2dc68f254cfc8884dc2914cf2fcfa4e03":
    ["e69b1aaea4dac75066330f3586467a36a3415914f37c975ae0d052708c9cc037"],
  "66782f51d85ccfa80793fe0e99034244ca856cd78511638df8cb159cdb573997":
    ["93bf9c6b16d5b26c6424eb2ff836855f6a1095060431502797ead99f3676f446"],
  "6855a6e32260141c19dc6254dde29416a22a749f3ceaf30915ebf1d6b0d4387c":
    ["5c8768c6c1c9126725b399229afce79ed4b10b14bfbd3730490889c4b563cdd1"],
  "6916aa4460da4f8daf943da674f1ed5723c5438f40dd5d7935e4ca23984730e8":
    ["60e5e7dabca9f412f5e55dcbb8e17287d5ce9218b3e8daeb6a423d472df02bb9"],
  "6c88594d54694899dc3ba794cbc20766cb09818bcd1313b195c23e348f6d2a06":
    ["0efd1693e5415d79df8dce566b3a4fd0ac56eb41e73ec99fee11e65ac6e5b57e"],
  "6d0cb22b41929e6cf0f18029da42efd235152b1584c0709328bf82b5d8a9f1a6":
    ["6f98d276dad729bda0ea08329710ead1d98ecac279735c8aadd0a3b10f9493ba"],
  "6dd186f0b33dbd772c06a45d53cb94c9aa8668b1b890ecb1cb4944c02bcf458c":
    ["dd532266181dc6e9c316904a8b76bfd6e363815bca55e8ed5147a35237929f56"],
  "701f05333391c6526b24838efc331fda085b4dd65eb728d9affc258bcf14478b":
    ["91ea30369d5f63e9409ea76e9964ef88f3a4692ce4aa6949f2b3e613b4d6e241"],
  "730c3f4186739f814abebca3371a856aca7d6de22d27f5727f6ad03e7277c1c9":
    ["e17998421b77d049e719627731dc24bdc7a11f62ba83c9df8b4b841c63955f60"],
  "738df6d2b288a8f11512ab504f499103fe27e18b29e6d5f2015a879aa3641981":
    ["9db1a85a67de29a45357f1d421e59da23549370c0ab4c8ae4998b44e458674f6"],
  "75bbce640571d0157ff966a7183373ae34f26b62693e962b5bf1486ab9740485":
    ["e73f053dcc3dec0c92465a3144c624e7b450edab262a82f5c4ed220f969b9cbe"],
  "75ce03879fcbcaee3e0f225ceeb4d56ee2cb6462716ccf73c22abdac9a8254b5":
    ["18c37cef3b5dc154fae6f48cebc42efd0cbc5f3d4319c6a979a5e1124ae0cbfc"],
  "84a0bdad74c997be930d40cc13a660c841b2b54ec8635ff675bf5c8b498ae619":
    ["2a9ee6f6a8d52ab4ad7e51ac02a5749240b5ef96f97a7b7810d6696c07a8d4e4"],
  "89094ccffaf91259cc442fc78e4989157f9ac1916421ca5f3af7ce6f0c5d0a6a":
    ["2ba89bf65f73d5c936d4b8174af79dbbfa54d1c7c027e0790635c8a46038a846"],
  "8e66a730acb5424aeb93f5f174ececa587c4c1c12ff9a4db2cd96dad2f584906":
    ["79a3b29b221be05a241fdff46781b219b27b07ef803e70e8c086a73485c2241a"],
  "95bd218acc4357157fda114932452986e9f43868ea8d3108c2921393b0962002":
    ["7684f1ef3d5cdc3d6bb51369289352b315e1fb5b3049880818ae595fe5b060bc"],
  "9e2f337f5dac54398615ea2e1f8be49edb450b147558b6046404560e897948dd":
    ["6923f49e7c9b03923d3cea6dd181a2a2ef41845ba5344c2310e0d283dc0114eb"],
  "a032a1d123be8dea68f425b063665c5bbfe56957de88214572fc3fcfc94b3b81":
    ["d438e020b37d029c98182336542074d09c6486f7875cae4598fc70ede2e69a80"],
  "a560a223d9756fc3579f057137601853ec23c2b6bbd57248216b77ce550d29af":
    ["52444d5637379c910af88291aed4c62905b7fb5283d01ae268f633b88c4d30c7"],
  "a8f76f3892254f91a364da37609373d80c436dc0eba5c20d91659ec253f6b331":
    ["567edc769fa3812bcda6fc82531f1afda5dcfbe6ee993a5d8d33c9e39263cd9b"],
  "ab81c2000b9f41b99819c0ee2aaed8d993d23ffb2f096452d394de4393c13822":
    ["b18e69ded07b67e39ddedb75cfbdb43651e9e8de473f7b71498d847cb497ae92"],
  "adbba34c96c4a33047dbac1fa875c6d5af740ad26bc969517576134676f18b6e":
    ["1239c8f3f2ccdc369a7b7b4866cc098e30a5aa7ee3bf7445376c57a3e4351141"],
  "baf8934e4a1d5731f37dbb6883b9a733121a56d4e657882e95bb395ef2faab65":
    ["f6d816f6db087c778bbb06de6ebe5040b28df9b872e53e7d191ab3c392123979"],
  "bd67560da9e5d593a401bd80ed0d14309788375f501dc2a2f29585d78e1d82b1":
    ["6c77788de00092bffbf5a140bb9523304d4e2f6bf2180373574a7895c507ec72"],
  "bec6f257fbbe8af950b00b7df84b1ba162bb62c87f33ed575b72916f67eee7ca":
    ["ed352be69e8a9141fc35986b1b73ca30b3925b483f5e62a37a10433c7d86834e"],
  "c09646cce2a296f5a031d9e919fa799285c371c3e9546484a390b9c5c0f4d0c1":
    ["0c6159e6822076cdc48cfaf12432a10c25f7d837d371be10bfc55fab08737607"],
  "cb2351264724c96192d923cfaf5b1894c366feeff58de8dc75775ba8d40f84f5":
    ["759d09c4136db5471bccc23644c175217d49a6f6e3b61687bd02a2d08dcd2674"],
  "cc8cb073b94e6be17d22172b10c40657abcbb71aecf94b98c9bf3e235808df71":
    ["ea7fe32401b422be2ea581c4ba6d32ce8114caac8df226a8c342b1be58cf1607"],
  "d02167e498f0239edd4fcbc7eb24eea9d0c4ebd1d3e74606a100d9680a9d3cff":
    ["60c90a90f5236c556c8a5045d51037d2bd79a8bedd1330c1ba11b5c429fa61c3"],
  "d04aadc21c7a35ba1376ae6d437dc5a4bf891f2762a364e3e61ac61278e01408":
    ["4cb7b4230612e572122f775e7e3fd989b78837a928ee6d29116269fd45b3e0a3"],
  "d44129b3a53e9bd7e339ed3d7339299fe70311e3ae019a90a404fdf0d9e65f4f":
    ["9e2e1fbce8133821b7a97d5eb9eecb7cb24a7ff8af213e4f3be6ca049f5e258c"],
  "d53047d0f2c7e92ef20d58312ec6c5d11d0291766aaf539664f60d96b27bb46f":
    ["cb2d03006249a4eb372f5c0f3db4f48f501767792e8ecf1b3fc5faaac99669de"],
  "d6cf9fdadb6b0dbb118f080bfa319be92abc941df93f17606a732d8ca69943fa":
    ["b9aafb1e52639d614522af14bf3e62741673de89cd411520e476018231b87a6c"],
  "dc227e6ec361b5a3b6915f7077eb24599d881436b7975f94147e222dd9de16e5":
    ["c1300dd3b257d158930cc415530b52ed551757d3e2b0c0748319c9032db4ccd5"],
  "dee8016ffdc8ae0903116f9452c847317ba7e6da2e3647b72d3f2bf79b63aef8":
    ["0cd8384c97382595ba3b8e7324c2c7fd4dbdb2ca610b85b832598913bb707018"],
  "df2d57f0dce7810ef896c520d05b4d42344ddd9e37912a81a869786c1cb06ba2":
    ["206cea9b10be03061f60a950a7a2c1d489f97732ec3c01a95b4a6aa1e5168690"],
  "e446fc9b6f0557a10b02fd6bf3dcdf21c684b695d79b0964445a7646bb482680":
    ["b86c34da6fde263c013413c5c7a7c6fe93290b326e4a4a13a830018f5543d531"],
  "e7052010aa2d4b48cad89f8e7ec28e328c05da695ef4c6e2ce0ba1e4aa32840f":
    ["0385fb3abb8f05f322b89d21e8c59d87281ef4b6907921320a276eb22e6edabe"],
  "e7a7adeb46c24e4f889e39042d025795a1b801fc854e7058208e5e272f14c8c6":
    ["ead316e17d0faa1453a087a5100e6ad5c5fb41959a4b6c5b0580f57b525b7d40"],
  "e7fbbc497109cfa7683ff89600e26e0e0fa486506865de27f5341f9102c8f256":
    ["3c2d39b431b3d3abac32bf1422af53bf3dec4b570d07e5bb64fb5bac6f059d21"],
  "e983879d9000dca32609583148b5e824f28164214254420e41c187fa1ec4f82e":
    ["7678af8aeaf2cf29c8721eeffd6698621fc400e0698455888ec4e7fb2a3daa85"],
  "ea76feee7b569ef8efb821578b9daa35596f90a8ed002acc77b93df62440d0fe":
    ["fcc6f1cbde9e050fc6cda5c5173f032b52ed8be03cb05aa5fb21026c40b5d573"],
  "ec7abc11398b79a64770a9594e58d7e934c300a844e29b35a52d0862acdbc770":
    ["700fe638f86f05d1b0217a41be746bc71699e2f2419fe9571bd05d95fa079694"],
  "ece875d8de34f7d77a9d1c81ad17604c0318424fce3650e9aeeec8d842f632ac":
    ["dda2994518aed06fbe0679c0f2aa2892c7d4151e4f91ece96c849ffc0b6d44ec"],
  "eeb5dbaafe38feff1f204a88097fee908fba36ae427ba10cb18c319aa2ee30f4":
    ["da1e771dd1cdc96268fc5eeb272e1bce4d1c29c4a5861ac1fdc1dbd6e23fee9b"],
  "f23e956b8fcb72a5a05877690c69bed18e42bd358590433f5f182701b226f044":
    ["1e0828be10784a30a49199f565e407ae1a81632949cb5a9ef866ba51360199c5"],
  "f39923ce9cc32ca38d67974c90c687559bda007a2b907347736cdd885bbb9a99":
    ["a451cb376ce85601cb450a799c4281fe05100878ee670d9b240da3987ab9fa53"],
  "f4c17bb7fb0bc0bb9a06973c06a963ef2fe93d1c35231630b0695f6c172ea202":
    ["83af6d8be66b34d39105e35258865b1db11645f9ff02140e20746cd38e092998"],
  "f763aa113b41936d0271f1370366c6abd343fde5461da767979b6917fc076a13":
    ["20f34e0e3ab066c14cdfaeb2e97055996a9b116961d8b1098ee3ffe19fa9d5bf"],
  "f7abfedeef22ca266f67334ba3fb337c815ffb48a969347097a9d16eef739b26":
    ["0cde501c58bbe91864997e1d192886216cb834ae1eb962ca96cff12168614b76"],
  "f83911b288fc6ee380c8e97535784945a63858aec595a4e94bcb534f4824fe82":
    ["c22631748af37e96b6ab41d6e2a216db5a595c88b6d9209c57ce28c7eb76df44"],
  "fd3d40f1b25ee6eda8dce279db1a32953e18c1bf7318bb690658c41354f5218f":
    ["781e61ae7630315373120ed5781bf1facc6569085ae514792c8de474a919a41b"],
  "fd9a3a63443292ecb8ede9746eef83fa10d30dfc88a443f963e35a9b8bce3a0d":
    ["0cfc50ada6cd0dd41cdaeab76568edbb7d19f17731d2990e3f3d2a6d4ad63162"],
});

// Per-client proof facts this client's review added.
const FACTS: GenerationFacts = Object.freeze<GenerationFacts>({
  resignChatPaths: Object.freeze([
    // The October 22 path renumbered again (reviewed callee and operand moves only).
    { editor: [13696, "47b690af00d5ba4191961b5f8eb4e55a40b08cfdd0439a2017b8a6dc69b2afe1"],
      history: [7888, "e7052010aa2d4b48cad89f8e7ec28e328c05da695ef4c6e2ce0ba1e4aa32840f"],
      sender: Object.freeze({ functionIndex: 7880,
        params: Object.freeze(["i32", "i32"] as const), results: Object.freeze([] as const),
        bodySha256: "ece875d8de34f7d77a9d1c81ad17604c0318424fce3650e9aeeec8d842f632ac" }) },
  ] as const),
  whisperPaths: Object.freeze([
    // The October 22 path renumbered again (reviewed callee and operand moves only).
    { sender: 7880,
      functions: [
        [359, "1c87ab4b0831420341935898d106c902d85897a116b4beb7492bf4ab3b1ea9c7", ["i32", "i32", "i32"], []],
        [11747, "8e66a730acb5424aeb93f5f174ececa587c4c1c12ff9a4db2cd96dad2f584906", ["i32"], []],
        [5866, "013beb33a62a8148261e2a67f657f9b2e02bb618136dc62621831f68f6f3bce0", ["i32", "i32", "i32"], ["i32"]],
        [5872, "06c0e7ea8532c1ac11c1a0909ea07d6471108d688d94f49c38fccdf45d2968f7", ["i32", "i32", "i32", "i32"], ["i32"]],
        [11745, "2a91d529aa19c39b435491b4567896663bcd99cfea4b16b98d36bc80ef80ea60", ["i32", "i32"], []],
        [8848, "6694fdf5dc2395af5adab5e60840eba7467316720b57c4e3a64f4526bb027b5c", ["i32"], ["i32"]],
        [5780, "2241b6c2c774a5bf31ccc43cf112ebbc7aa061870dfff34a457652e3d47ded55", ["i32", "i32", "i32", "i32", "i32"], ["i32"]],
      ] },
  ] as const),
  nativeRenderFamilies: Object.freeze([{
    // The October 22 owners renumbered again. Bodies differ only by reviewed
    // callee indices and relocated static operands.
    functions: Object.freeze({
      264: [264, "3830c5c32eaf8b6065c7aa6ceda30b76ac731d8e513c505c16a5e5e95813e9b8"],
      748: [749, "ea76feee7b569ef8efb821578b9daa35596f90a8ed002acc77b93df62440d0fe"],
      750: [751, "adbba34c96c4a33047dbac1fa875c6d5af740ad26bc969517576134676f18b6e"],
      1333: [1334, "591a0df00c5b820fdba23ee622c2ead65cf27be2942bedf891c328f1b20c84f3"],
      1334: [1335, "244f37d817ffa8948380fddd1646df33b59100e85e50db2e4a917e0123a5f0bf"],
      1357: [1358, "114f27084df400549c52165b97c41f190f498b4150492c34d72407b8612c678d"],
      1444: [1445, "0c9d80366576b62a2292874a98d887363d5a8ee0de63c77dff7abcdb03ef8c1e"],
      1445: [1446, "d02167e498f0239edd4fcbc7eb24eea9d0c4ebd1d3e74606a100d9680a9d3cff"],
      1446: [1447, "84a0bdad74c997be930d40cc13a660c841b2b54ec8635ff675bf5c8b498ae619"],
      1448: [1449, "23ef37d7d7ba501fbf2d33da13999609f5cbfeff98fe3a8849c0c6cd8d1fb609"],
      1449: [1450, "738df6d2b288a8f11512ab504f499103fe27e18b29e6d5f2015a879aa3641981"],
      1522: [1523, "6d0cb22b41929e6cf0f18029da42efd235152b1584c0709328bf82b5d8a9f1a6"],
      1530: [1531, "4d3d76ce224db9ada9ffdf70b31e5d2fdc0b16e6e2ab2bad9f2a1d98600690c2"],
      1532: [1533, "d04aadc21c7a35ba1376ae6d437dc5a4bf891f2762a364e3e61ac61278e01408"],
      1554: [1555, "034910086d195f29148b9357f7657b6ebd5c64d1bf95c9a1997551209e307b2e"],
      1556: [1557, "baf8934e4a1d5731f37dbb6883b9a733121a56d4e657882e95bb395ef2faab65"],
      1559: [1560, "2fd7490ab39967f63dea682590c2dbb7efdeca56745228a42becec9e951e3d05"],
      1563: [1564, "d53047d0f2c7e92ef20d58312ec6c5d11d0291766aaf539664f60d96b27bb46f"],
      1564: [1565, "cc8cb073b94e6be17d22172b10c40657abcbb71aecf94b98c9bf3e235808df71"],
      1565: [1566, "ab81c2000b9f41b99819c0ee2aaed8d993d23ffb2f096452d394de4393c13822"],
      1569: [1570, "a032a1d123be8dea68f425b063665c5bbfe56957de88214572fc3fcfc94b3b81"],
      1572: [1573, "25671de11910c9bb0178497a25e75b3a4c6a54d2f972d251b63e2f29fadb2109"],
      1579: [1580, "458c24c2997da50bbf039661661f634ce1b3dec4db7ce5efafd10e67b0c328e4"],
      2187: [2188, "f763aa113b41936d0271f1370366c6abd343fde5461da767979b6917fc076a13"],
      2249: [2250, "3215f76fea3575263a5c0a55d37e48299f38c00196e1ba6145ced3b1e526f43a"],
      2902: [2903, "148db22d2c7d9a287148f85a001b51dfa4eaefc98c0aaf92a2d6120cc303397d"],
      2922: [2923, "dc227e6ec361b5a3b6915f7077eb24599d881436b7975f94147e222dd9de16e5"],
      2956: [2957, "f39923ce9cc32ca38d67974c90c687559bda007a2b907347736cdd885bbb9a99"],
      3137: [3138, "bd67560da9e5d593a401bd80ed0d14309788375f501dc2a2f29585d78e1d82b1"],
      5595: [5596, "75ce03879fcbcaee3e0f225ceeb4d56ee2cb6462716ccf73c22abdac9a8254b5"],
      6271: [6272, "420c3f943c09e0008cfc4d7cefd9890df677ca38343bb1770bf6eeb38d80898b"],
      6284: [6285, "0a09c613c93d32df6a0418bc0f253fb8f7358686da92c74ecca515d5302d9e16"],
      6285: [6286, "6dd186f0b33dbd772c06a45d53cb94c9aa8668b1b890ecb1cb4944c02bcf458c"],
      6295: [6296, "f83911b288fc6ee380c8e97535784945a63858aec595a4e94bcb534f4824fe82"],
      6446: [6447, "66782f51d85ccfa80793fe0e99034244ca856cd78511638df8cb159cdb573997"],
      6447: [6448, "46e423238f12da05654400fd44ee7dd27c113845407ceb969b9b27ea6bf4805e"],
      6450: [6451, "6916aa4460da4f8daf943da674f1ed5723c5438f40dd5d7935e4ca23984730e8"],
      6488: [6489, "e446fc9b6f0557a10b02fd6bf3dcdf21c684b695d79b0964445a7646bb482680"],
      6490: [6491, "89094ccffaf91259cc442fc78e4989157f9ac1916421ca5f3af7ce6f0c5d0a6a"],
      6492: [6493, "57974d4547c2931412c686c03ed73810688a1608b290e47fff10a717eaf6a87d"],
      6584: [6585, "fd3d40f1b25ee6eda8dce279db1a32953e18c1bf7318bb690658c41354f5218f"],
      6585: [6586, "123fcdb86adbe4c88d450254420146d6b8dabb8b1ccd1320f3e938221849e397"],
      6593: [6594, "fd9a3a63443292ecb8ede9746eef83fa10d30dfc88a443f963e35a9b8bce3a0d"],
      6598: [6599, "f23e956b8fcb72a5a05877690c69bed18e42bd358590433f5f182701b226f044"],
      6827: [6828, "75bbce640571d0157ff966a7183373ae34f26b62693e962b5bf1486ab9740485"],
      13125: [13101, "df2d57f0dce7810ef896c520d05b4d42344ddd9e37912a81a869786c1cb06ba2"],
      13162: [13138, "3bbc822c71a47f8f19a4cc9cc4cef189df261a47fc859c7e9521dd2eb536763d"],
      14063: [14041, "22aaeda8b66592b6303ccd0466ea36e9a271d62ee831c49eeb16885c485cba2c"],
      14112: [14090, "217c7e3c872095c053b651adc245e4bc50dda03d5a120938b4a427b62dfacaa4"],
      14116: [14094, "d44129b3a53e9bd7e339ed3d7339299fe70311e3ae019a90a404fdf0d9e65f4f"],
      14126: [14104, "e983879d9000dca32609583148b5e824f28164214254420e41c187fa1ec4f82e"],
      14132: [14110, "701f05333391c6526b24838efc331fda085b4dd65eb728d9affc258bcf14478b"],
      14137: [14115, "49739e00e0cd0517475e53a4dfabd88c7c559b77f8943de5144c19412830aeb0"],
      14147: [14125, "b47aa2a9b0df83431a59ccf6754b9435af7f2f4b9e35be532930ce89323854ae"],
      16125: [16117, "4f5e46e89797a30c4270945ae2f5dbb0e601035a702523946e7603c995fc06cc"],
      16136: [16128, "95bd218acc4357157fda114932452986e9f43868ea8d3108c2921393b0962002"],
      16170: [16162, "730c3f4186739f814abebca3371a856aca7d6de22d27f5727f6ad03e7277c1c9"],
      16224: [16216, "6226350aead9ae0f1e94c6baf4810da2dc68f254cfc8884dc2914cf2fcfa4e03"],
    } as const),
    modelTypeOffset: 1341088, graphicsDevice: 2745352, underMouse: 5921740,
  }]),
  pathingFamilies: Object.freeze([{
    // The five pathing functions renumbered (+1); their callee indices and string
    // pointers moved; record shapes and relations are unchanged.
    functions: { loader: 3209, converter: 3217, boundWriter: 3274, coordinateWriter: 3282, builder: 3289 },
    hashes: [{
      loader: "3666716979fde05badb08fcb7be50a64e47bc8aeb80bc27bc8a82865442be3cb",
      converter: "9ff3014e767f4925d635bdfc83c1e94079510145b56475ce01ea75c670fe1c05",
      boundWriter: "7cfb9f1b504575c2dce539b38de6d741b1009ba5b0607de7c9161b03a5db06fd",
      coordinateWriter: "7c38b28eb9782a324d24130841e2c109feb172a33f657522ced3278d9c7e7d25",
      builder: "0f1dfd8047975dd5e605a27fef529729a4b2f1dde78153897a79ad4fa8fcad2a",
    }],
  }]),
  // November 3 renumbered the Cartography surface owners again. A relink of
  // the October 22 owners would derive them by identity without this entry.
  cartographySurfaces: Object.freeze([Object.freeze({
    compassRender: [14218, "4e396c79daa5e7cda8b63cf8bdc22466e791bfeb7b3784749efbfed29a177321"],
    compassMapRender: [14157, "a8f76f3892254f91a364da37609373d80c436dc0eba5c20d91659ec253f6b331"],
    missionMapDispatcher: [16128, "95bd218acc4357157fda114932452986e9f43868ea8d3108c2921393b0962002"],
    missionMapGameplayContext: [13538, "ec7abc11398b79a64770a9594e58d7e934c300a844e29b35a52d0862acdbc770"],
    worldMapDispatcher: [16215, "583c263546baf00180e27fe15d08e79e2f37e9b2b84d65d64f017e2078901fd5"],
  } as const)]),
  friendLifecycleRoles: Object.freeze([Object.freeze({
    // Callees and static state moved again; the connection event and logout
    // handlers assert with GcAuthCmd.cpp source lines that moved by seven.
    eventDispatcher: [708, ["i32", "i32", "i32", "i32", "i32", "i32"], [], "d05e5d09bdbfdadbdcf36806642669ee6906ce4fd462dec626eb22f3d3e0df69"],
    callbackListInsert: [510, ["i32", "i32", "i32", "i32"], [], "ac639836d43e92dcd33a5c65fa8d94fa088f402fb62681650f71a3bd2d101f26"],
    eventRegistration: [303, ["i32", "i32", "i32"], [], "129c49c7ab0d84f1c428c978cfd9f761b76048af02efc096a2c36d925eab2656"],
    rosterRegistration: [30, [], [], "cbc2d5efbb269fcb74411a2ff4e0e6b7cd18cecf0d17e08efd7fa872da648029"],
    queueDispatcher: [568, ["i32", "i32", "i32", "i32", "i32", "i32"], [], "5f4b679e850cdbf5273bdcd51b73e4f0a0397b5465faf1747b90b99bf8839963"],
    queueDrain: [154, ["i32", "i32"], [], "7f75809bb1414cfbdfc9aa39218133cf48428088fb6f11712fd6432ed60ba521"],
    queueAppend: [644, ["i32", "i32", "i32", "i32", "i32", "i32"], ["i32"], "87376639db6c8e1fd2e72a7489ca737d83086d673f03930eed09d062bde70994"],
    queueFacade: [179, ["i32", "i32", "i32", "i32", "i32"], ["i32"], "13b9c7743346ddc37f8cdd42b58c2914e6596e36139f12584a3670db116b73f5"],
    rosterCallback: [872, ["i32", "i32"], [], "6660fdb5b02f1dc6c3a235b6be081bb52f2e148a60ddedb377cdd88153d0a4e2"],
    clear: [18, ["i32"], [], "d94f5f3480655bff618e0a910472d906ab7e9ec2264a85d2e8a469c896113a6a"],
    teardown: [47, [], [], "bb72f6d7d931afb794beddaca7e0f8854433d0724845849b601c816e246c52b6"],
    requestPump: [566, ["i32"], [], "9102b2ab141f8c21c4e1ff39ad511ea5d785f4573dfe477f20ddb97de3bbce10"],
    requestSent: [308, ["i32"], [], "2aeb4477289e781fb3aa57e4f7cae5aca872536b5229d15cd81553b2709905a9"],
    requestCompleted: [135, ["i32", "i32"], ["i32"], "7e80d653d1077f72f868789973010da5b011c2728c6d43ad9554e53cd11fd720"],
    rosterEntry: [213, ["i32", "i32", "i32", "i32"], [], "47a667d21f1c472ebb462d6253440b7efccd3f9257425689f6635c6008708d19"],
    loginCompleted: [842, ["i32"], [], "5126e2ae3cef548722e3ccd539f40c40c9f12754fee50856f0278dcc0b0f861e"],
    loginStart: [386, ["i32", "i32", "i32"], [], "3924464319cf59baecbeb4c78d3c31f144bff9ada16cd2ec5c6e6907ef2cd3a7"],
    connectionEvent: [1084, ["i32", "i32", "i32", "i32", "i32"], ["i32"], "3f8f84593f5d9efe8fe6bf43b2829a8f827ce70ee56430e762afde39661ae620"],
    disconnect: [70, ["i32"], [], "6af541a904883bfec8e0ae09525157f10819c96ced8b11d48acf273f0b25e0c1"],
    logout: [206, ["i32"], [], "7921999e36adfdafbb88f041c42a5bdf4fa305da01c36045aba56610725e33c8"],
    connected: [342, ["i32", "i32"], ["i32"], "b5258d2937ae73dcacc82e55cd94868b2085bfa2749d9b3ffcde3f0cbd2eb879"],
  } as const)]),
  // Alternatives to reviewed reference literals: the same function in the same role.
  alternatives: {
    // Compass owner: callee indices and static addresses moved.
    "968c145474ccf26e7b2b8bd64ee11c06cecd0e9d0af011474560111c421cf209": ["403a318ba671af0d5d5624c6ba7dde998fb94621f701b9c54ac8b70d4810ef16"],
  },
});

export const NOVEMBER_3_FACTS: ClientGeneration = Object.freeze({
  id: "2026-11-03-f2a2b07c9c56",
  builds: Object.freeze([BUILD]),
  memoryCodeSha256: "63290710105a8571243380dae7c1f000cfd718922aaca1d57eef06c710d103ff",
  // November 3 renumbered the October 22 bodies again; only reviewed callee
  // indices and relocated operands differ.
  playerEffectBodies: Object.freeze({
    "7df2376537653cac9b32172fb51073fa57503b1a2bcceb317a6d282d1e13fb0b": "f4c17bb7fb0bc0bb9a06973c06a963ef2fe93d1c35231630b0695f6c172ea202",
    "18899c4be6bf2fd51f6dbf6e52241456cdaed94d912ed23f307c95917bf615b8": "2f4ff4d5219da4d88211c0f133ad01c1aedfab1fc135f8501b5969feb36607b2",
    "1f2d462100add0c160d62265d2eaf292a00bfd1cde84c38c1e51f2aac0a2cc57": "a560a223d9756fc3579f057137601853ec23c2b6bbd57248216b77ce550d29af",
    "a560a223d9756fc3579f057137601853ec23c2b6bbd57248216b77ce550d29af": "6855a6e32260141c19dc6254dde29416a22a749f3ceaf30915ebf1d6b0d4387c",
    "ecfa62c1bfaaebe98c2047ad986e137e9695a3cf2f0f7d5f6367b6e44cc10894": "0d5710dd6b45cd590a4cbad35cc7cfe1ef8c123566c91b36d252386d7d72c2f2",
    "3fecf883ff7543db3cfdd8f3d77fc5cf3ef1e78282252f4f3caedbbe4f80bac0": "d6cf9fdadb6b0dbb118f080bfa319be92abc941df93f17606a732d8ca69943fa",
    "fe97a736b61e83cc5ea5a84f38aecedd384476339c5b02594fcefeebc5ce5203": "6c88594d54694899dc3ba794cbc20766cb09818bcd1313b195c23e348f6d2a06",
    "cafd172e56cbc1efcc64eb281fd8dadcfb6aa305eb4c165c0959f0903f98f769": "eeb5dbaafe38feff1f204a88097fee908fba36ae427ba10cb18c319aa2ee30f4",
    "5e0ab6365510501ff760de8c3bdfb8682bf918e092d9263441d8fc7f56403533": "c09646cce2a296f5a031d9e919fa799285c371c3e9546484a390b9c5c0f4d0c1",
    "7340dbe70f3f4bf731d23f80882df99553e837f825d8bbebee7f8eac45d8ef58": "e7a7adeb46c24e4f889e39042d025795a1b801fc854e7058208e5e272f14c8c6",
    "9267c76c395a6ca5bc2efd0f9eb1cd3234feb5c95041a3e6230c98f23f9a4d60": "9e2f337f5dac54398615ea2e1f8be49edb450b147558b6046404560e897948dd",
    "d5e3a36c3336cf3e42867228919ae973072dc54fb442d80244067a3f308b5fd5": "cb2351264724c96192d923cfaf5b1894c366feeff58de8dc75775ba8d40f84f5",
  }),
  identities: IDENTITIES,
  facts: FACTS,
});
