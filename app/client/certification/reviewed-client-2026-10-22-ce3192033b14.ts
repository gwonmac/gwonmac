/**
 * Reviewed facts for one ArenaNet client generation. The October 22, 2026 client.
 * Runtime certification never grants a capability from these facts alone:
 * the isolated semantic verifier re-derives every fact from the bytes first.
 */
import type { ClientGeneration, GenerationFacts } from "./reviewed-facts.js";
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";

// October 22 facts: the October record remapped by unique normalized
// function bodies and a conflict-free static-address map, then reviewed.
const BUILD: KnownEnhancementBuild = Object.freeze({
  sha256: "c32b9ec13dc3d64fb50623bfd042e43ebddd8fa60f4090c508da73a2330af686",
  outputSha256: Object.freeze({
    "features-3fffff": "16fb108f1dd854261eba0c4b55d242b466b14da1b3cb821a14efd2c4277f3096",
    "features-01": "9386b293463ba266d75a422462195a2b88ad078df6a1a13efd59a65227d6d9d7",
    "features-e01": "2d1fa24da2c667c3f008fa1e7ebc538cc513b2e361f2bdbe8f6df32e7fbc66fd",
    "features-601": "ba822ce0509909a04316f769e6dcfad9d0f7835b481f81fc066c849d4a4cee36",
    "features-200": "64cfd28ed72a9c3b3c5a12dba857e4ba48011ee18fb2ff61e5b381ddd9da3dfb",
    "features-202": "66e0903b71bda02f3bd0f1fde7669addddab9622cbbdb7d8f0aa44fea35919e1",
    "features-284": "2ba006c0f494c7677cedcc923d011748a7d79dab75a90c00f11c594d95e9bf89",
    "features-285": "35753cfc1846083372d89cbf73c48254cce10a9735e53f675e1bf5aa02ed7268",
    "features-270": "dee152ce490399c4251e7737c627c6e6188a04ef23c6c3d69b917a4a4a49f83c",
    "features-2fc": "0e78c3f95ebdda533c20bfe4de7e87520fd0b8b4b43088f23cd6f793690ac92a",
    "features-c200": "2c0c375e2b28660cd0f3722e5b50b8810baaeee6bb67db837b700dd29cd1931f",
    "features-c204": "402cc44e348e269af7ff17c98f6ed73fd2e09d5b75d5653d2f4ee0d5ae54fed6",
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
        functionIndex: 9153,
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
  "0185f0d5b13a947c1a5f7219ece1a98d0beb89a43b12a0f3d9bb617d0505d384":
    ["b18e69ded07b67e39ddedb75cfbdb43651e9e8de473f7b71498d847cb497ae92"],
  "03844b0c6a4d337ba3fe8d0ff5c2a49d2e0b0361139cf5304f7ad96d8c45077c":
    ["fa39d836468a4d7bfeabb4d0416a0e48f10b1d86f89a02e5968fa2d62e595f1f"],
  "03a8933028dafb93280618f5b57c4f89081e4a2f351b9f608e937b0b3b4a6fa2":
    ["ea8ac128d8ca5f7e0e1d09c883802e6b751f99fda506b30f13b4c2fb36a9a75b"],
  "045a6ee62e8d1f734569522014a858a6758b2c3a539a900f28d203acc5669d04":
    ["6eb39c48c24795640fd51fd6f324d935a202f9bb65aca4a9223a3a482543e387"],
  "04fc81d673ee0a07d8de4e00a57d318c54cb0b68230f6d86fad10ec03d88dc08":
    ["b86c34da6fde263c013413c5c7a7c6fe93290b326e4a4a13a830018f5543d531"],
  "06c41429f7f2d794d0c061e23335f11cb06a2e7a02a8a81da39988eb81f569f6":
    ["20f34e0e3ab066c14cdfaeb2e97055996a9b116961d8b1098ee3ffe19fa9d5bf"],
  "06c86f4e20b8c3713eaed0f50ab36aeedef50a7539649dbdfe2628a3ab5554ff":
    ["3e2a2113fca4a5aa7c597425a3d36731d7307a295dfd31226a5c0fc4016f45d0"],
  "081506484a3019e40c1a934f95f88ff3911d70640c0f446afc6c3a3fb4975e5e":
    ["633b6d28b10abfbcd07753a31d6be17e6e355ba5c3316ed5e80ac7920f27fbcc"],
  "0974bc46436ed9ea7c2d7c18f8c0b8a23dba3ff7e8d22c0ad61f21f27acd7948":
    ["5283c89f061b5d3930b79ad43c950331c7502ee98b194ce289d665aa5617983a"],
  "0d1d3dc72e383468c5c49fc0ea14529ad523d7bf24f34cb21a32784b4d9430bb":
    ["22981db80aa6633b55c2ebcebbba20fc79a03f0d127656f033579d0c25518d87"],
  "0d43f0fabac0c7d463f4a6b073a45e16941642f88416841b0d8524e2348b38c8":
    ["080bf7b418f0bb8da6a067a909173ae1288cbfb1249604d63357aa5ffbca1b96"],
  "0d881eec84eb2b448d3369ceb3f3225398bdd4ddfbd4f94f282422f24ed956fe":
    ["d9e04f19238346b2a664cd3941b2be84bdde378714028efa81361a4177d669e2"],
  "0ee5b5c9467d14b8c3e9e18c1de5d05c7dfd558d588e3c90a6b6ca3f37db1b25":
    ["26c63b8f9999a4663518d0c4d14626cfb969b82819c69880e4eb2b24ef8592f9"],
  "0ee5da3f9ac0784d90d4929af0c95fb4f30a6031131d2bb6448ab5d65347ef2d":
    ["7d9830071f6f427a9c6b22fd2a48298ad64576f793031d5a1c34e5151e33ba18"],
  "0eebb2bfac9638f17b674c5990802c188a3a98d432d4c4a6737fb7f4551a9e82":
    ["1239c8f3f2ccdc369a7b7b4866cc098e30a5aa7ee3bf7445376c57a3e4351141"],
  "0fd33a5d55c00d25e364ff0be0c63c67a1849acc8f0a9fb5525560367eecb41e":
    ["db0de7a034ea05ecec5c463150acc21334e74020d66e2cbc11bb7d4d76961cd5"],
  "1082760d337d455ea976e2b6c9b99132e0e529417af2037e70ca08eeed819f0d":
    ["41b329f3d01e85baeeb28259af86deac2e0e800d8b1842c6105a5da7fd324812"],
  "11a75789cdf24acade096cfa060b013d6141704fbbb74af31be80251e4b71b9d":
    ["7851a09c10c50be990c928fe708b4c327a9d73cdb59f8dac807c4bda90577258"],
  "11aefb16d58b062416e00f748e1e57bb52c879322b319287dfee3f478200f9ac":
    ["242e00ba2134d19ef661953d99492851437d777e6fe8fedab6713d2cdf32ea79"],
  "11bc275741ce7dcc12a15fefd4325972cf706d7d73cf9f8b284b6fda720a71ca":
    ["a6416351894f07e9bb6d6137823b7ff1eed28af0bbeabedf0baaa4260c4e98ca"],
  "139139b77f2ae9ac179610919f9ce2bbe41a3ff5b4e76abf73bc5bc4bb3ef83b":
    ["4d6e859e7fb83f054316f25a0a6d60fae57184bfb9a22323bed613695fcdc94a"],
  "140a325a163f8eaec410ad40908b993e4a5d3532f51c675be0019e166253b173":
    ["2fe4771536b1900001a6e01fbc57b2900a0a363e90993b2f68615b725b2b5106"],
  "152773bfd5a8ce9f2c57da2cce836665ccdb9e4a1dd91848a7f2a6769ac091a2":
    ["0cfddbaf3a564d43d603df94dea77a4b23bce6a18195b8ae05aee93c6613e92c"],
  "16968cd2810aadb90cac6a524ead33cccc3d633400cacb599770391361847b99":
    ["f0f80247a9b6bd5109a3f18a06fb30bf1917b167ee16275d3dfe2cd7688e6f22"],
  "1b0c75eca543e147f8a6ea4965befb9591b03b8b482586bc45b90f47eef77ac0":
    ["c22631748af37e96b6ab41d6e2a216db5a595c88b6d9209c57ce28c7eb76df44"],
  "1bcca33c2669e2c14a46c1c325653b3c2e73bdd073b4ac7194d27922b195f531":
    ["f6d816f6db087c778bbb06de6ebe5040b28df9b872e53e7d191ab3c392123979"],
  "1c11192753e67ba74ed7db55945f93c10d72b799061fd31b496fc2cdc0d6d26b":
    ["9db1a85a67de29a45357f1d421e59da23549370c0ab4c8ae4998b44e458674f6"],
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
    ["523d50c416b67b2ee0e75409f9c82d842b4479eb2d961c8e85b269e0043c3a3b"],
  "231e2acfb02c205e75392f9226e4ce9e26a04dacef11fee45498ae1829cbab65":
    ["cd929016612afa26c2411b55a64e6da744610fe7616505d55a3dd320c25545b8"],
  "23f71618e47ebe1e6ce6d50f5290541213e0ecc426374a772a87eb75e4831a2c":
    ["79c5f1124476e87ebe358c0107fd8c59a4865e6d53d34d9c69f99156b9066216"],
  "2400ea801789bf303891d69663d1ddd898ca9f40edb34bd0902af7e9a924244d":
    ["60e8973b0400910d6eb5843850058955ee0344b3cf6180bab7772540eedafde4"],
  "24579d9f602bc21a37c0dc8ca88c362a38493c64d101d42081ccd6ed5314f975":
    ["668b35aa1c0bebab4f5c3e2060f48595180e0c8bae3e698e734caaa02444dfbf"],
  "256397ed0536d44ea656323cddb51bc29fb2b87b6af98a5793ff8ee9292a7c6a":
    ["7678af8aeaf2cf29c8721eeffd6698621fc400e0698455888ec4e7fb2a3daa85"],
  "257c03eaa91dc6baae2768b6829ada5e8cee32df0649482ca2f6950ecc766762":
    ["0c803ea7029ba6abaf95befa293d19a10d6078ae270262a1cfd2e79f82fa4162"],
  "2598fca9c7b8501d556bf382d75b285bdb5fc3b824a3f861a104035e88e30150":
    ["c40d165a5d66c7ff9dbc8fb7ab729b7f4b1d2eb95a41331d4771fab57cf8fafb"],
  "259fd64401eb59f8fc8de6d36be304107edbaa05b213321fdbf371233322fc29":
    ["91bb2d883820f68f2f29439766a85bf2cd50e5b1c52eaf87f366e15d53627ce1"],
  "269ff0c564e65fb1dafdbe7b0b64f4fea54ad989a2f07deaead0ef0d9e2ff2bc":
    ["1c20c79ded7175657550e254de96bfd7b964f9059bb0d2b576be3c0ea77cc7ad"],
  "27ad597ce36f810602ece7a1f39259e3ecc9381332ad4cdf7fc461b4a6bd9cef":
    ["65fcee306bdcd934a1dfc8fd2ec184f4f7e784cb76d4554a3413d0b636a07977"],
  "28d6b4daa55ba4af3b714af8d168812cbe9142517924bb38111a15d5f25ecab1":
    ["895d44832fc56a1210c4403e99555e9713821af0d31bcabe81706c2417b23a5f"],
  "2a2380fe271d2f3933c1749f73bfffbf6d967b605a59473d0e449053cb937dd5":
    ["b9b44fa3ff0c3023555e9ccae5964a86e3a1bf44c882149e9f3e44af4aa7411b"],
  "2ec8d3270f621a09393cdd241baa010971550cb10d69206de4da883f7bb65524":
    ["13b7e8d96ebbd9a9cfbdab5cdf160ed811bd058f98f7a27e0ad5f4bbd0fcba6d"],
  "2fccbd179a983ccd28c27502d6d17d53989d02b1ccb0b40e4b139bf55935018f":
    ["af05690338ea7e8815f3a23b74db2d3e042004ec252a94e65d988533f0213a82"],
  "30484bc0e8064e33a1857aee6f826be04522e41b64027516a2fb792976c7712f":
    ["c28b88e5875376865909eb0776c75b1506e9399aef63059e971d2da7fc9c96cc"],
  "30e9eb346f79bbb0bdebad3f93503e4381e20951a31441543ffc39375ed1e147":
    ["7cadcee2032e3d178aa2c8be9c8716f9c04ce1eabb1a52d713637911902e5a44"],
  "31bd16b381bde0d9be77a421877194b870e95014ae46764982fa335d07dacb9a":
    ["da87a9b4fdc0b66f00aed646f296da5266e0a5920b52a57e9d2bd248d5190205"],
  "3317e78afc6f79ebe49e205870dd7776c79856917cd6865a6e0ff1a87a5195e2":
    ["4f52c79d983cf6c9db538a2d9659322d29cf25c29c60952de3a200ed7e3e57df"],
  "35541e26cd5badf9bbf37b1e7a57489cb762e5ecffcb0f90e4069d4c63bd4c09":
    ["3728a1f5a3b57919c6e1d88a405167cf1f468b72419a43012f1d0491f53eee88"],
  "35aa20e5d81ca4dfb8962dd9bcb1ada197af1bb86001f6012fc1bdcfdf1cca92":
    ["0cfc50ada6cd0dd41cdaeab76568edbb7d19f17731d2990e3f3d2a6d4ad63162"],
  "35e374a944b7401965998e31575be14cd7fa30daaad6dc03804f713bff8d916f":
    ["13daa10ca7f072230222e10a70a93e45cd93734c355369c54baa0638be20a911"],
  "3667feefe1f218d803112d8c3d2c3f7c60efdaba9694b80a0ed86fe1a849d646":
    ["f6e560c11c6c9c8de4eb24c0088e6efc9d0b972060caabf19a82ed62d113ad06"],
  "3709d9679f87e42ce28cefa257af0e89727c0ec16c66bdb5f98482fdbdb8f98c":
    ["ed352be69e8a9141fc35986b1b73ca30b3925b483f5e62a37a10433c7d86834e"],
  "3789c63f2f9c7189d49ac9d02ba40a7c555fb5f07027d34c6872ff079ee97d16":
    ["88113af3c44d66170a4b8687085c6674c7b1f1d917a647bcf2d4de1af50467a8"],
  "3947df1c888113fe94a12fea2f3d500387b71f2e56b8ddf970d571621248b584":
    ["dda2994518aed06fbe0679c0f2aa2892c7d4151e4f91ece96c849ffc0b6d44ec"],
  "39588467c28056e405de7c7ccfae6406a55c2fdd6fe5c098e2463f515e150d4c":
    ["ad44d5475e730bf26722e14751daa03bd23f30ca20fc465494b6e60c12f121ba"],
  "3a64401a973b9976e4158ffc4e4ad0833e091b22ffbe78987e72261187108146":
    ["4ec38f32a0878c313aa0b441f29d65f9c895dcd25ff49b958cf220f61019089d"],
  "3adcc506569c2134909f4a1429062c579d9e28a9bcdecae5bafa55b9120b71c9":
    ["9a8ac2756a734577b76704ba2608b6cac1b336f8912ec29b86346dcec2b35235"],
  "3af2d946882f262b60718623a18d3977acf92194150c65ea4fab8684906ed703":
    ["18c37cef3b5dc154fae6f48cebc42efd0cbc5f3d4319c6a979a5e1124ae0cbfc"],
  "3b866a4e5d9e1e09b60c7e92acb62fb069c800e96ca0113e971e8353655e7ab0":
    ["7759722cfbc97c233c70e7f61d5fa1432c6b665fd87cdbfc920b4b220a53f079"],
  "3db3429fc0c9517f7e70987bfa0b93e02607317cfa478349b3ceba089e4f1757":
    ["f5f36327a384551c45e7d89e555362224eded5f1b2ef329af4e173c23d9edd7c"],
  "3ec691dd53ed9441774e334e1cf646e9c5f62ca715c6069c2cc1080713852d36":
    ["0480e43b9a25bf1aa5bc5b3c9cc62bcf24aeb668f90f3aad91ee379ffecea091"],
  "41f2ad0db5a53500e1f5dc2997ecc088474aef40f50fc859e602d9608d511285":
    ["fe48c246c5828c0bfd6ab9098c1e9caf348becfa3dd6561c05373f14269e4fd6"],
  "43acce2aef9325f192efa422dee707362fe3b16feaa891447c5256d6eae86099":
    ["bc05aa317f33dddad80730f4a692fa556114ed5a02db77de45edace7d0a6bc63"],
  "4551e1ad9a08c2e1e81337ccf3b59c4a2654fbabac9389c317300d9a3f5a6d88":
    ["206cea9b10be03061f60a950a7a2c1d489f97732ec3c01a95b4a6aa1e5168690"],
  "462cfc24428d5bd180773c5cec7a693a01b9cb5fcd790e8f63bb2ab10f5d2840":
    ["38c4f3bdfddcd162ee0d4fb377af3c81b3d8e91637fcecda46db3b2bed9b2bed"],
  "4635f44aaacc946ac089da8203845c02e5c3b5a190ccf70fa35b1769f86686a0":
    ["3ceba6716c6ee117c430d7a6c486f0b237f7b856cb7ceafbf05cad9a034adce0"],
  "46b73500a7f2d248c607d281f91c3fb6b9337297c1f6fd71dc831f10efdc865b":
    ["b5fcf482b465aab30ccd171a99ce1fd60bf8669b2813a8492535744ab7cd8397"],
  "4737741bf201a48b379bbee09bc56731be209b5c886c4215c42bf8c3dc9abd88":
    ["52444d5637379c910af88291aed4c62905b7fb5283d01ae268f633b88c4d30c7"],
  "483e9a39a81c93a2b4744034d338355bd6a8647998676d4384e134e8347ae88e":
    ["037e256eea7db569aea42d02910755cc81b1bd7eb3e4283ef9b0dfcf5b71e2c7"],
  "498a580fe1f2863df8c929ecbff1e8f864ed96ff53f7b18b803ae84dfb2545a7":
    ["781e61ae7630315373120ed5781bf1facc6569085ae514792c8de474a919a41b"],
  "4c7a70b4c78dc64bead8081fe4faca0e32911c1bc53d58bb5fbc2a9386b5f1ff":
    ["ea7fe32401b422be2ea581c4ba6d32ce8114caac8df226a8c342b1be58cf1607"],
  "4c7c4590e83e2eb3e9014a2dabd7ad2556f00f93a37a425121347e12e65aad37":
    ["7f496dd73f7a60a4c36b7b5989b1627032e85cc6d1e9ddd31b162ea3276c7faf"],
  "4c7ccdfd23aa3144a9d44b439df0293493ac7b04c19475cbb224580610c0e29e":
    ["a652f697ddda2c463a807bf9b4a64ccc0782e76dc8286930e644fd2ff641134f"],
  "4d08a3cde5c979729cf97e90ae3873d3633da52793334638395efafd0dd29622":
    ["a4f2f3b56e3b5a0652fea77b3f6710127b3d6b7226a4fce8468d77ac6377cbee"],
  "4d9928f3e8c33a8b056fb4788f987afb22e7699cc4dd331fdd95f2e43b7965b9":
    ["948fb38c2784a96aac428bf4e241c240230fdb9965401f24bdcb8ffe578c6b57"],
  "4e08fe75a036f87d7582c61078a1ff2a88be012654c44008499ea48facb9ad17":
    ["fcd4c3279d74be4c35757993e974e4bda16a70f367a9a3d2cdcdfa2a2780ec7d"],
  "4fa038d51707e69ff165e87c54b46fb668f35782d5231bc437609ed4dbaacd5d":
    ["768409642d5305f477d6bdef4c7c8da0de539f20ed3d8cd00b12a225dcfbf92c"],
  "51d5de10730b93272866f3917776eaeecb3a68aabaaf8213f0667a315da141d7":
    ["64c6741a74c74cf0fff7cfa3dfd00ce7eb1fa1ffafee0f4b5c8c65d74a38d507"],
  "52da1316c9b34cbe105e61f8fb57299fae34b578b9374a90cb99b5b62125abd1":
    ["615c0d0e0e52fd04e91f52ad82219cecc3ec99926dfdc237dc3cedd39c114873"],
  "539c4f2f58df94f79a13441626ba0847181d55070e601c89245c052b7ac7cb40":
    ["7f200d2daa89560bdb877342ab846184eb531829901c1c0e08d4611519dac9b4"],
  "55083539f7b4cc9735798476c6f1f41132a880f05fe0f80735c3d88df24a5fb4":
    ["5d233a2d5ec1f17e89c3113f0748f8359bdb08a8bfcfbfe76f97d552465865ef"],
  "55503d8f407c3fe2635098719d71efbd50ce88afb596b08cee0b62005e89554a":
    ["ad492f8d90004f48b52da7990f61f93d0f0a6faaf2ca837e39e0673f05b67840"],
  "55a9bca40e9e16713b0473d83afbe7264cd9578f0077d99075afafb076d5fa66":
    ["3065c3d93375742d3cf0705c308593f4a77fef18609a3d6388b82f683aa8f84c"],
  "562b11e132a331b10a14d793a7b334997a6ecf2bdffd3115c9252391bbe4b0f0":
    ["356d0e3c0d72b3bd2afee4bd054b2a1e2a0db8cf8b26726f9d1af841c59a3470"],
  "57a88a1a84b4ba6c6f9d5c38dd215238dcd3e7cf2888d6b2be41429673878f64":
    ["6923f49e7c9b03923d3cea6dd181a2a2ef41845ba5344c2310e0d283dc0114eb"],
  "58eae3c31255da6e2582ded4e0615fadbb5619ecdbff597bba9dcbe166d315c4":
    ["d438e020b37d029c98182336542074d09c6486f7875cae4598fc70ede2e69a80"],
  "59c2c2556eeb11939ddfca127f48e9147c954fda6644dfc100bcacbbbb78561c":
    ["da15d36e7a5524d573f3b0fbc5abdce52c728c11a53dadb11044bb4801442f66"],
  "5b3490ae4c66dad083b8cbea456d2e47d41ff794e9c03aa15acdf2b6523915ec":
    ["caf859e551e3d6989d3c321d13b4814ca22553daf8ef16d2224d71594ee9e07b"],
  "5b53e7ea08a053c2ac512a6b28660f8d927c477968df8043471ec2c2dbceee5d":
    ["a9fe7f3b8ee645dbd423742bd7d9798abe772d68edd6d06647c11aef9efcf6ca"],
  "5e0ab6365510501ff760de8c3bdfb8682bf918e092d9263441d8fc7f56403533":
    ["0c6159e6822076cdc48cfaf12432a10c25f7d837d371be10bfc55fab08737607"],
  "5e6a5f7de8ba304c3cef666164ad58cd9a98f3ca2fc4f0936b84697d15b38cbb":
    ["044a45f1b1f2cc499c611d8f50932ca1ee88ad6627e650d9b7fd4b587925adfe"],
  "5f5e99bed43e89cdb3ac384bf51d5c61c1616fa16c29ba985c0cc4bfa6b0ea15":
    ["58d5b53c3a27dfe6ef3a58836e54232a2ab49da1edd8bbc3e17ee1ba53b8f364"],
  "5fd1c714b97dfb852012420d0e8d5f32e28bd9fee000590de08958ba78a11031":
    ["d6813f236348c065757d08142b9cd9a26cbc176c52375e6dded8cd0125651f18"],
  "62fdd53258c559ee8a453806b12dcd46d785e9f0696ecce902e8a46cf6243564":
    ["bd6acabc085b30a0936fc516c10b3ec8f3c58825c1649667e887cff907553e3a"],
  "638f35e1e5946dfa4db8234df2a68bf493a5f7b4ed71d1498aa50285ee4f2595":
    ["82be76fa54229e10b37ed642131e5b6915b801a8c3961ef1585c56e8687c9b10"],
  "643f6733c8a74d823848b179fe61383cb9706e5f5181d1d016c48e64831648a0":
    ["60e5e7dabca9f412f5e55dcbb8e17287d5ce9218b3e8daeb6a423d472df02bb9"],
  "64df59a14dea52ba83e26c9a485a03b4eab19cff407feda34eb0b2c3f12ae30e":
    ["7909f0356a39b15cc2c7043d22778145a64f84625ddb93a9c8b45430c0415c60"],
  "6580203bcf57308ea063af0cf46b314a2e867c29791a5a5295082a0219c03981":
    ["8ce94c9e58bf17a9159dc4908d6a3caa00341f3029a525c8e97ca12147d59d3a"],
  "6694fdf5dc2395af5adab5e60840eba7467316720b57c4e3a64f4526bb027b5c":
    ["fbdb43d4901285767db36c1d8b231169595c8a0d8aeb63c18ebaba1a2911a454"],
  "6698663ffed7669e3fa3922260e1e773179b41a5147fd961af44acc157839914":
    ["3c2d39b431b3d3abac32bf1422af53bf3dec4b570d07e5bb64fb5bac6f059d21"],
  "66d6960cf4f889c97977b4f8ae79461e0f7034b22c24af50bc19ac9ea4803226":
    ["9b91a62b83b7c5558d0467fb6f61595551a89f0f3a80e6233447acddd8e1c9c5"],
  "6a82f4ed9aded37247ccd15d5822c1118f9412c7be28c7d5b7faf3d0d194086b":
    ["0cd8384c97382595ba3b8e7324c2c7fd4dbdb2ca610b85b832598913bb707018"],
  "6b212ed9b073a98a778eb517317f9859cdbf464cf452697860b87a0e5e8d92ff":
    ["d89a7a967fa3e3c499818b8942f6680faf9ab9057740401fe41f240cd2756eb9"],
  "6e67ac04077857e0da665be75ad5ed98a9927a5607bc1ddbd78fb1ab8039f04c":
    ["79a3b29b221be05a241fdff46781b219b27b07ef803e70e8c086a73485c2241a"],
  "6f06eff3b66948891fe3e291a62709706f41b2a47dfb20c00054655f917ed187":
    ["f95fdd1b9e3e6e3da618527e731afaeefffbacd98d4c8975332c1af18799cb63"],
  "711990b1affb366ad198616fd59fa6802e0ff1644070b2fa46d844556d5be8f7":
    ["2a08d9ca1d7f9688c8d05eb3e4ab875d545f0c3f4959aa8dc1d5480e7c313d05"],
  "729d1412702fe4623a7163973c7427e3e7d54213f6432824786ad2210ca962de":
    ["9e2e1fbce8133821b7a97d5eb9eecb7cb24a7ff8af213e4f3be6ca049f5e258c"],
  "72ab3beab5262b9e3bb92a2695479eadc0ed735e8bf8c4dfb02b25b2232d38be":
    ["3cf03d7503fe42cb85f212e84a177e78686bbc1398edb0802fa4930ec93f84eb"],
  "72adab1b90ab319ebf714722d199675dabdbf945affaabecabaa215cbcb858ac":
    ["b9aafb1e52639d614522af14bf3e62741673de89cd411520e476018231b87a6c"],
  "73c890f5440d0ee73e0b71408fc0b04cb728660f8d34e5c5cfbe2a94dd2b1667":
    ["7684f1ef3d5cdc3d6bb51369289352b315e1fb5b3049880818ae595fe5b060bc"],
  "7412f7e8c717d242295a3bcff19ecbb6ab94087026ca81204b208203a968d1b5":
    ["0f303693a230589f9b3f745eefa138fb6f50efec96edccb592c04f03b8991b33"],
  "78097eeffeda60e8515e4165d071541ec4dbdbe55065a7b243ba4f5d910a58b2":
    ["ecf94366a6eddb5e78065ffcffa8ee26f64136fbc78bb34bac87d78bf3bf36da"],
  "7a1b17e51097a6599a036629fdcc630afa0850bacb0f2998d0ad8107d39ec9b5":
    ["b7e7231ab6a341a3f60b506bda3d27b1a7adc4fa314227bcda3feeaf1ea5da09"],
  "7a9d15aca8e00a91fe5d9ea16eb882c3d42b7fc7566f89be0a09f66c7576d19f":
    ["07307b81611088b2bbd8279725f82e67a23e8d058c661471935aa91fa7379bc8"],
  "7aaa435337e435feda9d0d29ab7f66079f92cadbcd52c1bf2749de775e883799":
    ["e1c84e576d44316133c6dd347d1c5ec2fae567640c231eaca8b90976388b75c3"],
  "7b85811f2e1b9f0a13e66b76ccb01795d0f4288e9a3fbf9900530cdfa1fc1339":
    ["6c77788de00092bffbf5a140bb9523304d4e2f6bf2180373574a7895c507ec72"],
  "7b8b5c65a126fae2edfa517a4706244a0d2352c628fde208d049ecf82dfa4e72":
    ["710fbf097a9b3d0c980ae374fdf104a0b85894a446808f9a426f60264f24f923"],
  "7cd1bc60cf003ca029aa52e133acde34ca8d3f1692636904f852170c9c97740a":
    ["5209f3b6992c4cbbaea4c5440acfc63a39ed814e7844cc23bfd17639688a1657"],
  "7d9544f06ff6453d5c0af45b2da1fab79fea540ff077d715c439e603658a13ac":
    ["b4cd5096ac44e93805530783cac028fe2aba48eb9a8c909a3955fd431a8c4331"],
  "7d97b71f5d156c1f05cd7e6634df55bce242cc3f26231c63665a4f90686ad057":
    ["f6fac2ca0a1aafa4c3010d3f36fc56ce367cd8733288f622490b50a980e0260f"],
  "7f02d1cc20202f00c260b788d76771103bbf7fd7f0ee0d668452ad4e985aa22d":
    ["fb44bb9aaf2f738b793293d5648852569507b644e274984e52cce305b971becf"],
  "7f1603650a1e2428354420bdc3ca9d4b4c9e678a2736234277cdf46755090311":
    ["0422c5f53925fdd966eb7c76ec928ea235a8afbeaef8583f4aaf79a827ab9e56"],
  "845200d2aae2d929e80fa3ebf334133e6d9dfa4fb1d2dfca3383c0a5c6186b14":
    ["759d09c4136db5471bccc23644c175217d49a6f6e3b61687bd02a2d08dcd2674"],
  "8476683033ad31f0b011834d9caad51f0a23c8e1ba88e10ac0c583146eb4c156":
    ["e72a87500b6bfe377128c32e2ce902981fcfa083d4162ef96a3810e9a0962ad6"],
  "8492fb8cf18d58dfb55b4659663684f521cca7e762393d2e9657b0cb59236e26":
    ["9a63b929b7d1cd96158828f9943682b67579572211a059ed964f86e00ab51d12"],
  "85c9209ec6ab5816fd03a3199399f6e4d5df13027889f143c27a7f0180f78a9e":
    ["cc5c158af39b353cf8f61377295833f2847970d98174138823c703c25a5b76cd"],
  "85dd3fead9b386dc920924374f8d12bc8a0d6ab7d3f84e9240c0a6a918c87ee7":
    ["0ec68df06126eeda4373686680b3358e1211241bb7d8dc815863afd3d0c20868", "a30cb1d01f48e5bd931513fe80ec7d97af54d6d6a7e9f44511a85c78dde9e6ce"],
  "875e9edf6a7f4c6837dd661b3e487dc87b8f2be0be416272c54c14dbe116c5dc":
    ["2a9ee6f6a8d52ab4ad7e51ac02a5749240b5ef96f97a7b7810d6696c07a8d4e4"],
  "89a3bd86b2316709e91dc8c6e29fe0dd146bd341ea67500c1803dc90833ef0b5":
    ["343609d1b72ec885303add25ee35ab43bb6259448cf431de1a9b7f092a477d5c"],
  "8bbf0be7d8031c7a3ebb9a6d9311d4849f120352bd61e0a1abfc02735107686c":
    ["83af6d8be66b34d39105e35258865b1db11645f9ff02140e20746cd38e092998"],
  "8c2f991e381aec54c79bb3f236652fade8de44da3fa92cfe45556bc4af60f183":
    ["0109a32ef6487ea2b983da104370ea96be50a9abd1397792a9245f0114371537"],
  "8e87304b020e158179c2a265fec3d2b82230104b60f1c55db6aaafe7ecfc7936":
    ["e7158908548484dcdc450494484e35df3c715dc710a8e46835bc860af0973240"],
  "8ecb0d6602cdaba02ae722c0c63d16dda2ac17c24cff9632be9b004f2b87e162":
    ["83eee1312d84d3dbc9ab213fc9acb837c0875099403a3cdc12a4003a38e00a9b"],
  "904295e566954f26871fa81daaceb0bd909895d6130b48b84d8cb5aaa4a11488":
    ["5e320d3eda1bf7eefb2e51e90a3cd4af9e6109653f685da0596160f74a69ea6e"],
  "909d3055f381e82ee012e2c97a30fd47770352ae4708fcb34c4ae65313dd55c7":
    ["814f0d812e6c43203ccbcee9b2ee98def9d2c67a7c556abaeeba227c5e0a7263"],
  "90bf935b288798d9383a84eefe73856cbe2048635aa7702bac56b1e0d5498436":
    ["0d86f69e0a658d1783d7c7f479626d6b5cffafc07bafc1986d7bf45e207e4792"],
  "91693fa5820bda13bf3b39eede0b8b9fb36d7f82a8a5c23e086505f0510a3cb2":
    ["77ff55e0aa5f68a600ae6c1713f7dc74bf9f129b655b8f969d8afde613408312"],
  "91f5cf516b125fd6181e4e003e4b6d7acc841c37052438bf9d213ff71e27bf87":
    ["1e0828be10784a30a49199f565e407ae1a81632949cb5a9ef866ba51360199c5"],
  "920bdcddd2e428f6263519e2dfbb314dd7f73439e0f2b6defdfe10c0b29b7d7e":
    ["81e1b4a39425dd2fc2f5141a1d1eed9e68942a5c5464466e858d18ab4340967e"],
  "92bfe16ed2f66d3394546ca883489b0e3fc629125a99c6d8d67309bd1600677b":
    ["a113ae4be9a566aab619f0acdb7f4897288fd035550c23e2dbd0e17acd11cc6c"],
  "92fe2aa71777d546d797a4f7850cb59b1693f3b2937021dd5cebc85933403e07":
    ["762f4d097c79f3fd89d49a2a24f76b0f0fde8e3eacd6963b15a1e3b2f831d71b"],
  "941d0f4ea3ce80d1787e3163e16cb06deb129a47f25ca91b398add3222a4082b":
    ["50363262f37ae048f0b16f1e99b1cd601ddccb796adf1789956f3979982612e3"],
  "946992af3680b0217734172ccc0a70e7c283a44eda54edcf399a734791e347c3":
    ["0efd1693e5415d79df8dce566b3a4fd0ac56eb41e73ec99fee11e65ac6e5b57e"],
  "94b7a29936f37b71100e1805725eaaf59df65ec763fc964667fb9166bef6acd7":
    ["736ca465422c9c9247ed4bd92111bd0a039259833f2c10d09b8266749c74a5c6"],
  "94ec7217d0fb11ead98600b7b8aa2b71ee55fad6b936d2133088b33c9962a37d":
    ["449d14574298b5d9128c6d4a8cb659d38bb89166b10d7e9b3bf299d8380d7a60"],
  "96ee4aaabf5072bb3a7657d86461ab56d48b7d1be88f07e0ba4662a5f03c5421":
    ["e17998421b77d049e719627731dc24bdc7a11f62ba83c9df8b4b841c63955f60"],
  "975f8ebc96587696f02406d334da68a2762f9e54393782e07cd8bd694dc3532a":
    ["27a08a965dd17583ab8fcd6f5f77c8d149d44fe6eba9c614584233ed22310094"],
  "97cd70b9233c07a24510bffa9b1bcd44846a2620713e091291203644f652ea68":
    ["c7f817eeaeea015cded9f8f42bc193f930fc88a2dfb45ea6e0d558111dd4eacf"],
  "98f46fb22fd105072fb6f5d3ccd8665fd7d4245d493b9f076264f3ebdc5d5191":
    ["dd532266181dc6e9c316904a8b76bfd6e363815bca55e8ed5147a35237929f56"],
  "9969e5908a09a60a335a30adeec9da025c7d33fa8bf278eb5f80464e3cf7fb20":
    ["cb2d03006249a4eb372f5c0f3db4f48f501767792e8ecf1b3fc5faaac99669de"],
  "9a25d91557bf40566ba9ece25b3fbdba513dbe39cdb01d8437136c3b7e4a3b56":
    ["5e49acf5076e99c05a0d92a4abbe7e6a401fdd0502532bdfe0b00558504ebd6d"],
  "9a39085dfb13220e6f834ec96f99df624116e8a207c57c07f22466705530c5e8":
    ["8d92db018216ed702e37826b3f8c3bec27a8618b878d0d24fd32cf2ce80d2c98"],
  "9c5177d9ca50b7fe47f7ecf52a452e4eb793537066efd1110795dbd07b52bf26":
    ["567edc769fa3812bcda6fc82531f1afda5dcfbe6ee993a5d8d33c9e39263cd9b"],
  "9c753eb67c287ac128bbdd725290aaa3079e7711e787b2c9c337cafa5ac7bc26":
    ["85d4eca93841c4f90b5a84454a6c5b7ec90fb1ea3b695339d4c98359a28f672a"],
  "9d15fca77c779c94d8525c7d3b9a555d233f8f41027088ea2d3da59cb7d8326f":
    ["0f303693a230589f9b3f745eefa138fb6f50efec96edccb592c04f03b8991b33"],
  "9f2fc258978975797eaaea36847eca28e5cea7b301acd36e9c3b49e3659909c9":
    ["f46094e78afe3a35be7417ad0fe02cf767421c79aef00c0c6b11b05f4a5086f3"],
  "9f4ea1d46ddf8beeb429cbedcf0fc6ca45f9405e3c0f2be8ba43891721ad3375":
    ["e8311dce2646f1c86f256f03555b6744695ca6e41321f6faac2d1854be3a0308"],
  "9f73f1018d0bf99fd0d16b6ede0921dbe29cf70a4da4a61c9b24c1e68dbb0bf0":
    ["8f7492c5012d80e6552e0b769b550ab6902bc733c54e322723f21d6a25807963"],
  "a3d603997c440ac3a816c9320d701d7e5fa1557adaada16515dcbe1456b24c3a":
    ["5e5178cb6304f88f178a50b383c50ce29d834e45d9608d6ca82125899770809d"],
  "a49cb6544ffdc9bf626bf6f4f1dad626852dede0cd087c3ff1226a5d866de71a":
    ["2f03b85f2d59dbcb390d2954da2c57342ada8a8e551b355216ced60dc905c288"],
  "a559309977e2046c42b074002eddea657b260075a9ff88c35c33218d885e7534":
    ["9937b43be4868e649fea7eaccf62923347383948fabb47e7e789a2ce82383a07"],
  "a5c1bba06bf15728f177f452f266184ae622085f78ad344baed6c3e5a7133bc6":
    ["530a18f196435670ea99b70f7be23faf18271fafc8c2a00798f6e9c63b1d2ecf"],
  "a6c78374f4e6a901900a6f8102a49fa487170877630e532b9e1d9388bda1d93a":
    ["b1576c485ad2e0286122cf366efed176fdf78fb2ec3919b07653c559f2a0da1b"],
  "a7791775e7756465b85e9fde1f69dfdcfebc0004d3e9183421de2e1cb5f5e379":
    ["700fe638f86f05d1b0217a41be746bc71699e2f2419fe9571bd05d95fa079694"],
  "a8dcb08cbc985ec871d8537d056bb9a702c0b3dd33c1efdf19dfc6ba6cfbcd4c":
    ["aa27ac9011c1e846e83eb7af7f5a05abbd923574047251a074d7735fd86175af"],
  "a99214933ed1c82fe6ce45a9c067cc87b374389e00c87373defa0faeb6dea402":
    ["5031a171d2bea1c4519c10a2343f296eb9e35b34f741ceb8458b1fbcf9eb13f4"],
  "a99cc45b1dc37974f3ab2032d30f7617ebb5f0d45cdf249b2453094b8d49bb41":
    ["563ed7d2d27a67091ffff7d71d6c105fcca164e4dd762cfe4b8389734439faed"],
  "aa5940ad3b732088ba52c01622933fca7ae1127e81f413112153ea674d38a0ff":
    ["aff2c6144cd7d11ab91bb419802110b4772b223d814015479994c4941b6c4018"],
  "aa6e200ba8acc6089f4d270158e47c99900e3878e50bd8a60b619aae729fa0c9":
    ["3c0d619f9626efff34cb09d85771ca7a736b28c7815fbcd7f21a83de55515dbd"],
  "aa73fe42c13b207f22b9fb3ec2a7a390119f8fc0f35a3a1a2cb60e84f43115fd":
    ["a7aafc8a02c127af5a6c29810cc7bac69705a7693a5b2d4dbec4940455694865"],
  "ab27a71f3fdf9ff46fa4f73b57be6b464048f70adc627f9c8d123a58d43909f0":
    ["4dd771e8705604b60b9ab68116997be60dae9c6211d8cd418252dac57ac7715b"],
  "acd056753294c376b38435aba83bd8bfe11276b0ffd53e9ea9ab75f3bafd2444":
    ["34172ea0b414d4808126d9a14859517a01f6f5cf02e52d1675457befb650e562"],
  "ad22c95211ae5de444cbee2a37f1a07c2b9fb6e0d6f23caa758fd7ba9ac7d91c":
    ["2ba89bf65f73d5c936d4b8174af79dbbfa54d1c7c027e0790635c8a46038a846"],
  "ada7f9a374a6a34216e582e2d3c5a4dae59891c7a3431f3a1fc52eed62548376":
    ["2828e57bee2ed98076249773aa5aa58a3e358904809ea911779e3fed8b996010"],
  "ae58140cf28e2d6afdc92d731da94fed2945fc501911160624cce6fddd37aa05":
    ["5530169406ca289251afcb027cb73d791a61ce93ec45262fedaa1285bce8faa0"],
  "b0ca60097a5aaaa6a371046a092ef3ad04a84b1f56ab6322e4e8b585beee721a":
    ["b40a80d2ed0c343b658b6f7cf3eb25d1bede86571d592b6da026e9f341bf9b7a"],
  "b12924d38e54a8aa3ac1804ce10d5946da4c3d41a1819f6ad32dac2e017864d0":
    ["28f8a9b2d52a107b012b618086f3daecdfeaf5069964f2bf2799771cc670add4"],
  "b19d00a9029e6e1c16f5afe2c4e4559483e764908ed1970cd7c3332a4d1f16bb":
    ["105f20361da8263d18b6d4d3d356a8f49a5cc14164c1691a6fb0961ae67fbb02"],
  "b2b4bd7f836a436542ece35d84651d7f1fc403f19363707a30fe5a7730895ba6":
    ["24c776415196fcf4d1d5d4af01d4fc691d29b9e91981f8b348b2f50b46a6e6e6"],
  "b2c8c1c5c29e3d65ee2146c6188a3b424edf312b1aa0f09a33bde70882553835":
    ["af2402dc30b7b920fe13b052df3beb162384a2cde166048d6ebe4b55c1a32145"],
  "b2ec78d3eaa13c6a4ec8265dd5bfbbc7611d17a61e8361b37849522f43dc38d2":
    ["8c6b9eecb238d71764d59b6624d1b32d53475dc05f93ff764675efce8591284a"],
  "b3f4866ffd9ff0fd9f0bbdf9411161a78cb2b23fdc917a73fe33b000fc907d13":
    ["6f98d276dad729bda0ea08329710ead1d98ecac279735c8aadd0a3b10f9493ba"],
  "b47aa2a9b0df83431a59ccf6754b9435af7f2f4b9e35be532930ce89323854ae":
    ["6b0f6a910efe3a2e7e8efa30464d5ee1f8c15ad3b622caeb0fc816c77cbfb350"],
  "b5406c64785a6e2559a238e271085d119d34fc45c36a2a4dd404ec2f09a67625":
    ["756bc09293b2e33b1759f59bc7f4ecc7b4de76281a8b555e583883a016e26956"],
  "b56d90085c4ecd135580c0a56b6442e35dcdd5762c3a129bb09c7d7aa8ef8a64":
    ["a70d08d2a010a6cac2352ee478068e0c21ecb05a8f268067164757d142b8920f"],
  "b7438c827d6311ba9717adbaae7f4354ad6cf200e85b6a053d7e821c14eb53ff":
    ["ce33258be0ceafb3ff03b7855dcb6a2bd986ead9393a40b18a7824e1735aed66"],
  "b8ede3a030d6dbe916834d24b05d2a1d1e90c77bbf992e38ecfef314f36a328c":
    ["df61b8643a92b76c9362e100e7b8a461a9937ce02778112e2277a4fcddff4cad"],
  "b9898076fd712f74e586f60df2a7e551c68db82b3726025815f46b78f32b8413":
    ["6528ff9959eb98ebd6f3eeecdfb45bd3b12e3931155fe2d7c5d91067de21419f"],
  "b9b40600c58634730684ebf668a33af0c500f99c7e6e4c113e131e0692730e94":
    ["48fbac84653e25a326be5f9438362a829dfe44eb66ce109df0c2f58279700b16"],
  "b9d3e9ffd560b43d918aa004088193c11e51da699d754682f651b02b5cdb8ab4":
    ["be00b30ae93deb293d96cb9de53d0169d50554054304735d5d9ef60c8047a3e6"],
  "bac0f3e38dc0b587dacfe3fcfc9a7527124f20cc07d54837da50def04cff29f6":
    ["1c17a82e0f0ea622646fb812d17b689891b5ab959f3c114704b2edda11685356"],
  "bac5eee8d292fefb8c69b2b4539f1ad1bc22dffab4e8593ca0beb0821dd30b1c":
    ["91ea30369d5f63e9409ea76e9964ef88f3a4692ce4aa6949f2b3e613b4d6e241"],
  "bb472c938517d6be0477a7b15cd387b1acef31a8572dc556a2072e615af91db5":
    ["0affbba93261eab133cae5fbe211965df513980ccb4d630cafe9f8b3c88a0fdb"],
  "bc12b3ab4d27eff749e60b03ff18c292e285f6237409d97b1331f816938cd771":
    ["6a625bfbeffcd1189f95a3b52c88409186216acd124abc8c44b331a0e352b1fa"],
  "bcb52eb689d92cf731bedeec30cc3472e83b2cce588c347514f63429b5fd0323":
    ["7d8c98882adee1acda805251903abe8511419cfdfe1076e3ee39f685c2a38ec2"],
  "bd1a37645f311cea53ba09df62c09c40a1c67aa3c7f61faf5694d5b5f1ca06ce":
    ["33636da09d6b1cd82fd00e263b649f489434d9f252e8f35d84f96a02d93daafc"],
  "bd4e7ffc1a5f105cac4588c61229977f7617d871438ce8c604feff9a39b4e0db":
    ["ddd361e9fe93658dba379ada45f88f9a83e50fac026862258696c854915520b9"],
  "be00d4ff939b6259324f83b9d53bc1c3f3019f027c1e2c605189fb90946a6212":
    ["b6159272b05c91150ff9c337ebc8352c28cd3d869ecfe885d80d1b69aff12394"],
  "bfe7d8c9ce9e40398c1c4f5ef4f237745e3dbd300f9d1a1080ef1d061ea6a5cc":
    ["dd8b83b3fb6212819e40039a08b2a3a661b047b324dff109d995cea9ec7217b5"],
  "c3a3d7dce4248e26482d55ee0adcedc5c65af584f3d51af700b923d3fc242c81":
    ["5d35590b36be29d294a15f77dc8aa9dec626a06faa98e007e438e40e940b6105"],
  "c4edab6f9b07609efbb005194c4bf075b504c0da552637acf79c6b8805aa3013":
    ["1c3ed03dec5534e7b8e9c7000e7fd376b3e1de20daf92f21a804cc384e29886b"],
  "c6136e2323c751086990dc6ded74644906739a4ec2d148aa1881224aad3fc202":
    ["24e57baa09c141c7151e7a2374dcd7acc0484f1801efc4d1014ad4b5ac1e7893"],
  "c6e2e54332d133eb208974890b255570fb2fcc9a802ea52957b4a64116f7e72c":
    ["0a1664f64d0a4de97dfbccbb3ffe02a656afa110157e9e49bd40e989c57c1cda"],
  "c6ef04ab4bddab108d5b0f7c90acb55f7d6eab79b0c28355ca89b43751c02060":
    ["7bc114c830cb31fa9ddf1707088521be419147a00286b3a65ca1647afd8eed46"],
  "c777401e75f6220143cd3bc2f5573ac8b64b550796f0813ed85350d136af8c2c":
    ["e73f053dcc3dec0c92465a3144c624e7b450edab262a82f5c4ed220f969b9cbe"],
  "c7da1da4f3c1d8f53d3bf6463b088fe12557de59888dc4e47130120529b275ea":
    ["0c5491294ad34a7c5d4cfc7ae04e6ec708267ca0f1ccece85bc46b690e908f0a"],
  "c9d06f44e8f7c99f976ffeb728e1d8e8490a8b0202b857e130f834098ccae03d":
    ["da1e771dd1cdc96268fc5eeb272e1bce4d1c29c4a5861ac1fdc1dbd6e23fee9b"],
  "cd19729848a8981a6c93b2e6df14d8c65a6b9861557319b876b27e176e8bb2d3":
    ["c314763760e9825e7cd2d32bf9ee89302cb07809a3ec3e18563fd71e1bbcace1"],
  "cd6b4adea9a0d131da290460d6bd379487e59f538297b8cf327a410fef3bae38":
    ["994a5dc3fe186c112880f1cdc373ce410e03f7f59c6b2442365775e8b51a101f"],
  "cf152611218510e0d086fb2808834d0381f64c237c9b4ee185eabcd58a850a6b":
    ["81878849e725a425039f0bd1110285075198a721b05932d0d463a2e5cb1c4192"],
  "cf1a45dde7bff3edb7a2b16c9a074f2d8e86e15e32560f0d9efc4395046f4649":
    ["90db05dd20a778fdcf58f57bdcf9fee038b3839cc594b4a9f6cff69dda8cd0a6"],
  "cf61db8f13d258c90d5005bc4dc3d8d72f57561febeefa27428cbeac5d6dd6d6":
    ["0cde501c58bbe91864997e1d192886216cb834ae1eb962ca96cff12168614b76"],
  "d0dea47faa8e0114370878d1bab2946fb5372d236cf481e9057a5e2ef6c1b5ed":
    ["01b1ed90e1edf24375dab1a7c128c4cd4335066f4d710d5d2accbc8e06f7dc6f"],
  "d163abd18f36b31e89ed488c1e60435c83b56d065f1936405d89400f2c772a08":
    ["9c7c017d15e3ff2604f79676cd5250074283d6a25d07d434d4a336556af5e3bc"],
  "d163b9fd10495ddd5fae4947a468532425290ee316ba66190e59e91b7471d5a0":
    ["f6058463315e823e0d1387bc852e03554af4d8c40ba5d457a3fa0aa1dc18460a"],
  "d2b5f3bb6b551397cff3949a5a3b9e758beb1251cfdb47fc12115f4300697ef6":
    ["4e9fe1009c3d4426b8e821fa4e0cd8803185c83bfa6e3353db94958a5e322bc8"],
  "d2cbabb903aaf2e40ab483446c8e4f76f30226be812839d03e7ea9674d191286":
    ["ac32be05b0c692158fdea48394429230cbefb3d963f9c0e5ed8753a00b11344a"],
  "d30f207317d2f41fb835151734edb4f8a942a81d5c54052ed90a2197aede80fa":
    ["84f672486b3c2d9743664e6655bdb184590eb01ee0f2d00d3c16ea4b8217c11c"],
  "d3cae3aed2485fa4b3a309b096a5f6c3d542bb09c46e2d03c92790a05e53112f":
    ["f0b851c9de7f56020a2cd9d76ab420d1cb21f5cc77e25d5e18369acfd9133d59"],
  "d4066bccfd04635db551e12e16406e952e90e7cb3135b10b22f1c2c99ca2d93c":
    ["ead316e17d0faa1453a087a5100e6ad5c5fb41959a4b6c5b0580f57b525b7d40"],
  "d420d0eabfb51b9ecdb930d532f282b101febd003fffd8c993ebc9fdcd4dd33b":
    ["0455cc0d0e80ada2479713c5ab0f027afc3267bfd0475bf1f5b087b8dc597568"],
  "d4eac5d760c62f0df7188b1b6153932c46b080343f0f37f439e495bf48227ab4":
    ["6ef763cff772296b9bfa3fd43638e9f0b97d69ecf7d616389a0686e0b723eddf"],
  "dbcadc02907cff650426b68bbf3e4b23db4a569dd407ae6088d8b42bda5ff2ee":
    ["84d29261e43d2d748d58e579d35c72e4447c4a16805cbec00b95f57f9a626d57"],
  "dea6fb367ceaed35d245132686f1968cacdfc91d5074967ac1cd16477fc3d908":
    ["8af7565f34a71719da980edbc914f16972a620a8d90d2c079186257da93e72c6"],
  "dedf71e8cbad3dc24b3395c14bc1dc9efeba767687dd25232da35d150d39c4cf":
    ["a451cb376ce85601cb450a799c4281fe05100878ee670d9b240da3987ab9fa53"],
  "df3cea5724a9ba0e5f08965c82bfb5a6d703f991c718dd6e72e5a867f5ac1a62":
    ["e368b0633801ab652658ca3c661178e97e413225da13458bb211f94803124d5a"],
  "e0367d789b61fd5925ce7e5bf91edf877c4da34ecb35aec0e05b891d8a05a123":
    ["7743019b5d39db7665a9ba5997fc58c952cc4ec484c1999dc0dcbef3c400363d"],
  "e0805ec3c8e1395354738f31e9e9939cc1008cf480843ddfdb4b8a17fcce779d":
    ["9c2b3a4116af8d97c0d3660f3d603754f21bbb73299a4131df11cb0c5999f896"],
  "e283934ec12bc0c0dc23d2afd90ea0443fc75b7168da5a4c9ec5a55021180771":
    ["757cb8bf3a5908ce1999a222afd0ac6f36942ddff2fe8aede8aa978cf35f6e32"],
  "e2d3a0903dd7eb7595e118466ce74d0e90f9f38c81068c8cd2fd1f8ab0570338":
    ["f9530beb735a496f09b0d6ec4379c421516a7db56c6cfe2c5d392cc7f74e1dd7"],
  "e2e5d918d727ef14b7fdaef41f3446c65193f6fbe80446be6566a477681a0904":
    ["64852f5c2ddb5943ee9c53b82595f365140efcd3d98173c95b60f6c1626b734b"],
  "e4e61ee10c161858ab5a05ede4649e8a09649e4035327fd1a564e5e546443bb1":
    ["a91052caa1b2b303dcbdf1245fe572c888cb0f3cec600a44b352e9c3414696dd"],
  "e540fcec2dd0710537d27a0418831dd6beab57871171ce96b7295539d93e37ce":
    ["e42ef81d570077130e6f373f224691778e6364d45dd238387660d92a1d3891f2"],
  "e97bf7c3b2f0e47b07f1cde77500e509a88ec364a94fec0980ea3862ce04b7ca":
    ["507364cc91c3ac4d48d4be72d2c60363d73628744f8ab3f5a8789c28a511a74b"],
  "e9cde57ea98b6cc14857a2c959d18bea23e541e6a5dfdbf253d19fe47743c82d":
    ["98399a06a8d6df3b44a93aefea14427aadfb6670816e76186a344d1dbfbd194a"],
  "ea7a7ab8c07165ee61b3c8239cc8140771eeee9b8677841632064817b116d1ee":
    ["60c90a90f5236c556c8a5045d51037d2bd79a8bedd1330c1ba11b5c429fa61c3"],
  "ee1a49f2a81244b7bc055fd861e81d5a2dc5d3b6ec82ce6044be2b35dc83ec1f":
    ["dfb5acdfe86169b4bc5e6cd9304ddda928d16f1b3b04ff7d7738e50c76f742f3"],
  "ee1c414b1434b2bba3f690497cd88a7d0381cd6948643a8c47a0035917175ec5":
    ["288645520904d58c261ec8715d63f5e80698dde33f97ccf981b8fe0ad7ebc8b5"],
  "ee41be1f4dcaf8e5822fc024e41cbbad74cf293cdafb2b89a8691aeb680e68b5":
    ["5c2a8e5c1da2b4717f906d4ac75ae9e0eb10666fb58400550ccc3334cdbfdc32"],
  "eeeac28028981ae6f233b2c0e6ba4cbe5cdba999bd1063c2a703bd3f6cc1f6fb":
    ["7fe702dd57bd7b7bd0495f5b8a0bb818d5c582c4370c5886dd0630b9a3adfaab"],
  "f03a6885a613d93b5bf27e62afcaffd5bad1ec08f238960baf04d4c3cdf4d5e5":
    ["0cf49876e56aca6a87a5f91e2d67cf42c6a8f64446ac32266823b51a596b8784"],
  "f0d0f6091ea4b8749c00cf2973a0b8911a49993b0afe79182952b7d3cca715f7":
    ["93bf9c6b16d5b26c6424eb2ff836855f6a1095060431502797ead99f3676f446"],
  "f1445548fcb6723f0e96e9b5455a7b7b7378702013b4ccaa955b6af82d03c1c6":
    ["b1de3696d8aef4faa63853a86899a7d200aeb9da8cd302410dc2431ff43846a2"],
  "f1bdea374b3bf67822e7fc8ed4a173b7e213ee865d77469c8a4f77c560aad0ce":
    ["5008dfb0027246d1e1825d1617d005e5cafb9bf35fd7422c1eb4e277a6ac0ec8"],
  "f1d4d25243aeb652707797683ed6118569f606e9e3a69040eaa3789f737dcc7a":
    ["2d1ba95bafe9906fc2a5bc3a512d535b1c015953502af4fd9f2aa6bc353d2bcb"],
  "f1f53c94b6340f394c360c3af0f5604ad5514488751fb18ce360585ddfeb2fa7":
    ["fcc6f1cbde9e050fc6cda5c5173f032b52ed8be03cb05aa5fb21026c40b5d573"],
  "f234e09fc78c540418d7ee1e02bb339caf4e95b91dad5803dd87f1b1f229eede":
    ["0f296f9a9b927fe2a47ebaf4eb68b35ebe9429c5926b4f0d046f5d1b20e35df6"],
  "f23d7dab7f956f4afb6a08d9ac733628dbf01d6c50ba70f9d0cb818fce3ac5e0":
    ["c28d2ef345da8551b0744ac31f79e106e62efcda991c21ba62827c6b8a239266"],
  "f4649cdc08d2f6cec6d2719956745aabd769ef5787dba529cc476457de2daa66":
    ["0385fb3abb8f05f322b89d21e8c59d87281ef4b6907921320a276eb22e6edabe"],
  "f4c491012226f9c08387bee278c9e91338ab82de5c71bbfb64ac62017df31777":
    ["c1300dd3b257d158930cc415530b52ed551757d3e2b0c0748319c9032db4ccd5"],
  "f6211064a9095c95a0e3c5985cc7be8ac1a60f2f4d2ee4f71f4f17ffada7730d":
    ["fae61b286ed81d3cd64b35130c2f07aab32e26da6775fd41c650b0360fc29e14"],
  "f67fce69172713e734d2a8ee44548898f878ed2de1821beb06a9e5ba872797b5":
    ["ac3d96b148270ceca19e10a83af01c1b920716186418426ac8ee51216bbc8d3a"],
  "f75cc657befc8f51513048bfa7fd7fae85f7b689e47f300a15b0343e924b082e":
    ["4cb7b4230612e572122f775e7e3fd989b78837a928ee6d29116269fd45b3e0a3"],
  "f7a2017ce827175b1c593cc6f62f34bcc06c43593157a8f267305eec062e9a0a":
    ["2ff5607595b18fafeea320ae1076a9850bce9a961cc86a461ea8e03542c4f50b"],
  "f7d8b9b0af470b4b8811847f143b5dc08b3a929ce1bbd70773d97ff13e3efda7":
    ["3a448f7e5dd5e0aa0fcef2623b372418afdc5123115baf531c8fd1eabe2a34b6"],
  "f7f2072bfcde3b833ff1c388e9e1190936fde208e69e8363b732ea3944ce4f7b":
    ["58b097f1abea4f6c552decc203c13f53d5cc12ef675e46beac2c2abd1bad24a5"],
  "f87a53c521f38915783764c18327bb345ac6b4e1ee89e4b7a7a6c8fede9c2d76":
    ["504c9e7c2b68b36a69baa7fb1c2e5ed653ae6ee5c3a7ec66d83b2fe053deb6e0"],
  "f8b8bedf6f71429d4c03eac5b02a1b0b397ca696361cf014dc89c2639b4f1875":
    ["b71e3f4487357996d615dc2237ea6695f1ccb35f0702544ce4ecd7544c3bfbfc"],
  "fa6eabfec92de162981e0cd861736dbaf8b7b4f43db37224829947441f480a73":
    ["c25f03a3b3d7710f6524442e4d8c76c8adaad14d58637737ca770170d5cbbd13"],
  "fab95ac17337f47eb40041e800b82b5e5eab7f5c19a7cebf59955a3db9e136c4":
    ["a69e40a439fd7b71128ad5981b72e3a74b904fb711b7fddcf2c80a9fe4589ddb"],
  "fb40f0e9f5c3cabc04af92178d9c724a4af8233c60360df2e12487614598b66c":
    ["739c345dc7769f625f68bae6cecebebc6e5728c7fc91f0692ef15468df977763"],
  "fb96881d692f9e58bd28daaf2a4c0f2872c9fe2f8f19b5a7248e244fbd91a03c":
    ["84eb016c3d36815e4b14ecf62eabda40a045dfe5c55419293a68eee375d103a9"],
  "fc2afe3ac91e845eae941170a63964156daad419c4d82d54e17227b694bac250":
    ["5c8768c6c1c9126725b399229afce79ed4b10b14bfbd3730490889c4b563cdd1"],
  "ff540acea56ffbc5947288f9d461495e1970006fba7799ffd9d2b1dae1d06b93":
    ["41d33aeaf230d0bbc6f3c528dd9e96232a82db7fd24c9762882ba8a0cfb84257"],
});

// Per-client proof facts this client's review added.
const FACTS: GenerationFacts = Object.freeze<GenerationFacts>({
  resignChatPaths: Object.freeze([
    // The October path renumbered; bodies differ only in reviewed callee
    // indices and relocated operands.
    { editor: [13691, "1db8ba05f768aac797e225582b746434ca4b75d565d94aad4c3814afc3bd6af6"],
      history: [7887, "f4649cdc08d2f6cec6d2719956745aabd769ef5787dba529cc476457de2daa66"],
      sender: Object.freeze({ functionIndex: 7879,
        params: Object.freeze(["i32", "i32"] as const), results: Object.freeze([] as const),
        bodySha256: "3947df1c888113fe94a12fea2f3d500387b71f2e56b8ddf970d571621248b584" }) },
  ] as const),
  whisperPaths: Object.freeze([
    // The October path renumbered (reviewed callee and operand moves only).
    { sender: 7879,
      functions: [
        [358, "1c87ab4b0831420341935898d106c902d85897a116b4beb7492bf4ab3b1ea9c7", ["i32", "i32", "i32"], []],
        [11744, "6e67ac04077857e0da665be75ad5ed98a9927a5607bc1ddbd78fb1ab8039f04c", ["i32"], []],
        [5865, "f7a2017ce827175b1c593cc6f62f34bcc06c43593157a8f267305eec062e9a0a", ["i32", "i32", "i32"], ["i32"]],
        [5871, "013e7a049e0be2d3e4597d1feee0bad39f0ba1fe1d5ffd82cf35397630264e10", ["i32", "i32", "i32", "i32"], ["i32"]],
        [11742, "a6c78374f4e6a901900a6f8102a49fa487170877630e532b9e1d9388bda1d93a", ["i32", "i32"], []],
        [8847, "6694fdf5dc2395af5adab5e60840eba7467316720b57c4e3a64f4526bb027b5c", ["i32"], ["i32"]],
        [5779, "5fd1c714b97dfb852012420d0e8d5f32e28bd9fee000590de08958ba78a11031", ["i32", "i32", "i32", "i32", "i32"], ["i32"]],
      ] },
  ] as const),
  nativeRenderFamilies: Object.freeze([{
    // The October owners at their renumbered indices. Bodies differ only by
    // reviewed callee indices and relocated static operands.
    functions: Object.freeze({
      264: [264, "94ec7217d0fb11ead98600b7b8aa2b71ee55fad6b936d2133088b33c9962a37d"],
      748: [748, "f1f53c94b6340f394c360c3af0f5604ad5514488751fb18ce360585ddfeb2fa7"],
      750: [750, "0eebb2bfac9638f17b674c5990802c188a3a98d432d4c4a6737fb7f4551a9e82"],
      1333: [1333, "2a2380fe271d2f3933c1749f73bfffbf6d967b605a59473d0e449053cb937dd5"],
      1334: [1334, "8c2f991e381aec54c79bb3f236652fade8de44da3fa92cfe45556bc4af60f183"],
      1357: [1357, "f03a6885a613d93b5bf27e62afcaffd5bad1ec08f238960baf04d4c3cdf4d5e5"],
      1444: [1444, "e2e5d918d727ef14b7fdaef41f3446c65193f6fbe80446be6566a477681a0904"],
      1445: [1445, "ea7a7ab8c07165ee61b3c8239cc8140771eeee9b8677841632064817b116d1ee"],
      1446: [1446, "875e9edf6a7f4c6837dd661b3e487dc87b8f2be0be416272c54c14dbe116c5dc"],
      1448: [1448, "6580203bcf57308ea063af0cf46b314a2e867c29791a5a5295082a0219c03981"],
      1449: [1449, "1c11192753e67ba74ed7db55945f93c10d72b799061fd31b496fc2cdc0d6d26b"],
      1522: [1522, "b3f4866ffd9ff0fd9f0bbdf9411161a78cb2b23fdc917a73fe33b000fc907d13"],
      1530: [1530, "bac0f3e38dc0b587dacfe3fcfc9a7527124f20cc07d54837da50def04cff29f6"],
      1532: [1532, "f75cc657befc8f51513048bfa7fd7fae85f7b689e47f300a15b0343e924b082e"],
      1554: [1554, "06c86f4e20b8c3713eaed0f50ab36aeedef50a7539649dbdfe2628a3ab5554ff"],
      1556: [1556, "1bcca33c2669e2c14a46c1c325653b3c2e73bdd073b4ac7194d27922b195f531"],
      1559: [1559, "72ab3beab5262b9e3bb92a2695479eadc0ed735e8bf8c4dfb02b25b2232d38be"],
      1563: [1563, "9969e5908a09a60a335a30adeec9da025c7d33fa8bf278eb5f80464e3cf7fb20"],
      1564: [1564, "4c7a70b4c78dc64bead8081fe4faca0e32911c1bc53d58bb5fbc2a9386b5f1ff"],
      1565: [1565, "0185f0d5b13a947c1a5f7219ece1a98d0beb89a43b12a0f3d9bb617d0505d384"],
      1569: [1569, "58eae3c31255da6e2582ded4e0615fadbb5619ecdbff597bba9dcbe166d315c4"],
      1572: [1572, "0d881eec84eb2b448d3369ceb3f3225398bdd4ddfbd4f94f282422f24ed956fe"],
      1579: [1579, "11a75789cdf24acade096cfa060b013d6141704fbbb74af31be80251e4b71b9d"],
      2187: [2187, "06c41429f7f2d794d0c061e23335f11cb06a2e7a02a8a81da39988eb81f569f6"],
      2249: [2249, "51d5de10730b93272866f3917776eaeecb3a68aabaaf8213f0667a315da141d7"],
      2902: [2902, "23f71618e47ebe1e6ce6d50f5290541213e0ecc426374a772a87eb75e4831a2c"],
      2922: [2922, "f4c491012226f9c08387bee278c9e91338ab82de5c71bbfb64ac62017df31777"],
      2956: [2956, "dedf71e8cbad3dc24b3395c14bc1dc9efeba767687dd25232da35d150d39c4cf"],
      3137: [3137, "7b85811f2e1b9f0a13e66b76ccb01795d0f4288e9a3fbf9900530cdfa1fc1339"],
      5595: [5595, "3af2d946882f262b60718623a18d3977acf92194150c65ea4fab8684906ed703"],
      6271: [6271, "be00d4ff939b6259324f83b9d53bc1c3f3019f027c1e2c605189fb90946a6212"],
      6284: [6284, "ee1c414b1434b2bba3f690497cd88a7d0381cd6948643a8c47a0035917175ec5"],
      6285: [6285, "98f46fb22fd105072fb6f5d3ccd8665fd7d4245d493b9f076264f3ebdc5d5191"],
      6295: [6295, "1b0c75eca543e147f8a6ea4965befb9591b03b8b482586bc45b90f47eef77ac0"],
      6446: [6446, "f0d0f6091ea4b8749c00cf2973a0b8911a49993b0afe79182952b7d3cca715f7"],
      6447: [6447, "0d43f0fabac0c7d463f4a6b073a45e16941642f88416841b0d8524e2348b38c8"],
      6450: [6450, "643f6733c8a74d823848b179fe61383cb9706e5f5181d1d016c48e64831648a0"],
      6488: [6488, "04fc81d673ee0a07d8de4e00a57d318c54cb0b68230f6d86fad10ec03d88dc08"],
      6490: [6490, "ad22c95211ae5de444cbee2a37f1a07c2b9fb6e0d6f23caa758fd7ba9ac7d91c"],
      6492: [6492, "d163abd18f36b31e89ed488c1e60435c83b56d065f1936405d89400f2c772a08"],
      6584: [6584, "498a580fe1f2863df8c929ecbff1e8f864ed96ff53f7b18b803ae84dfb2545a7"],
      6585: [6585, "4d9928f3e8c33a8b056fb4788f987afb22e7699cc4dd331fdd95f2e43b7965b9"],
      6593: [6593, "35aa20e5d81ca4dfb8962dd9bcb1ada197af1bb86001f6012fc1bdcfdf1cca92"],
      6598: [6598, "91f5cf516b125fd6181e4e003e4b6d7acc841c37052438bf9d213ff71e27bf87"],
      6827: [6827, "c777401e75f6220143cd3bc2f5573ac8b64b550796f0813ed85350d136af8c2c"],
      13125: [13096, "4551e1ad9a08c2e1e81337ccf3b59c4a2654fbabac9389c317300d9a3f5a6d88"],
      13162: [13133, "78097eeffeda60e8515e4165d071541ec4dbdbe55065a7b243ba4f5d910a58b2"],
      14063: [14036, "0974bc46436ed9ea7c2d7c18f8c0b8a23dba3ff7e8d22c0ad61f21f27acd7948"],
      14112: [14085, "f23d7dab7f956f4afb6a08d9ac733628dbf01d6c50ba70f9d0cb818fce3ac5e0"],
      14116: [14089, "729d1412702fe4623a7163973c7427e3e7d54213f6432824786ad2210ca962de"],
      14126: [14099, "256397ed0536d44ea656323cddb51bc29fb2b87b6af98a5793ff8ee9292a7c6a"],
      14132: [14105, "bac5eee8d292fefb8c69b2b4539f1ad1bc22dffab4e8593ca0beb0821dd30b1c"],
      14137: [14110, "7cd1bc60cf003ca029aa52e133acde34ca8d3f1692636904f852170c9c97740a"],
      14147: [14120, "b47aa2a9b0df83431a59ccf6754b9435af7f2f4b9e35be532930ce89323854ae"],
      16125: [16112, "59c2c2556eeb11939ddfca127f48e9147c954fda6644dfc100bcacbbbb78561c"],
      16136: [16123, "73c890f5440d0ee73e0b71408fc0b04cb728660f8d34e5c5cfbe2a94dd2b1667"],
      16170: [16157, "96ee4aaabf5072bb3a7657d86461ab56d48b7d1be88f07e0ba4662a5f03c5421"],
      16224: [16211, "7d9544f06ff6453d5c0af45b2da1fab79fea540ff077d715c439e603658a13ac"],
    } as const),
    modelTypeOffset: 1341088, graphicsDevice: 2744952, underMouse: 5921340,
  }]),
  pathingFamilies: Object.freeze([{
    // The August indices; only source-path and assertion string pointers moved.
    functions: { loader: 3208, converter: 3216, boundWriter: 3273, coordinateWriter: 3281, builder: 3288 },
    hashes: [{
      loader: "0c06d90dc7e34f23599e1bdee39e88834caaecd3af7a90d504189190cab7801e",
      converter: "ee19b011e40f47e602a1bfb68b7cff9baca3a959b4bc6a2b8aba9830b321f193",
      boundWriter: "8850a945edc4d36ed0032841c451d40844b6bdab864de79e8847c5a7cb4d975e",
      coordinateWriter: "45b114e3982a2433572cf1c9589398b47b0d8e4931958f80788c5efb08fcc715",
      builder: "47b1743a0f714bdb0c2d03ca8e6fb4ae4ef25278b29cff2f68ef5070f7ba50bc",
    }],
  }]),
  // October 22 renumbered the Cartography surface owners and their callees;
  // the bodies are unchanged apart from moved static addresses.
  cartographySurfaces: Object.freeze([Object.freeze({
    compassRender: [14213, "1082760d337d455ea976e2b6c9b99132e0e529417af2037e70ca08eeed819f0d"],
    compassMapRender: [14152, "9c5177d9ca50b7fe47f7ecf52a452e4eb793537066efd1110795dbd07b52bf26"],
    missionMapDispatcher: [16123, "73c890f5440d0ee73e0b71408fc0b04cb728660f8d34e5c5cfbe2a94dd2b1667"],
    missionMapGameplayContext: [13533, "a7791775e7756465b85e9fde1f69dfdcfebc0004d3e9183421de2e1cb5f5e379"],
    worldMapDispatcher: [16210, "3667feefe1f218d803112d8c3d2c3f7c60efdaba9694b80a0ed86fe1a849d646"],
  } as const)]),
  friendLifecycleRoles: Object.freeze([Object.freeze({
    // Message IDs and source-line witnesses shifted by one and static state
    // moved; every call and connection-store relation is unchanged.
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
    connectionEvent: [1084, ["i32", "i32", "i32", "i32", "i32"], ["i32"], "f3d7ae43b928a0164a75d78e00c2a96a45fca4db7dc71d26024775361d580a4e"],
    disconnect: [70, ["i32"], [], "6af541a904883bfec8e0ae09525157f10819c96ced8b11d48acf273f0b25e0c1"],
    logout: [206, ["i32"], [], "951991fe548dc3f2a0929f8e044fb72986e79c33230ff37faa50a022e1664643"],
    connected: [342, ["i32", "i32"], ["i32"], "b5258d2937ae73dcacc82e55cd94868b2085bfa2749d9b3ffcde3f0cbd2eb879"],
  } as const)]),
  templateCalleeBodies: Object.freeze({
    "screenshot-initializer@145": [
      "39588467c28056e405de7c7ccfae6406a55c2fdd6fe5c098e2463f515e150d4c",
    ],
    "screenshot-initializer@235": [
      "41f2ad0db5a53500e1f5dc2997ecc088474aef40f50fc859e602d9608d511285",
    ],
    "directory-sink@776": [
      "3317e78afc6f79ebe49e205870dd7776c79856917cd6865a6e0ff1a87a5195e2",
    ],
    "directory-sink@1104": [
      "3317e78afc6f79ebe49e205870dd7776c79856917cd6865a6e0ff1a87a5195e2",
    ],
    "screenshot-sink@228": [
      "ee1a49f2a81244b7bc055fd861e81d5a2dc5d3b6ec82ce6044be2b35dc83ec1f",
    ],
    "screenshot-sink@952": [
      "df3cea5724a9ba0e5f08965c82bfb5a6d703f991c718dd6e72e5a867f5ac1a62",
    ],
    "screenshot-sink@1215": [
      "3317e78afc6f79ebe49e205870dd7776c79856917cd6865a6e0ff1a87a5195e2",
    ],
    "screenshot-sink@1235": [
      "3317e78afc6f79ebe49e205870dd7776c79856917cd6865a6e0ff1a87a5195e2",
    ],
    "screenshot-sink@1412": [
      "41f2ad0db5a53500e1f5dc2997ecc088474aef40f50fc859e602d9608d511285",
    ],
    "skill-scan@585": [
      "dea6fb367ceaed35d245132686f1968cacdfc91d5074967ac1cd16477fc3d908",
    ],
    "skill-scan@898": [
      "3af2d946882f262b60718623a18d3977acf92194150c65ea4fab8684906ed703",
    ],
    "skill-scan@1013": [
      "7412f7e8c717d242295a3bcff19ecbb6ab94087026ca81204b208203a968d1b5",
    ],
    "equipment-scan@613": [
      "64df59a14dea52ba83e26c9a485a03b4eab19cff407feda34eb0b2c3f12ae30e",
    ],
    "equipment-scan@1055": [
      "3af2d946882f262b60718623a18d3977acf92194150c65ea4fab8684906ed703",
    ],
    "equipment-scan@1211": [
      "9d15fca77c779c94d8525c7d3b9a555d233f8f41027088ea2d3da59cb7d8326f",
    ],
    "helper:callee02": [
      "139139b77f2ae9ac179610919f9ce2bbe41a3ff5b4e76abf73bc5bc4bb3ef83b",
    ],
    "helper:callee03": [
      "3db3429fc0c9517f7e70987bfa0b93e02607317cfa478349b3ceba089e4f1757",
    ],
    "helper:callee05": [
      "30484bc0e8064e33a1857aee6f826be04522e41b64027516a2fb792976c7712f",
    ],
    "helper:callee07": [
      "dbcadc02907cff650426b68bbf3e4b23db4a569dd407ae6088d8b42bda5ff2ee",
    ],
    "helper:callee09": [
      "85c9209ec6ab5816fd03a3199399f6e4d5df13027889f143c27a7f0180f78a9e",
    ],
    "helper:callee10": [
      "7d97b71f5d156c1f05cd7e6634df55bce242cc3f26231c63665a4f90686ad057",
    ],
    "helper:callee11": [
      "b7438c827d6311ba9717adbaae7f4354ad6cf200e85b6a053d7e821c14eb53ff",
    ],
    "helper:callee13": [
      "152773bfd5a8ce9f2c57da2cce836665ccdb9e4a1dd91848a7f2a6769ac091a2",
    ],
    "helper:callee14": [
      "3af2d946882f262b60718623a18d3977acf92194150c65ea4fab8684906ed703",
    ],
    "helper:callee18": [
      "9a25d91557bf40566ba9ece25b3fbdba513dbe39cdb01d8437136c3b7e4a3b56",
    ],
    "helper:callee19": [
      "52da1316c9b34cbe105e61f8fb57299fae34b578b9374a90cb99b5b62125abd1",
    ],
    "helper:callee20": [
      "f7a2017ce827175b1c593cc6f62f34bcc06c43593157a8f267305eec062e9a0a",
    ],
    "helper:callee21": [
      "045a6ee62e8d1f734569522014a858a6758b2c3a539a900f28d203acc5669d04",
    ],
    "helper:callee22": [
      "0ee5da3f9ac0784d90d4929af0c95fb4f30a6031131d2bb6448ab5d65347ef2d",
    ],
    "helper:callee23": [
      "f6211064a9095c95a0e3c5985cc7be8ac1a60f2f4d2ee4f71f4f17ffada7730d",
    ],
    "helper:callee24": [
      "f1f53c94b6340f394c360c3af0f5604ad5514488751fb18ce360585ddfeb2fa7",
    ],
    "helper:callee25": [
      "e0367d789b61fd5925ce7e5bf91edf877c4da34ecb35aec0e05b891d8a05a123",
    ],
    "helper:callee26": [
      "03844b0c6a4d337ba3fe8d0ff5c2a49d2e0b0361139cf5304f7ad96d8c45077c",
    ],
    "helper:callee28": [
      "8ecb0d6602cdaba02ae722c0c63d16dda2ac17c24cff9632be9b004f2b87e162",
    ],
    "helper:callee29": [
      "904295e566954f26871fa81daaceb0bd909895d6130b48b84d8cb5aaa4a11488",
    ],
    "helper:callee31": [
      "7a9d15aca8e00a91fe5d9ea16eb882c3d42b7fc7566f89be0a09f66c7576d19f",
    ],
    "helper:callee32": [
      "e0805ec3c8e1395354738f31e9e9939cc1008cf480843ddfdb4b8a17fcce779d",
    ],
    "helper:callee36": [
      "bc12b3ab4d27eff749e60b03ff18c292e285f6237409d97b1331f816938cd771",
    ],
    "helper:callee37": [
      "7f02d1cc20202f00c260b788d76771103bbf7fd7f0ee0d668452ad4e985aa22d",
    ],
    "helper:callee38": [
      "a559309977e2046c42b074002eddea657b260075a9ff88c35c33218d885e7534",
    ],
    "helper:callee41": [
      "5e6a5f7de8ba304c3cef666164ad58cd9a98f3ca2fc4f0936b84697d15b38cbb",
    ],
    "helper:callee42": [
      "e9cde57ea98b6cc14857a2c959d18bea23e541e6a5dfdbf253d19fe47743c82d",
    ],
    "helper:callee43": [
      "4fa038d51707e69ff165e87c54b46fb668f35782d5231bc437609ed4dbaacd5d",
    ],
    "helper:callee44": [
      "d2cbabb903aaf2e40ab483446c8e4f76f30226be812839d03e7ea9674d191286",
    ],
    "helper:callee45": [
      "28d6b4daa55ba4af3b714af8d168812cbe9142517924bb38111a15d5f25ecab1",
    ],
  }),
  // Alternatives to reviewed reference literals: the same function in the same role.
  alternatives: {
    // Guild Hall native message producer: callees renumbered.
    "fab247e15279c61c5783bc16f6c02cbf411b3056979f6a765b61763e52bc7d87": ["3adcc506569c2134909f4a1429062c579d9e28a9bcdecae5bafa55b9120b71c9"],
    // Game-thread drain: identical body; one reviewed callee index moved.
    "99f25dda4f00ee0aee4950f638ce5ae485ce25d5319a480f3ae8e7f0df452895": ["e97bf7c3b2f0e47b07f1cde77500e509a88ec364a94fec0980ea3862ce04b7ca"],
    // UI dispatcher: same body; the assertion source line moved (3901 -> 3907).
    "0c464900f79570672bf60d83386a9388a68204e519bda6b391021c7e855afc4a": ["bd1a37645f311cea53ba09df62c09c40a1c67aa3c7f61faf5694d5b5f1ca06ce"],
    // Hero panel packer: only assertion string pointers moved.
    "10aaa2a03010eea192af9f03466665a3036ecd2dc6b94ebe8ff8bdbc9471ba9e": ["46b73500a7f2d248c607d281f91c3fb6b9337297c1f6fd71dc831f10efdc865b"],
    // Pre-game character array reader: callees and relocated operands moved.
    "6a06520c167ee5693f963ae52777221d6fd961222104e853212a359065a65e98": ["f8b8bedf6f71429d4c03eac5b02a1b0b397ca696361cf014dc89c2639b4f1875"],
    // Pre-game selected character reader: callees and relocated operands moved.
    "98199404d6647d4992d54073b08e0436123f87cd6d30d734d0ffb46c5f7ad552": ["f1bdea374b3bf67822e7fc8ed4a173b7e213ee865d77469c8a4f77c560aad0ce"],
    // Pre-game frame parent: callees and relocated operands moved.
    "47471cef99aa5e8df678cddb7a7340e4ef1ad05c9a67f6ab90ed61875a910c71": ["3b866a4e5d9e1e09b60c7e92acb62fb069c800e96ca0113e971e8353655e7ab0"],
    // Pre-game frame message: callees and relocated operands moved.
    "c90eccbb0cb8c13058b017e4edb6452161f04c800d10f35b26f280921e6714ca": ["aa73fe42c13b207f22b9fb3ec2a7a390119f8fc0f35a3a1a2cb60e84f43115fd"],
    // Pre-game logout producer: callees and relocated operands moved.
    "c28e4801b717aaafddcd99305edf49aa938fd6e9adb19829a60a22e6215db435": ["85dd3fead9b386dc920924374f8d12bc8a0d6ab7d3f84e9240c0a6a918c87ee7"],
    // Pre-game frame constructor: identical body; one reviewed callee index moved.
    "5ffea848000894bd9d125990acb4974301d885065c3f1e4c2926fdd147ddaae9": ["d163b9fd10495ddd5fae4947a468532425290ee316ba66190e59e91b7471d5a0"],
    // Skill-slot constructor: identical body; one reviewed callee index moved.
    "c6e2c7620ad7fc34a4ed78c716639e648755cf8010a73a03eade8873e202cb4e": ["c4edab6f9b07609efbb005194c4bf075b504c0da552637acf79c6b8805aa3013"],
    // Skill-slot allocator: identical body; four reviewed callee indices moved.
    "c42147cced310b1a2caffa8c91e6a824f156ce274c413a5033fa233598a64b7c": ["cd19729848a8981a6c93b2e6df14d8c65a6b9861557319b876b27e176e8bb2d3"],
    // Attribute commit: same eight calls in the same order. One reviewed
    // behaviour change: lookup result 11 now also takes the existing reset
    // path (field +16 = -1), alongside 0. No new stored state appears.
    "cf7aa8709af2199c7f266560d807fffa582f3573521513ef6547aadecec8d5e8": [
      { bodyLength: 166, fingerprint: "f87a53c521f38915783764c18327bb345ac6b4e1ee89e4b7a7a6c8fede9c2d76" },
    ],
    // Target selector: identical control flow; the related target fields moved with the shared observation storage.
    "89d6081789bb8fa302685b140e58a68eb24f7533ec07c7059c97523ce5060110": ["3789c63f2f9c7189d49ac9d02ba40a7c555fb5f07027d34c6872ff079ee97d16"],
    // Compass owner: callees and static addresses moved.
    "968c145474ccf26e7b2b8bd64ee11c06cecd0e9d0af011474560111c421cf209": ["914b7d302bc76177c3b75ba3372d795198eb9b132545638b69c56996770f2b14"],
  },
  // A Guild Hall area-type accessor counts only beside its exact area context and lookup.
  guildHallAreaTypeFamilies: [{
    context: "4c7ccdfd23aa3144a9d44b439df0293493ac7b04c19475cbb224580610c0e29e",
    lookup: "081506484a3019e40c1a934f95f88ff3911d70640c0f446afc6c3a3fb4975e5e",
    accessor: "43acce2aef9325f192efa422dee707362fe3b16feaa891447c5256d6eae86099",
  }],
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
  facts: FACTS,
});
