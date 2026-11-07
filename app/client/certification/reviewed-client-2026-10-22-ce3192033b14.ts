/**
 * Reviewed facts for one ArenaNet client generation. The October 22, 2026 client.
 * Runtime certification never grants a capability from these facts alone:
 * the isolated semantic verifier re-derives every fact from the bytes first.
 */
import type { ClientGeneration } from "./reviewed-facts.js";
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";

// October 22 facts: the October record remapped by unique normalized
// function bodies and a conflict-free static-address map, then reviewed.
const BUILD: KnownEnhancementBuild = Object.freeze({
  sha256: "c32b9ec13dc3d64fb50623bfd042e43ebddd8fa60f4090c508da73a2330af686",
  outputSha256: Object.freeze({
    "features-3fffff": "cde8e22c07edb17e34b634d539ee48b689b49f31dfeead0763de3c1dcbf7a1e0",
    "features-01": "f1f9ed27ec2d094a6d4f3741b82da34530aaa597add4399ecfcbb305a3b5bc33",
    "features-e01": "141b6a7ac1d9932947d56517f9054a9deb0b442411656431ae93002dbb1af5a1",
    "features-601": "05b123559aeb8e810687fdddaf744efd2204f1c979683619f3163d0ccf52ef44",
    "features-200": "ab613e6b0317ed590f50bf9cebf336ad363cd39cda7f93bd6e20b8953451c401",
    "features-202": "f0f8173101936019ca32cbdf888c2e5b2cac971bc3c224db8f9e8098960e08ef",
    "features-284": "f18a802386e319353c8e991c0e78cc03cc1f308dcec9bd40904a2ec39b10cf0a",
    "features-285": "be662ac187efc0f933deab65ce8d667f04bd83010b33b61cee517982ff42164a",
    "features-270": "8efa044c3afd28e782780b723b75e4ea61a55d611051df082171138a6b6dc9fa",
    "features-2fc": "11cbd848feefb824a2cf13eb7846f689bdcc827848331e030da5ab4211f77dba",
    "features-c200": "3d90edcfa64d5f41844e441a2e914b4d1b47f24f2866da3bc09af6a2a182495a",
    "features-c204": "632f434f07ef4e48d98f915f26ad5013977aa8c854ad35384d282f1eb88e65e8",
  }),
  programId: 1,
  buildId: 4108659193,
  hookFunction: 446,
  hookParams: Object.freeze(["i32"] as const),
  hookResults: Object.freeze([] as const),
  hookBodySha256: "7d0a35e826a724e056f809d4712386d1d319c66740bf897003e9562acfb266d6",
  tableSlot: 4682,
  cursorEvent: Object.freeze({
    functionIndex: 2469,
    params: Object.freeze(["i32", "i32", "i32", "i32", "i32"] as const),
    results: Object.freeze([] as const),
    tableSlot: 922,
    producerFunctions: Object.freeze([2828, 2834] as const),
    producerParams: Object.freeze([
      Object.freeze(["i32", "i32"] as const),
      Object.freeze(["i32", "i32"] as const),
    ] as const),
    producerResults: Object.freeze([
      Object.freeze(["i32"] as const),
      Object.freeze(["i32"] as const),
    ] as const),
    bodySha256: "f09a7a12954169ae595d12d870e69a4c0092003157d72523d626d2a3990241e2",
    producerBodySha256: Object.freeze(["f1a80265715f3aeb7b043e08867e1e591d652088b35b328323d2fb14d28bc76a", "0575df1670bd942fccee3e49e5f6b64a2e49a46b3de53366d7258cd4242ee953"] as const),
    tableNeighbourBodySha256: Object.freeze(["f09a7a12954169ae595d12d870e69a4c0092003157d72523d626d2a3990241e2", "cb751dd998dc5591fb1a8d05d08d194a8a7e4670b1a9685816b9a2af8fab7980"] as const),
    layout: Object.freeze({
      cursorActiveArt: 5921200,
      cursorSoftwareModel: 5921204,
      cursorShowCount: 5921208,
      cursorColorBuffer: 2740512,
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
      contextRoot: 5919152,
      gameContextSlot: 6,
      characterContext: 68,
      characterUuid: 100,
      mapId: 408,
      isExplorable: 412,
      currentMapId: 564,
      currentInstanceType: 572,
      playerNumber: 688,
      areaInfo: 1891136,
      areaInfoCount: 883,
      areaInfoStride: 124,
      areaInfoFlags: 16,
      agentArray: 5935416,
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
      contextRoot: 5919152,
      gameContextSlot: 6,
      characterContext: 68,
      characterUuid: 100,
      mapId: 408,
      isExplorable: 412,
      currentMapId: 564,
      currentInstanceType: 572,
      playerNumber: 688,
      areaInfo: 1891136,
      areaInfoCount: 883,
      areaInfoStride: 124,
      areaInfoFlags: 16,
    }),
  }),
  targetObservation: Object.freeze({
    layout: Object.freeze({
      manualTargetAgentId: 5930028,
      automaticTargetAgentId: 5930024,
    }),
  }),
  uiDispatcher: Object.freeze({
    functionIndex: 6842,
    params: Object.freeze(["i32", "i32", "i32"] as const),
    results: Object.freeze([] as const),
    bodySha256: "518669b3c9298c54a22002c31354bf8c59cc5de3a6567c42d1eb2569ae4d1845",
    playerChatMessage: 268435586,
    hideHeroPanelMessage: 268435878,
    showHeroPanelMessage: 268435879,
  }),
  whisperChat: Object.freeze({
    functionIndex: 7879,
    params: Object.freeze(["i32", "i32"] as const),
    results: Object.freeze([] as const),
    bodySha256: "3947df1c888113fe94a12fea2f3d500387b71f2e56b8ddf970d571621248b584",
  }),
  resignAction: Object.freeze({
    functionIndex: 7879,
    params: Object.freeze(["i32", "i32"] as const),
    results: Object.freeze([] as const),
    bodySha256: "3947df1c888113fe94a12fea2f3d500387b71f2e56b8ddf970d571621248b584",
  }),
  gameThread: Object.freeze({
    drain: Object.freeze({
      functionIndex: 6661,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      tableSlot: 1722,
      bodySha256: "8f37f5153d84ef5cf5ee883d2995bbcc92999ee8dc3ac3161cbc5176c6079597",
    }),
  }),
  travelAction: Object.freeze({
    enqueueExport: "enhancement_travel",
    configureExport: "enhancement_configure_travel",
    toggleExport: "enhancement_take_travel_toggle",
    messageId: 268435846,
    producer: Object.freeze({
      functionIndex: 16192,
      params: Object.freeze(["i32", "i32", "i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "985cafc1bac9b354a1a90a05ca83b51d71f3379d0cd7507aea367cd2f31f405a",
    }),
    contextResolver: Object.freeze({
      functionIndex: 11661,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "468f7ad579443df1c463495da4fa6ec89e67d13d5f00ba5358e24c5d5cc4d9d7",
    }),
    unlockProof: Object.freeze({
      layout: Object.freeze({
        worldUnlockedMaps: 1548,
      }),
      accessor: Object.freeze({
        functionIndex: 9191,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "24579d9f602bc21a37c0dc8ca88c362a38493c64d101d42081ccd6ed5314f975",
      }),
      consumer: Object.freeze({
        functionIndex: 15971,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "9bfe5c33ad92e1c4b3884d13a9019ac623b395c6b164d1406917118a3ee27036",
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
        functionIndex: 7964,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "f78d0067879c110a5269ab57eaab946525cbc0a7ba09ff02c150db94d5176598",
      }),
      areaTypeAccessor: Object.freeze({
        functionIndex: 9542,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "43acce2aef9325f192efa422dee707362fe3b16feaa891447c5256d6eae86099",
      }),
      producer: Object.freeze({
        functionIndex: 15447,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "3adcc506569c2134909f4a1429062c579d9e28a9bcdecae5bafa55b9120b71c9",
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
          functionIndex: 8945,
          params: Object.freeze(["i32"] as const),
          results: Object.freeze(["i32"] as const),
          bodySha256: "58561c72cdf0303acafccf030aebc1efedee3044d8384de2c1b480fe544ceb49",
        }),
        "access-flags": Object.freeze({
          functionIndex: 9203,
          params: Object.freeze(["i32"] as const),
          results: Object.freeze(["i32"] as const),
          bodySha256: "b7cf440e1481e04375550b0401ae497ce0f0bde2ed6ab750c16e49a276d3dc84",
        }),
        "player-number": Object.freeze({
          functionIndex: 9212,
          params: Object.freeze(["i32"] as const),
          results: Object.freeze(["i32"] as const),
          bodySha256: "49540413d2966be8e456e1b744f7af809829d3b3eead3da0f45ab30fb0b73ddd",
        }),
      }),
    }),
    handler: Object.freeze({
      functionIndex: 8984,
      params: Object.freeze(["i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "0a46adca4dd597f9430c23457f6ce6ff7ccdfbdaf4a77b449a8158e2c595189a",
    }),
  }),
  chatAliases: Object.freeze({
    parser: Object.freeze({
      functionIndex: 13680,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "6e8611664efa658f8613d750fa60513e009bb1650dd4cebba1f8eb34bc649b88",
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
      functionIndex: 7884,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "3317e78afc6f79ebe49e205870dd7776c79856917cd6865a6e0ff1a87a5195e2",
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
        functionIndex: 9189,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "55083539f7b4cc9735798476c6f1f41132a880f05fe0f80735c3d88df24a5fb4",
      }),
      missionsBonus: Object.freeze({
        functionIndex: 9190,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "b2c8c1c5c29e3d65ee2146c6188a3b424edf312b1aa0f09a33bde70882553835",
      }),
      missionsCompletedHm: Object.freeze({
        functionIndex: 9186,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "9f2fc258978975797eaaea36847eca28e5cea7b301acd36e9c3b49e3659909c9",
      }),
      missionsBonusHm: Object.freeze({
        functionIndex: 9187,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "2400ea801789bf303891d69663d1ddd898ca9f40edb34bd0902af7e9a924244d",
      }),
      vanquishedAreas: Object.freeze({
        functionIndex: 9192,
        params: Object.freeze([] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "2156f57faba6be2669bd8eef6742a4f03e97c11f54fef48ce6551a5c364637d0",
      }),
      titlePoints: Object.freeze({
        functionIndex: 9307,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "a5c1bba06bf15728f177f452f266184ae622085f78ad344baed6c3e5a7133bc6",
      }),
      areaInfo: Object.freeze({
        functionIndex: 17518,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "081506484a3019e40c1a934f95f88ff3911d70640c0f446afc6c3a3fb4975e5e",
      }),
    }),
  }),
  // The producer's `chat.valid-message` call (TextValidateCoded). Local chat
  // lines call it first: the producer asserts on any line it rejects.
  chatPrint: Object.freeze({
    validator: Object.freeze({
      functionIndex: 5881,
      params: Object.freeze(["i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "1f58a402e2b2807caee4c761a61f62b060ea2c65af33eee7530f2191c727cf34",
    }),
  }),
  partyObservation: Object.freeze({
    partyDirtyMessages: Object.freeze([268435512, 268435513, 268435596, 268435608, 268435650, 268435729, 268435743, 268435744, 268435749, 268435751] as const),
    playerChatProducer: 8953,
    playerChatSites: 3,
    nearbyPlayerMessages: Object.freeze([268435583, 268435584] as const),
    nearbyPlayerMessageProducers: Object.freeze([7884, 8951] as const),
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
        functionIndex: 6796,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "9f73f1018d0bf99fd0d16b6ede0921dbe29cf70a4da4a61c9b24c1e68dbb0bf0",
      }),
      frameParent: Object.freeze({
        functionIndex: 6797,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "3b866a4e5d9e1e09b60c7e92acb62fb069c800e96ca0113e971e8353655e7ab0",
      }),
      frameResolver: Object.freeze({
        functionIndex: 6534,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze(["i32"] as const),
        bodySha256: "2061c0173ea5aa4ccbd6ce494d5726a169207823b76abb750abea369b48d7e07",
      }),
      frameDispatch: Object.freeze({
        functionIndex: 6508,
        params: Object.freeze(["i32", "i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "5da6084de17a5b1c57b5672016789e6f1e4ceb0abb9ed024bb8c6561c4bd7a24",
      }),
      logoutProducer: Object.freeze({
        functionIndex: 12436,
        params: Object.freeze(["i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "85dd3fead9b386dc920924374f8d12bc8a0d6ab7d3f84e9240c0a6a918c87ee7",
      }),
    }),
    characterListLayout: Object.freeze({
      characterArrayPointer: 5938680,
      characterArrayCount: 5938688,
      selectedCharacterName: 5939056,
    }),
    hashFunction: Object.freeze({
      functionIndex: 365,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "b8ede3a030d6dbe916834d24b05d2a1d1e90c77bbf992e38ecfef314f36a328c",
    }),
    labels: Object.freeze({
      play: 1532246,
      selector: 1532468,
      yes: 1533160,
      no: 1533174,
      reconnectDialog: 1533242,
    }),
    labelHashes: Object.freeze({
      play: 184818986,
      selector: 828467986,
      yes: 1398610279,
      no: 3600335809,
      reconnectDialog: 4200678686,
    }),
    layout: Object.freeze({
      frameArray: 5923628,
      frameCount: 5923636,
      frameBytes: 456,
      frameChildOffsetId: 184,
      frameId: 188,
      frameHashId: 308,
      frameRelation: 296,
      frameState: 396,
      contextRoot: 5919152,
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
      functionIndex: 14929,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "6a82f4ed9aded37247ccd15d5822c1118f9412c7be28c7d5b7faf3d0d194086b",
    }),
    materialStorageSlot: Object.freeze({
      functionIndex: 14967,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "d0dea47faa8e0114370878d1bab2946fb5372d236cf481e9057a5e2ef6c1b5ed",
    }),
    numberPreference: Object.freeze({
      functionIndex: 10818,
      params: Object.freeze(["i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "cf61db8f13d258c90d5005bc4dc3d8d72f57561febeefa27428cbeac5d6dd6d6",
    }),
    moveItem: Object.freeze({
      functionIndex: 13611,
      params: Object.freeze(["i32", "i32", "i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "3709d9679f87e42ce28cefa257af0e89727c0ec16c66bdb5f98482fdbdb8f98c",
    }),
    timer: Object.freeze({
      functionIndex: 249,
      params: Object.freeze([] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "d4066bccfd04635db551e12e16406e952e90e7cb3135b10b22f1c2c99ca2d93c",
    }),
    storageFrameHash: 2315448754,
    tradeCartFrameHash: 1928795935,
    tradeDialogFrameHash: 3198579276,
  }),
  playerEffectObservation: Object.freeze({
    accessors: Object.freeze([
      Object.freeze({
        functionIndex: 8911,
        params: Object.freeze(["i32", "i32", "i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "8bbf0be7d8031c7a3ebb9a6d9311d4849f120352bd61e0a1abfc02735107686c",
      }),
      Object.freeze({
        functionIndex: 8912,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "d420d0eabfb51b9ecdb930d532f282b101febd003fffd8c993ebc9fdcd4dd33b",
      }),
      Object.freeze({
        functionIndex: 8913,
        params: Object.freeze(["i32", "i32", "i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "4737741bf201a48b379bbee09bc56731be209b5c886c4215c42bf8c3dc9abd88",
      }),
      Object.freeze({
        functionIndex: 8914,
        params: Object.freeze(["i32", "i32", "i32", "i32", "f32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "fc2afe3ac91e845eae941170a63964156daad419c4d82d54e17227b694bac250",
      }),
      Object.freeze({
        functionIndex: 8915,
        params: Object.freeze(["i32", "i32", "i32", "f32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "9a39085dfb13220e6f834ec96f99df624116e8a207c57c07f22466705530c5e8",
      }),
      Object.freeze({
        functionIndex: 8916,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "72adab1b90ab319ebf714722d199675dabdbf945affaabecabaa215cbcb858ac",
      }),
    ] as const),
    mutations: Object.freeze({
      addTimed: Object.freeze({
        functionIndex: 7210,
        bodySha256: "946992af3680b0217734172ccc0a70e7c283a44eda54edcf399a734791e347c3",
      }),
      renewTimed: Object.freeze({
        functionIndex: 7211,
        bodySha256: "c9d06f44e8f7c99f976ffeb728e1d8e8490a8b0202b857e130f834098ccae03d",
      }),
      remove: Object.freeze({
        functionIndex: 7212,
        bodySha256: "5e0ab6365510501ff760de8c3bdfb8682bf918e092d9263441d8fc7f56403533",
      }),
    }),
    timer: Object.freeze({
      functionIndex: 249,
      params: Object.freeze([] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "d4066bccfd04635db551e12e16406e952e90e7cb3135b10b22f1c2c99ca2d93c",
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
      functionIndex: 14252,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "57a88a1a84b4ba6c6f9d5c38dd215238dcd3e7cf2888d6b2be41429673878f64",
      constructorCallOperand: 168,
    }),
    constructor: Object.freeze({
      functionIndex: 6676,
      params: Object.freeze(["i32", "i32", "i32", "i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "b5676dd9e7301284cd9cb4b6966fc6c7a049419c6e39b3009cffc0d95730ed88",
    }),
    childBuilder: Object.freeze({
      functionIndex: 14280,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "845200d2aae2d929e80fa3ebf334133e6d9dfa4fb1d2dfca3383c0a5c6186b14",
      childOffset: 4,
    }),
    layout: Object.freeze({
      frameArray: 5923628,
      frameCount: 5923636,
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
    functionIndex: 8963,
    params: Object.freeze(["i32", "i32"] as const),
    results: Object.freeze([] as const),
    bodySha256: "4147a0600d662a5714f748d851e50500434d6cd4308df5a4125c2b7725cabe0c",
  }),
  nativeHudRendering: Object.freeze({
    functionBodies: Object.freeze([
      Object.freeze([13173, "78097eeffeda60e8515e4165d071541ec4dbdbe55065a7b243ba4f5d910a58b2"] as const),
      Object.freeze([13136, "4551e1ad9a08c2e1e81337ccf3b59c4a2654fbabac9389c317300d9a3f5a6d88"] as const),
      Object.freeze([6584, "498a580fe1f2863df8c929ecbff1e8f864ed96ff53f7b18b803ae84dfb2545a7"] as const),
      Object.freeze([6450, "643f6733c8a74d823848b179fe61383cb9706e5f5181d1d016c48e64831648a0"] as const),
      Object.freeze([6598, "91f5cf516b125fd6181e4e003e4b6d7acc841c37052438bf9d213ff71e27bf87"] as const),
      Object.freeze([6585, "4d9928f3e8c33a8b056fb4788f987afb22e7699cc4dd331fdd95f2e43b7965b9"] as const),
      Object.freeze([14076, "0974bc46436ed9ea7c2d7c18f8c0b8a23dba3ff7e8d22c0ad61f21f27acd7948"] as const),
      Object.freeze([1554, "06c86f4e20b8c3713eaed0f50ab36aeedef50a7539649dbdfe2628a3ab5554ff"] as const),
      Object.freeze([1572, "0d881eec84eb2b448d3369ceb3f3225398bdd4ddfbd4f94f282422f24ed956fe"] as const),
      Object.freeze([6446, "f0d0f6091ea4b8749c00cf2973a0b8911a49993b0afe79182952b7d3cca715f7"] as const),
      Object.freeze([6447, "0d43f0fabac0c7d463f4a6b073a45e16941642f88416841b0d8524e2348b38c8"] as const),
      Object.freeze([1563, "9969e5908a09a60a335a30adeec9da025c7d33fa8bf278eb5f80464e3cf7fb20"] as const),
      Object.freeze([6488, "04fc81d673ee0a07d8de4e00a57d318c54cb0b68230f6d86fad10ec03d88dc08"] as const),
      Object.freeze([6492, "d163abd18f36b31e89ed488c1e60435c83b56d065f1936405d89400f2c772a08"] as const),
      Object.freeze([6490, "ad22c95211ae5de444cbee2a37f1a07c2b9fb6e0d6f23caa758fd7ba9ac7d91c"] as const),
      Object.freeze([6593, "35aa20e5d81ca4dfb8962dd9bcb1ada197af1bb86001f6012fc1bdcfdf1cca92"] as const),
      Object.freeze([5595, "3af2d946882f262b60718623a18d3977acf92194150c65ea4fab8684906ed703"] as const),
      Object.freeze([1569, "58eae3c31255da6e2582ded4e0615fadbb5619ecdbff597bba9dcbe166d315c4"] as const),
      Object.freeze([1579, "11a75789cdf24acade096cfa060b013d6141704fbbb74af31be80251e4b71b9d"] as const),
      Object.freeze([1559, "72ab3beab5262b9e3bb92a2695479eadc0ed735e8bf8c4dfb02b25b2232d38be"] as const),
      Object.freeze([1444, "e2e5d918d727ef14b7fdaef41f3446c65193f6fbe80446be6566a477681a0904"] as const),
      Object.freeze([1445, "ea7a7ab8c07165ee61b3c8239cc8140771eeee9b8677841632064817b116d1ee"] as const),
      Object.freeze([1446, "875e9edf6a7f4c6837dd661b3e487dc87b8f2be0be416272c54c14dbe116c5dc"] as const),
      Object.freeze([1448, "6580203bcf57308ea063af0cf46b314a2e867c29791a5a5295082a0219c03981"] as const),
      Object.freeze([1449, "1c11192753e67ba74ed7db55945f93c10d72b799061fd31b496fc2cdc0d6d26b"] as const),
      Object.freeze([2249, "51d5de10730b93272866f3917776eaeecb3a68aabaaf8213f0667a315da141d7"] as const),
      Object.freeze([3137, "7b85811f2e1b9f0a13e66b76ccb01795d0f4288e9a3fbf9900530cdfa1fc1339"] as const),
      Object.freeze([748, "f1f53c94b6340f394c360c3af0f5604ad5514488751fb18ce360585ddfeb2fa7"] as const),
      Object.freeze([1333, "2a2380fe271d2f3933c1749f73bfffbf6d967b605a59473d0e449053cb937dd5"] as const),
      Object.freeze([1334, "8c2f991e381aec54c79bb3f236652fade8de44da3fa92cfe45556bc4af60f183"] as const),
      Object.freeze([1357, "f03a6885a613d93b5bf27e62afcaffd5bad1ec08f238960baf04d4c3cdf4d5e5"] as const),
      Object.freeze([264, "94ec7217d0fb11ead98600b7b8aa2b71ee55fad6b936d2133088b33c9962a37d"] as const),
      Object.freeze([2922, "f4c491012226f9c08387bee278c9e91338ab82de5c71bbfb64ac62017df31777"] as const),
      Object.freeze([2902, "23f71618e47ebe1e6ce6d50f5290541213e0ecc426374a772a87eb75e4831a2c"] as const),
      Object.freeze([750, "0eebb2bfac9638f17b674c5990802c188a3a98d432d4c4a6737fb7f4551a9e82"] as const),
      Object.freeze([1532, "f75cc657befc8f51513048bfa7fd7fae85f7b689e47f300a15b0343e924b082e"] as const),
    ] as const),
  }),
  playerSkillbarObservation: Object.freeze({
    worldLifecycle: Object.freeze({
      functionIndex: 8818,
      params: Object.freeze(["i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "09f7a24660251675a31c309e26b69634943f0f8fd237358d6f2a52f638280ad3",
    }),
    update: Object.freeze({
      functionIndex: 8704,
      params: Object.freeze([] as const),
      results: Object.freeze([] as const),
      bodySha256: "8024d93fa3381ea4c5f79f15b072bc0b4b79965cf5bc7403214e1cfa31cb5aff",
    }),
    rowReader: Object.freeze({
      functionIndex: 8707,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "7b8b5c65a126fae2edfa517a4706244a0d2352c628fde208d049ecf82dfa4e72",
    }),
    slotReader: Object.freeze({
      functionIndex: 8708,
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
        functionIndex: 5951,
        params: Object.freeze(["i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "15508cad8f9eedf93a80c47a6bfb02136fc879bac738f5c287ea0f77a8a27547",
      }),
    }),
    entries: Object.freeze([
      Object.freeze({
        opcode: 31,
        functionIndex: 6887,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "b4707ba68961478b04bd26740a635e7e6057df00fcf8f213514d01f7bd2e429a",
        label: "CharMsgSendHeroDeactivate(heroId)",
      }),
      Object.freeze({
        opcode: 30,
        functionIndex: 6886,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "66bb9d030c176e18df76ffea58684209ca7ea855440cc44e040410a9a424d0c5",
        label: "CharMsgSendHeroActivate(heroId)",
      }),
      Object.freeze({
        opcode: 21,
        functionIndex: 6878,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "6caf9a926312f6827f6229981d48348d8ad07ac2dd6411657aef7e5e27de1f5a",
        label: "CharMsgSendCommandAiMode(agentId, behavior)",
      }),
      Object.freeze({
        opcode: 93,
        functionIndex: 6943,
        params: Object.freeze(["i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "ad0ba348c1b48828ac169c184038a796f80710d7ffd01888e1770da7f15f7189",
        label: "skillbar set (agentId, count, skills[])",
      }),
      Object.freeze({
        opcode: 65,
        functionIndex: 6917,
        params: Object.freeze(["i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "d6f6f3745e75eb42dbae4bc6def2c213626679b5a899c169871ea577fcbf2cff",
        label: "CharMsgSendOrderSetProfessionSecondary(agentId, profession)",
      }),
      Object.freeze({
        opcode: 16,
        functionIndex: 6873,
        params: Object.freeze(["i32", "i32", "i32", "i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "65ac54b88cb4b4e0155e7a6676628679d4aad9f994a64a989fd3f0de0a90b195",
        label: "attributes set (agentId, count, ids[], ranks[])",
      }),
      Object.freeze({
        opcode: 155,
        functionIndex: 10661,
        params: Object.freeze(["i32"] as const),
        results: Object.freeze([] as const),
        bodySha256: "875225d80b2c9e488980853f512f63641de3b842c5239f62c3989b3da677cd88",
        label: "CharMsgSendSetHardMode(enabled)",
      }),
    ] as const),
  }),
  skillSlotGeometry: Object.freeze({
    initializer: Object.freeze({
      functionIndex: 15736,
      params: Object.freeze(["i32", "i32"] as const),
      results: Object.freeze([] as const),
      bodySha256: "914b7d302bc76177c3b75ba3372d795198eb9b132545638b69c56996770f2b14",
      constructorCallOperand: 2157,
    }),
    constructor: Object.freeze({
      functionIndex: 6676,
      params: Object.freeze(["i32", "i32", "i32", "i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "b5676dd9e7301284cd9cb4b6966fc6c7a049419c6e39b3009cffc0d95730ed88",
    }),
    labelAddress: 1599690,
    layout: Object.freeze({
      frameArray: 5923628,
      frameCount: 5923636,
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
      functionIndex: 8710,
      params: Object.freeze(["i32", "i32", "i32"] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "bf9d20975bef60633facde4be95b941b97450536a33ed1db1de9535bec926c48",
      timerCallOperand: 200,
    }),
    timer: Object.freeze({
      functionIndex: 249,
      params: Object.freeze([] as const),
      results: Object.freeze(["i32"] as const),
      bodySha256: "d4066bccfd04635db551e12e16406e952e90e7cb3135b10b22f1c2c99ca2d93c",
    }),
    layout: Object.freeze({
      skillSlotRecharge: 8,
    }),
  }),
});

// Written by `certification reviewed-identities` on this client: each reviewed
// body digest or role fingerprint that matched here exactly, with the
// relocation identity of the body it matched.
const IDENTITIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "008cb3c8aa865ef17bf262bde0eeb10d29cd4f19a89a9ed22132a811835a39c6":
    ["7ba64128ff3485596cd1118b04dacfb20a5f34c2d7c6b8a88956797fbf3c9881"],
  "013e7a049e0be2d3e4597d1feee0bad39f0ba1fe1d5ffd82cf35397630264e10":
    ["cee7a410703bc755f2f2c9cb33e0cead8b2790810990c9a2b96fd302cda9dbdb"],
  "03a8933028dafb93280618f5b57c4f89081e4a2f351b9f608e937b0b3b4a6fa2":
    ["ea8ac128d8ca5f7e0e1d09c883802e6b751f99fda506b30f13b4c2fb36a9a75b"],
  "081506484a3019e40c1a934f95f88ff3911d70640c0f446afc6c3a3fb4975e5e":
    ["633b6d28b10abfbcd07753a31d6be17e6e355ba5c3316ed5e80ac7920f27fbcc"],
  "0d1d3dc72e383468c5c49fc0ea14529ad523d7bf24f34cb21a32784b4d9430bb":
    ["40904a9d0aab0bb15965cd2b407057ff1cf38cdf971ab0e7727435529c91c2de"],
  "0ee5b5c9467d14b8c3e9e18c1de5d05c7dfd558d588e3c90a6b6ca3f37db1b25":
    ["429231a3bef8c458df75a043f0531bfd8efc199d1d7d883c72a9281ceb2c4b4d"],
  "0fd33a5d55c00d25e364ff0be0c63c67a1849acc8f0a9fb5525560367eecb41e":
    ["db0de7a034ea05ecec5c463150acc21334e74020d66e2cbc11bb7d4d76961cd5"],
  "11aefb16d58b062416e00f748e1e57bb52c879322b319287dfee3f478200f9ac":
    ["2bc584a8e125d0414914730a66ea69ca2f5eb4925869b8949965489efe5ba5c0"],
  "11bc275741ce7dcc12a15fefd4325972cf706d7d73cf9f8b284b6fda720a71ca":
    ["be38a5900b22a9150da68ef9971503f5108f5db17163f3d393386a47671e8dbf"],
  "140a325a163f8eaec410ad40908b993e4a5d3532f51c675be0019e166253b173":
    ["2fe4771536b1900001a6e01fbc57b2900a0a363e90993b2f68615b725b2b5106"],
  "1c87ab4b0831420341935898d106c902d85897a116b4beb7492bf4ab3b1ea9c7":
    ["f141ce860ad232b7b3e6eece93dea98836d7e032faeb3d2cb012b5ceb45a5809"],
  "1d6008c169d1dacfa8cde21d77a071336d056d2fa14677c3d468154d8689532a":
    ["c64f48333ece3d85d605ac389c4a24ec3fe14f5240d606aa63ffbf86c915a931"],
  "1db8ba05f768aac797e225582b746434ca4b75d565d94aad4c3814afc3bd6af6":
    ["c0cf967d81a38315f171a7aa8b46aef98307361a22cab07f12f4f12493d17e73"],
  "1f58a402e2b2807caee4c761a61f62b060ea2c65af33eee7530f2191c727cf34":
    ["4f801dae00b6aa67f7472af909fc48dea2f9a3b0b17400ffae74f8d533b64abc"],
  "2156f57faba6be2669bd8eef6742a4f03e97c11f54fef48ce6551a5c364637d0":
    ["dfbed856b5103bda84fdbcbde72a6bc0c8d999a0a41d1a6f2586e19e7362e6ae"],
  "2295ea545e420022895bf4084eaa03bd8e47bce067db291c7e9ce2e1c390e89d":
    ["5ae9922efc3a0092d41ce2fb2a26e041a85e87ff772708c484bb50d398c38d87"],
  "231e2acfb02c205e75392f9226e4ce9e26a04dacef11fee45498ae1829cbab65":
    ["c432b5f450d794d0c5fe1043d3ed956f2e8a1aed9f1efcf2afc52aae257e5b79"],
  "2400ea801789bf303891d69663d1ddd898ca9f40edb34bd0902af7e9a924244d":
    ["60e8973b0400910d6eb5843850058955ee0344b3cf6180bab7772540eedafde4"],
  "24579d9f602bc21a37c0dc8ca88c362a38493c64d101d42081ccd6ed5314f975":
    ["668b35aa1c0bebab4f5c3e2060f48595180e0c8bae3e698e734caaa02444dfbf"],
  "257c03eaa91dc6baae2768b6829ada5e8cee32df0649482ca2f6950ecc766762":
    ["cef6bc6b66091967ca1b046db90c246d26e36f8f4e17e31a15c436ad69797e4d"],
  "2598fca9c7b8501d556bf382d75b285bdb5fc3b824a3f861a104035e88e30150":
    ["634325fcae20dc109da9060b9444b9a368d9eacca6a893f160564fe118c7ed8b"],
  "259fd64401eb59f8fc8de6d36be304107edbaa05b213321fdbf371233322fc29":
    ["91bb2d883820f68f2f29439766a85bf2cd50e5b1c52eaf87f366e15d53627ce1"],
  "269ff0c564e65fb1dafdbe7b0b64f4fea54ad989a2f07deaead0ef0d9e2ff2bc":
    ["8e93f8a4bdbcf6b7c6c998b734d79544981eb64d7eda5535b2532e8cf3fdf36b"],
  "27ad597ce36f810602ece7a1f39259e3ecc9381332ad4cdf7fc461b4a6bd9cef":
    ["fb27776bc66b5d410555e9bb045ef81804c44cd9025f9affec4d924cf31b1252"],
  "30e9eb346f79bbb0bdebad3f93503e4381e20951a31441543ffc39375ed1e147":
    ["7cadcee2032e3d178aa2c8be9c8716f9c04ce1eabb1a52d713637911902e5a44"],
  "31bd16b381bde0d9be77a421877194b870e95014ae46764982fa335d07dacb9a":
    ["67971a1202e5b9ccb9e0e2c8612c591a69868da904f9a0417839a5c6c5250dd0"],
  "35e374a944b7401965998e31575be14cd7fa30daaad6dc03804f713bff8d916f":
    ["d08a6fcf768f60c022e59c1c080c011fb4801aaed6cac4dc657b32d39f6c4479"],
  "3709d9679f87e42ce28cefa257af0e89727c0ec16c66bdb5f98482fdbdb8f98c":
    ["ed352be69e8a9141fc35986b1b73ca30b3925b483f5e62a37a10433c7d86834e"],
  "3789c63f2f9c7189d49ac9d02ba40a7c555fb5f07027d34c6872ff079ee97d16":
    ["f796c94e5f16021c7450bcb5d66ab20e65a1ed46a3084b1540fae4b77b8ea88c"],
  "3947df1c888113fe94a12fea2f3d500387b71f2e56b8ddf970d571621248b584":
    ["dda2994518aed06fbe0679c0f2aa2892c7d4151e4f91ece96c849ffc0b6d44ec"],
  "3a64401a973b9976e4158ffc4e4ad0833e091b22ffbe78987e72261187108146":
    ["4ec38f32a0878c313aa0b441f29d65f9c895dcd25ff49b958cf220f61019089d"],
  "3adcc506569c2134909f4a1429062c579d9e28a9bcdecae5bafa55b9120b71c9":
    ["9a8ac2756a734577b76704ba2608b6cac1b336f8912ec29b86346dcec2b35235"],
  "3b866a4e5d9e1e09b60c7e92acb62fb069c800e96ca0113e971e8353655e7ab0":
    ["7759722cfbc97c233c70e7f61d5fa1432c6b665fd87cdbfc920b4b220a53f079"],
  "3ec691dd53ed9441774e334e1cf646e9c5f62ca715c6069c2cc1080713852d36":
    ["b53e56d8e4f5cb57be31f0f365769381f527ba9e60318dc3877265f02e263e46"],
  "43acce2aef9325f192efa422dee707362fe3b16feaa891447c5256d6eae86099":
    ["bc05aa317f33dddad80730f4a692fa556114ed5a02db77de45edace7d0a6bc63"],
  "462cfc24428d5bd180773c5cec7a693a01b9cb5fcd790e8f63bb2ab10f5d2840":
    ["38c4f3bdfddcd162ee0d4fb377af3c81b3d8e91637fcecda46db3b2bed9b2bed"],
  "4c7ccdfd23aa3144a9d44b439df0293493ac7b04c19475cbb224580610c0e29e":
    ["a652f697ddda2c463a807bf9b4a64ccc0782e76dc8286930e644fd2ff641134f"],
  "4e08fe75a036f87d7582c61078a1ff2a88be012654c44008499ea48facb9ad17":
    ["b3dcfa6d9cdb7aae3efa7fa28549f2b88b436cbd31bbf7eea76d6040c0d76585"],
  "539c4f2f58df94f79a13441626ba0847181d55070e601c89245c052b7ac7cb40":
    ["60cb40f91e0838859d93504a5f5a66629e32f54f1d16635c3ce8e69dc5ae475f"],
  "55083539f7b4cc9735798476c6f1f41132a880f05fe0f80735c3d88df24a5fb4":
    ["5d233a2d5ec1f17e89c3113f0748f8359bdb08a8bfcfbfe76f97d552465865ef"],
  "55503d8f407c3fe2635098719d71efbd50ce88afb596b08cee0b62005e89554a":
    ["ad492f8d90004f48b52da7990f61f93d0f0a6faaf2ca837e39e0673f05b67840"],
  "55a9bca40e9e16713b0473d83afbe7264cd9578f0077d99075afafb076d5fa66":
    ["b48981bc854c21af1d8e9523265e79b6a512e55f573a044243c2a80b6d028836"],
  "5b3490ae4c66dad083b8cbea456d2e47d41ff794e9c03aa15acdf2b6523915ec":
    ["caf859e551e3d6989d3c321d13b4814ca22553daf8ef16d2224d71594ee9e07b"],
  "5b53e7ea08a053c2ac512a6b28660f8d927c477968df8043471ec2c2dbceee5d":
    ["78b6f7c6842b4b401601a4ed7a103f560fd68154ec5ca531ad80f6dc19e1c0a7"],
  "5f5e99bed43e89cdb3ac384bf51d5c61c1616fa16c29ba985c0cc4bfa6b0ea15":
    ["58d5b53c3a27dfe6ef3a58836e54232a2ab49da1edd8bbc3e17ee1ba53b8f364"],
  "5fd1c714b97dfb852012420d0e8d5f32e28bd9fee000590de08958ba78a11031":
    ["d6813f236348c065757d08142b9cd9a26cbc176c52375e6dded8cd0125651f18"],
  "62fdd53258c559ee8a453806b12dcd46d785e9f0696ecce902e8a46cf6243564":
    ["bd6acabc085b30a0936fc516c10b3ec8f3c58825c1649667e887cff907553e3a"],
  "638f35e1e5946dfa4db8234df2a68bf493a5f7b4ed71d1498aa50285ee4f2595":
    ["4381993cab0f0754fc70ad89c24c7750d11b11e2438127b6529de47ba8d1c1f4"],
  "6694fdf5dc2395af5adab5e60840eba7467316720b57c4e3a64f4526bb027b5c":
    ["fbdb43d4901285767db36c1d8b231169595c8a0d8aeb63c18ebaba1a2911a454"],
  "66d6960cf4f889c97977b4f8ae79461e0f7034b22c24af50bc19ac9ea4803226":
    ["9b91a62b83b7c5558d0467fb6f61595551a89f0f3a80e6233447acddd8e1c9c5"],
  "6a82f4ed9aded37247ccd15d5822c1118f9412c7be28c7d5b7faf3d0d194086b":
    ["0cd8384c97382595ba3b8e7324c2c7fd4dbdb2ca610b85b832598913bb707018"],
  "6e67ac04077857e0da665be75ad5ed98a9927a5607bc1ddbd78fb1ab8039f04c":
    ["79a3b29b221be05a241fdff46781b219b27b07ef803e70e8c086a73485c2241a"],
  "6f06eff3b66948891fe3e291a62709706f41b2a47dfb20c00054655f917ed187":
    ["12afda26719a625d25f88f9dc1fe3a861a242e0085d1015c49e2fff2665e4ce8"],
  "711990b1affb366ad198616fd59fa6802e0ff1644070b2fa46d844556d5be8f7":
    ["2a08d9ca1d7f9688c8d05eb3e4ab875d545f0c3f4959aa8dc1d5480e7c313d05"],
  "7a1b17e51097a6599a036629fdcc630afa0850bacb0f2998d0ad8107d39ec9b5":
    ["b7e7231ab6a341a3f60b506bda3d27b1a7adc4fa314227bcda3feeaf1ea5da09"],
  "7aaa435337e435feda9d0d29ab7f66079f92cadbcd52c1bf2749de775e883799":
    ["58876fe68cac59df55f654229e9f0042365834ca20553471360a787a2c1ae46b"],
  "7b8b5c65a126fae2edfa517a4706244a0d2352c628fde208d049ecf82dfa4e72":
    ["710fbf097a9b3d0c980ae374fdf104a0b85894a446808f9a426f60264f24f923"],
  "7f1603650a1e2428354420bdc3ca9d4b4c9e678a2736234277cdf46755090311":
    ["2b724155a0d24b0317edcfb3181c7daa48b9242ef92cce446084ec1548cdca43"],
  "8492fb8cf18d58dfb55b4659663684f521cca7e762393d2e9657b0cb59236e26":
    ["e8bfdd035cf6e88c82d29ac69cfe9e5e785437002d462bd5ce6eff2ad4d4779e"],
  "85dd3fead9b386dc920924374f8d12bc8a0d6ab7d3f84e9240c0a6a918c87ee7":
    ["0ec68df06126eeda4373686680b3358e1211241bb7d8dc815863afd3d0c20868", "a30cb1d01f48e5bd931513fe80ec7d97af54d6d6a7e9f44511a85c78dde9e6ce"],
  "89a3bd86b2316709e91dc8c6e29fe0dd146bd341ea67500c1803dc90833ef0b5":
    ["343609d1b72ec885303add25ee35ab43bb6259448cf431de1a9b7f092a477d5c"],
  "8e87304b020e158179c2a265fec3d2b82230104b60f1c55db6aaafe7ecfc7936":
    ["e7158908548484dcdc450494484e35df3c715dc710a8e46835bc860af0973240"],
  "909d3055f381e82ee012e2c97a30fd47770352ae4708fcb34c4ae65313dd55c7":
    ["620dfde8338508730c39e3c3e51c58fb1b7fcb7c27145f23b0d5db68d120911b"],
  "90bf935b288798d9383a84eefe73856cbe2048635aa7702bac56b1e0d5498436":
    ["9c7e07af7c4210ca7346ff9a9d63e268423c665581e8425f4f50122fc468e1fd"],
  "91693fa5820bda13bf3b39eede0b8b9fb36d7f82a8a5c23e086505f0510a3cb2":
    ["77ff55e0aa5f68a600ae6c1713f7dc74bf9f129b655b8f969d8afde613408312"],
  "920bdcddd2e428f6263519e2dfbb314dd7f73439e0f2b6defdfe10c0b29b7d7e":
    ["84fe6082d2a2ca5dd384320feeb3d374cbe9468d2a8519ab7f579faf16bed737"],
  "92bfe16ed2f66d3394546ca883489b0e3fc629125a99c6d8d67309bd1600677b":
    ["a113ae4be9a566aab619f0acdb7f4897288fd035550c23e2dbd0e17acd11cc6c"],
  "92fe2aa71777d546d797a4f7850cb59b1693f3b2937021dd5cebc85933403e07":
    ["762f4d097c79f3fd89d49a2a24f76b0f0fde8e3eacd6963b15a1e3b2f831d71b"],
  "941d0f4ea3ce80d1787e3163e16cb06deb129a47f25ca91b398add3222a4082b":
    ["50363262f37ae048f0b16f1e99b1cd601ddccb796adf1789956f3979982612e3"],
  "9f2fc258978975797eaaea36847eca28e5cea7b301acd36e9c3b49e3659909c9":
    ["f46094e78afe3a35be7417ad0fe02cf767421c79aef00c0c6b11b05f4a5086f3"],
  "9f4ea1d46ddf8beeb429cbedcf0fc6ca45f9405e3c0f2be8ba43891721ad3375":
    ["e8311dce2646f1c86f256f03555b6744695ca6e41321f6faac2d1854be3a0308"],
  "9f73f1018d0bf99fd0d16b6ede0921dbe29cf70a4da4a61c9b24c1e68dbb0bf0":
    ["8f7492c5012d80e6552e0b769b550ab6902bc733c54e322723f21d6a25807963"],
  "a3d603997c440ac3a816c9320d701d7e5fa1557adaada16515dcbe1456b24c3a":
    ["5e5178cb6304f88f178a50b383c50ce29d834e45d9608d6ca82125899770809d"],
  "a49cb6544ffdc9bf626bf6f4f1dad626852dede0cd087c3ff1226a5d866de71a":
    ["ab0a76e5bc09dd884952b7ce556785be053b196df806808db565da9fd61fe64d"],
  "a5c1bba06bf15728f177f452f266184ae622085f78ad344baed6c3e5a7133bc6":
    ["530a18f196435670ea99b70f7be23faf18271fafc8c2a00798f6e9c63b1d2ecf"],
  "a6c78374f4e6a901900a6f8102a49fa487170877630e532b9e1d9388bda1d93a":
    ["b1576c485ad2e0286122cf366efed176fdf78fb2ec3919b07653c559f2a0da1b"],
  "a8dcb08cbc985ec871d8537d056bb9a702c0b3dd33c1efdf19dfc6ba6cfbcd4c":
    ["10b7e511648cf8c5672e474d9b0dc2233b25b310879132702c7d6e73abff4a92"],
  "a99214933ed1c82fe6ce45a9c067cc87b374389e00c87373defa0faeb6dea402":
    ["5031a171d2bea1c4519c10a2343f296eb9e35b34f741ceb8458b1fbcf9eb13f4"],
  "a99cc45b1dc37974f3ab2032d30f7617ebb5f0d45cdf249b2453094b8d49bb41":
    ["e604e6e831e2d7ab9ad16f12f807fcbf8884ff0013d179b7dc0d7edc2ff6bf4a"],
  "aa5940ad3b732088ba52c01622933fca7ae1127e81f413112153ea674d38a0ff":
    ["c853805e7bb9f9c25a5c71447307afab673675c869e96090484ce3ffb8cf1ccf"],
  "aa6e200ba8acc6089f4d270158e47c99900e3878e50bd8a60b619aae729fa0c9":
    ["3c0d619f9626efff34cb09d85771ca7a736b28c7815fbcd7f21a83de55515dbd"],
  "aa73fe42c13b207f22b9fb3ec2a7a390119f8fc0f35a3a1a2cb60e84f43115fd":
    ["a7aafc8a02c127af5a6c29810cc7bac69705a7693a5b2d4dbec4940455694865"],
  "ab27a71f3fdf9ff46fa4f73b57be6b464048f70adc627f9c8d123a58d43909f0":
    ["4f069cb80adda862cca73ca594a93f59d8fb4a57e4f7809ce52108c665eaaae5"],
  "acd056753294c376b38435aba83bd8bfe11276b0ffd53e9ea9ab75f3bafd2444":
    ["34172ea0b414d4808126d9a14859517a01f6f5cf02e52d1675457befb650e562"],
  "ada7f9a374a6a34216e582e2d3c5a4dae59891c7a3431f3a1fc52eed62548376":
    ["2828e57bee2ed98076249773aa5aa58a3e358904809ea911779e3fed8b996010"],
  "ae58140cf28e2d6afdc92d731da94fed2945fc501911160624cce6fddd37aa05":
    ["5530169406ca289251afcb027cb73d791a61ce93ec45262fedaa1285bce8faa0"],
  "b0ca60097a5aaaa6a371046a092ef3ad04a84b1f56ab6322e4e8b585beee721a":
    ["b40a80d2ed0c343b658b6f7cf3eb25d1bede86571d592b6da026e9f341bf9b7a"],
  "b12924d38e54a8aa3ac1804ce10d5946da4c3d41a1819f6ad32dac2e017864d0":
    ["28f8a9b2d52a107b012b618086f3daecdfeaf5069964f2bf2799771cc670add4"],
  "b19d00a9029e6e1c16f5afe2c4e4559483e764908ed1970cd7c3332a4d1f16bb":
    ["2c2f52d008adbbe766e6ccae3e20fe63ede1a8caeda48e442d35bc403656041d"],
  "b2c8c1c5c29e3d65ee2146c6188a3b424edf312b1aa0f09a33bde70882553835":
    ["af2402dc30b7b920fe13b052df3beb162384a2cde166048d6ebe4b55c1a32145"],
  "b2ec78d3eaa13c6a4ec8265dd5bfbbc7611d17a61e8361b37849522f43dc38d2":
    ["8c6b9eecb238d71764d59b6624d1b32d53475dc05f93ff764675efce8591284a"],
  "b5406c64785a6e2559a238e271085d119d34fc45c36a2a4dd404ec2f09a67625":
    ["756bc09293b2e33b1759f59bc7f4ecc7b4de76281a8b555e583883a016e26956"],
  "b56d90085c4ecd135580c0a56b6442e35dcdd5762c3a129bb09c7d7aa8ef8a64":
    ["fb17f3121d432cc673cc357c0b41a70d2b655d0e4ec338105edca17bfb809eb7"],
  "b9b40600c58634730684ebf668a33af0c500f99c7e6e4c113e131e0692730e94":
    ["7bea8f8b4f6cbb8aee9548260eaad539f61f4e04a521abbde6f78a45c362aca1"],
  "bb472c938517d6be0477a7b15cd387b1acef31a8572dc556a2072e615af91db5":
    ["cf568bef67513629657c641e31b4166b521b3302ed2d0e1f27c82dd9200da3e1"],
  "bcb52eb689d92cf731bedeec30cc3472e83b2cce588c347514f63429b5fd0323":
    ["a3a322628c405330c0891a3419438905d746b1e2222c02bfc5976ffb6d5ac286"],
  "bd1a37645f311cea53ba09df62c09c40a1c67aa3c7f61faf5694d5b5f1ca06ce":
    ["33636da09d6b1cd82fd00e263b649f489434d9f252e8f35d84f96a02d93daafc"],
  "bd4e7ffc1a5f105cac4588c61229977f7617d871438ce8c604feff9a39b4e0db":
    ["9aa791522d9b3d19c1c026061f80c088a09d45498bd6c5cc1d5cce3b99168c8b"],
  "bfe7d8c9ce9e40398c1c4f5ef4f237745e3dbd300f9d1a1080ef1d061ea6a5cc":
    ["dd8b83b3fb6212819e40039a08b2a3a661b047b324dff109d995cea9ec7217b5"],
  "c3a3d7dce4248e26482d55ee0adcedc5c65af584f3d51af700b923d3fc242c81":
    ["a1aa91cae789651bfb39d425b0235a95d5afcd138a25dc402a66235486636407"],
  "c4edab6f9b07609efbb005194c4bf075b504c0da552637acf79c6b8805aa3013":
    ["f9360690c57b766b286c114def8780029162f9f10411a949795b1292cc7d82e4"],
  "c6ef04ab4bddab108d5b0f7c90acb55f7d6eab79b0c28355ca89b43751c02060":
    ["2512caa525b65b5f06be8142134c1bcc7197fbdb3b6ed40c875fb3425cc69975"],
  "cd19729848a8981a6c93b2e6df14d8c65a6b9861557319b876b27e176e8bb2d3":
    ["0f5357f94631a6c10cbca52839dd46a7cfdcd734c54295c7fd220fbcc8130c67"],
  "cd6b4adea9a0d131da290460d6bd379487e59f538297b8cf327a410fef3bae38":
    ["fad5744a7e192aea391b021979c372dc37b85402642955d50f5bf42c862d0186"],
  "cf1a45dde7bff3edb7a2b16c9a074f2d8e86e15e32560f0d9efc4395046f4649":
    ["90db05dd20a778fdcf58f57bdcf9fee038b3839cc594b4a9f6cff69dda8cd0a6"],
  "cf61db8f13d258c90d5005bc4dc3d8d72f57561febeefa27428cbeac5d6dd6d6":
    ["0cde501c58bbe91864997e1d192886216cb834ae1eb962ca96cff12168614b76"],
  "d0dea47faa8e0114370878d1bab2946fb5372d236cf481e9057a5e2ef6c1b5ed":
    ["01b1ed90e1edf24375dab1a7c128c4cd4335066f4d710d5d2accbc8e06f7dc6f"],
  "d163b9fd10495ddd5fae4947a468532425290ee316ba66190e59e91b7471d5a0":
    ["867bdc93b93d626ea9ce52577e57c1f199dd80b009385e0855ea200005a0004d"],
  "d2b5f3bb6b551397cff3949a5a3b9e758beb1251cfdb47fc12115f4300697ef6":
    ["7c59c0a5b6718872b4295182704fc300a631cf488a7aa8a86977786bf9f3d8a0"],
  "d3cae3aed2485fa4b3a309b096a5f6c3d542bb09c46e2d03c92790a05e53112f":
    ["e095dcb7751866e130385218a3864c35ec69a0e150f38ec976dbff8fdf390864"],
  "d4066bccfd04635db551e12e16406e952e90e7cb3135b10b22f1c2c99ca2d93c":
    ["ead316e17d0faa1453a087a5100e6ad5c5fb41959a4b6c5b0580f57b525b7d40"],
  "d4eac5d760c62f0df7188b1b6153932c46b080343f0f37f439e495bf48227ab4":
    ["f59064dcf99198167302bd62a74bf09ff7d4bfb951ff5782a51e77f669b06e75"],
  "e2d3a0903dd7eb7595e118466ce74d0e90f9f38c81068c8cd2fd1f8ab0570338":
    ["f9530beb735a496f09b0d6ec4379c421516a7db56c6cfe2c5d392cc7f74e1dd7"],
  "e4e61ee10c161858ab5a05ede4649e8a09649e4035327fd1a564e5e546443bb1":
    ["a91052caa1b2b303dcbdf1245fe572c888cb0f3cec600a44b352e9c3414696dd"],
  "e540fcec2dd0710537d27a0418831dd6beab57871171ce96b7295539d93e37ce":
    ["1a4a8f80a4a37645cf2f9ad8495a6740cf73dc8f8253a93d2b524c5b8ce835a1"],
  "e97bf7c3b2f0e47b07f1cde77500e509a88ec364a94fec0980ea3862ce04b7ca":
    ["a5c277f67be01b76bfa692c4be86af2d66fa2b62dfd20b625ecef958b8ff6e93"],
  "ee41be1f4dcaf8e5822fc024e41cbbad74cf293cdafb2b89a8691aeb680e68b5":
    ["5c2a8e5c1da2b4717f906d4ac75ae9e0eb10666fb58400550ccc3334cdbfdc32"],
  "eeeac28028981ae6f233b2c0e6ba4cbe5cdba999bd1063c2a703bd3f6cc1f6fb":
    ["768900f26ca4938be8aa7fcff407236f24b3f1d822c57a7eb9028aa193a1bed0"],
  "f1445548fcb6723f0e96e9b5455a7b7b7378702013b4ccaa955b6af82d03c1c6":
    ["866c1a7212716e804d29cf7a89a3dd6b56b7dbbb3a5a049da373b3a3829d210e"],
  "f1bdea374b3bf67822e7fc8ed4a173b7e213ee865d77469c8a4f77c560aad0ce":
    ["5008dfb0027246d1e1825d1617d005e5cafb9bf35fd7422c1eb4e277a6ac0ec8"],
  "f1d4d25243aeb652707797683ed6118569f606e9e3a69040eaa3789f737dcc7a":
    ["2d1ba95bafe9906fc2a5bc3a512d535b1c015953502af4fd9f2aa6bc353d2bcb"],
  "f4649cdc08d2f6cec6d2719956745aabd769ef5787dba529cc476457de2daa66":
    ["0385fb3abb8f05f322b89d21e8c59d87281ef4b6907921320a276eb22e6edabe"],
  "f67fce69172713e734d2a8ee44548898f878ed2de1821beb06a9e5ba872797b5":
    ["c0ae42a44113145ffd4c96b689ba7ea8ee1d448624067ecfdd07a8c3ceed4a43"],
  "f7a2017ce827175b1c593cc6f62f34bcc06c43593157a8f267305eec062e9a0a":
    ["2ff5607595b18fafeea320ae1076a9850bce9a961cc86a461ea8e03542c4f50b"],
  "f7d8b9b0af470b4b8811847f143b5dc08b3a929ce1bbd70773d97ff13e3efda7":
    ["90b797897b99edf8f1148a07c1dce9ae1f42575221ea073fefda864b984da043"],
  "f7f2072bfcde3b833ff1c388e9e1190936fde208e69e8363b732ea3944ce4f7b":
    ["58b097f1abea4f6c552decc203c13f53d5cc12ef675e46beac2c2abd1bad24a5"],
  "f87a53c521f38915783764c18327bb345ac6b4e1ee89e4b7a7a6c8fede9c2d76":
    ["504c9e7c2b68b36a69baa7fb1c2e5ed653ae6ee5c3a7ec66d83b2fe053deb6e0"],
  "f8b8bedf6f71429d4c03eac5b02a1b0b397ca696361cf014dc89c2639b4f1875":
    ["b71e3f4487357996d615dc2237ea6695f1ccb35f0702544ce4ecd7544c3bfbfc"],
  "fa6eabfec92de162981e0cd861736dbaf8b7b4f43db37224829947441f480a73":
    ["bab6edd18823519a5bf11dee6472a9f2536daa636a16de7245d39ae5b9c9475b"],
  "fb40f0e9f5c3cabc04af92178d9c724a4af8233c60360df2e12487614598b66c":
    ["c1a33c6986ee01a41ee2f0540f9e918a40122755481e8d23e63824efc7dadee4"],
  "fb96881d692f9e58bd28daaf2a4c0f2872c9fe2f8f19b5a7248e244fbd91a03c":
    ["84eb016c3d36815e4b14ecf62eabda40a045dfe5c55419293a68eee375d103a9"],
  "ff540acea56ffbc5947288f9d461495e1970006fba7799ffd9d2b1dae1d06b93":
    ["41d33aeaf230d0bbc6f3c528dd9e96232a82db7fd24c9762882ba8a0cfb84257"],
});

export const OCTOBER_22_FACTS: ClientGeneration = Object.freeze({
  id: "2026-10-22-ce3192033b14",
  builds: Object.freeze([BUILD]),
  memoryCodeSha256: "5fc5ebe2fc2de26fa9b3b2c00077cb7afd80a34a73d0f4dacaa6b81ba43dc0ed",
  // October 22 renumbered the October bodies; only reviewed callee indices and
  // relocated operands differ.
  playerEffectBodies: Object.freeze({
    "7df2376537653cac9b32172fb51073fa57503b1a2bcceb317a6d282d1e13fb0b": "8bbf0be7d8031c7a3ebb9a6d9311d4849f120352bd61e0a1abfc02735107686c",
    "18899c4be6bf2fd51f6dbf6e52241456cdaed94d912ed23f307c95917bf615b8": "d420d0eabfb51b9ecdb930d532f282b101febd003fffd8c993ebc9fdcd4dd33b",
    "1f2d462100add0c160d62265d2eaf292a00bfd1cde84c38c1e51f2aac0a2cc57": "4737741bf201a48b379bbee09bc56731be209b5c886c4215c42bf8c3dc9abd88",
    "a560a223d9756fc3579f057137601853ec23c2b6bbd57248216b77ce550d29af": "fc2afe3ac91e845eae941170a63964156daad419c4d82d54e17227b694bac250",
    "ecfa62c1bfaaebe98c2047ad986e137e9695a3cf2f0f7d5f6367b6e44cc10894": "9a39085dfb13220e6f834ec96f99df624116e8a207c57c07f22466705530c5e8",
    "3fecf883ff7543db3cfdd8f3d77fc5cf3ef1e78282252f4f3caedbbe4f80bac0": "72adab1b90ab319ebf714722d199675dabdbf945affaabecabaa215cbcb858ac",
    "fe97a736b61e83cc5ea5a84f38aecedd384476339c5b02594fcefeebc5ce5203": "946992af3680b0217734172ccc0a70e7c283a44eda54edcf399a734791e347c3",
    "cafd172e56cbc1efcc64eb281fd8dadcfb6aa305eb4c165c0959f0903f98f769": "c9d06f44e8f7c99f976ffeb728e1d8e8490a8b0202b857e130f834098ccae03d",
    "5e0ab6365510501ff760de8c3bdfb8682bf918e092d9263441d8fc7f56403533": "5e0ab6365510501ff760de8c3bdfb8682bf918e092d9263441d8fc7f56403533",
    "7340dbe70f3f4bf731d23f80882df99553e837f825d8bbebee7f8eac45d8ef58": "d4066bccfd04635db551e12e16406e952e90e7cb3135b10b22f1c2c99ca2d93c",
    "9267c76c395a6ca5bc2efd0f9eb1cd3234feb5c95041a3e6230c98f23f9a4d60": "57a88a1a84b4ba6c6f9d5c38dd215238dcd3e7cf2888d6b2be41429673878f64",
    "d5e3a36c3336cf3e42867228919ae973072dc54fb442d80244067a3f308b5fd5": "845200d2aae2d929e80fa3ebf334133e6d9dfa4fb1d2dfca3383c0a5c6186b14",
  }),
  identities: IDENTITIES,
});
