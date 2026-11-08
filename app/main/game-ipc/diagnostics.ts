/**
 * The game window's diagnostics channels: graphics facts, clock
 * synchronisation, renderer metrics, frames and milestones, the current
 * summary, visual problem captures, and the diagnostic profile.
 */
import type { GraphicsDiagnostics } from "../../shared/contracts.js";
import {
  isRendererFrameBatch,
  isRendererMetrics,
  type RendererFrameBatch,
  type RendererMetrics,
} from "../../shared/diagnostics.js";
import { ValidationError } from "../../shared/errors.js";
import { parseDiagnosticProfile, saveDiagnosticProfile } from "../core/diagnostic-profile.js";
import {
  diagnosticSummary,
  diagnosticTimestampUs,
  recordClockOffset,
  recordGraphics,
  recordRendererFrames,
  recordRendererMetrics,
  recordRendererMilestone,
} from "../diagnostics.js";
import { channel } from "../ipc-channel-registry.js";
import {
  args,
  isGraphicsDiagnostics,
  nothing,
  one,
  parseRendererMilestoneArgs,
} from "../ipc-values.js";
import { parseVisualCaptureSubmission, submitVisualCapture } from "../visual-capture.js";
import type { GameHandlers, GameIpcInput } from "./part.js";

const asFiniteNumber = (what: string) =>
  one((value: unknown): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ValidationError(what);
    }
    return value;
  });

const asClockResult = args(2, ([offsetUs, rttUs]): [offsetUs: number, rttUs: number] => {
  if (
    typeof offsetUs !== "number" ||
    !Number.isFinite(offsetUs) ||
    typeof rttUs !== "number" ||
    !Number.isFinite(rttUs) ||
    Math.abs(offsetUs) > Number.MAX_SAFE_INTEGER ||
    rttUs < 0 ||
    rttUs > 60_000_000
  ) {
    throw new ValidationError("invalid clock synchronization result");
  }
  return [offsetUs, rttUs];
});

const asGraphics = one((value: unknown): GraphicsDiagnostics => {
  if (!isGraphicsDiagnostics(value)) {
    throw new ValidationError("invalid graphics diagnostics");
  }
  return value;
});

const asRendererMetrics = one((value: unknown): RendererMetrics => {
  if (!isRendererMetrics(value)) throw new ValidationError("invalid renderer diagnostics");
  return value;
});

const asRendererFrames = one((value: unknown): RendererFrameBatch => {
  if (!isRendererFrameBatch(value)) {
    throw new ValidationError("invalid renderer frame batch");
  }
  return value;
});

export default ({ paths, windows }: GameIpcInput) => ({
  channels: {
    diagnosticsGraphics: channel(asGraphics, (win, value) => {
      recordGraphics(windows.requireDiagnosticOwnerForWindow(win), value);
    }),
    diagnosticsClockSync: channel(asFiniteNumber("invalid renderer clock"), () => {
      const mainReceiveUs = diagnosticTimestampUs();
      return { mainReceiveUs, mainSendUs: diagnosticTimestampUs() };
    }),
    diagnosticsClockResult: channel(asClockResult, (win, offsetUs, rttUs) => {
      recordClockOffset(windows.requireDiagnosticOwnerForWindow(win), offsetUs, rttUs);
    }),
    diagnosticsRendererMetrics: channel(asRendererMetrics, (win, value) => {
      recordRendererMetrics(windows.requireDiagnosticOwnerForWindow(win), value);
    }),
    diagnosticsRendererFrames: channel(asRendererFrames, async (win, value) => {
      await recordRendererFrames(
        win.webContents.id,
        windows.requireDiagnosticOwnerForWindow(win),
        value,
      );
    }),
    diagnosticsRendererMilestone: channel(parseRendererMilestoneArgs, (win, ...milestone) => {
      recordRendererMilestone(windows.requireDiagnosticOwnerForWindow(win), ...milestone);
    }),
    diagnosticsCurrent: channel(nothing, (win) => diagnosticSummary(win)),
    diagnosticsVisualSubmit: channel(one(parseVisualCaptureSubmission), (win, value) =>
      submitVisualCapture(win, value)),
    diagnosticsProfileSet: channel(one(parseDiagnosticProfile), (_win, value) =>
      saveDiagnosticProfile(paths.diagnosticProfile, value)),
  } satisfies GameHandlers,
});
