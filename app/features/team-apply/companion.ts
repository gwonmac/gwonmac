/**
 * Team Apply in the game host: the certified command queue, its payload, and the
 * development profession trace. The commands read the shared party feed and are
 * offered by the Tools window and the developer runtime.
 */
import { PROFESSION_COMMAND_TRACE_BYTES, createProfessionCommandTrace, type ProfessionCommandTraceReader } from
  "../../renderer/profession-command-trace.js";
import type { TeamApplyCommands } from "../../shared/builds/team-apply-runner.js";
import type { EnhancementCommandEnqueue } from "./renderer/enhancement-team-commands.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "teamApply",
  async prepare({ exports, capabilities, substrates: { observation } }) {
    const enqueue = capabilities.teamApply && typeof exports.enhancement_command === "function"
      ? exports.enhancement_command as EnhancementCommandEnqueue : null;
    const traceReader = capabilities.teamApply
      && typeof exports.enhancement_profession_trace === "function"
      ? exports.enhancement_profession_trace as ProfessionCommandTraceReader : null;
    if (capabilities.teamApply && enqueue === null) {
      throw new Error("the commands profile derived a module with no command queue");
    }
    if (capabilities.teamApply && traceReader === null) {
      throw new Error("the commands profile derived a module with no profession trace");
    }
    const teamCommands = capabilities.teamApply
      ? await import("./renderer/enhancement-team-commands.js") : null;
    let commands: TeamApplyCommands | null = null;
    return {
      /** Set on activation; null without a Team Apply profile. */
      get commands() { return commands; },
      memoryNeeds: {
        commandPayloadBytes: teamCommands?.TEAM_COMMAND_PAYLOAD_BYTES ?? 0,
        professionTrace: capabilities.teamApply && window.gwNative.init.development,
        professionTraceBytes: PROFESSION_COMMAND_TRACE_BYTES,
      },
      activate(context) {
        const { memory, core } = context;
        commands = enqueue === null || teamCommands === null ? null : teamCommands.createTeamApplyCommands({
          memory,
          payloadPointer: core.commandPayloadPointer,
          send: enqueue,
          development: window.gwNative.init.development,
          ready: () => {
            if (context.isCleaned()) throw new Error("Enhancement installation is no longer active");
            if (!context.policy().teamApply) throw new Error("Apply team is disabled");
            const playRegion = context.playRegion();
            if (playRegion !== "pve") {
              throw new Error(playRegion === "pvp"
                ? "GWonMac Tools are unavailable during PvP play"
                : "GWonMac Tools are unavailable while the region is unknown");
            }
            const party = observation.party;
            if (party === null || party.status !== "ready") {
              throw new Error("no party has been observed yet");
            }
            if (party.party?.playRegion !== "pve") {
              throw new Error("team commands require a confirmed supported party");
            }
            if (party.party?.inOutpost !== true) {
              throw new Error("team commands require a confirmed supported outpost");
            }
            return party;
          },
        });
        let trace: ReturnType<typeof createProfessionCommandTrace> | null = null;
        observation.onParty((party) => trace?.poll(party));
        return {
          mount() {
            if (core.professionTracePointer === 0 || traceReader === null) return;
            trace = createProfessionCommandTrace(memory, core.professionTracePointer, traceReader);
          },
          commands,
          disposePresentation: [() => trace?.dispose()],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
