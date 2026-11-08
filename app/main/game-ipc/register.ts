/**
 * Registers every Core game channel: each owner part's channels, checked at
 * compile time so that every channel of GAME_CHANNELS has exactly one owner.
 * Adding a Core capability is its table entry, its owner's channel, and its
 * preload line.
 */
import type { GameChannels } from "../../shared/ipc/game.js";
import type { InvokeKey } from "../../shared/ipc/channel-table.js";
import { ownedOnce, register } from "../ipc-channel-registry.js";
import app from "./app.js";
import client from "./client.js";
import clipboard from "./clipboard.js";
import diagnostics from "./diagnostics.js";
import network from "./network.js";
import type { GameIpcInput } from "./part.js";
import secrets from "./secrets.js";
import settings from "./settings.js";
import templates from "./templates.js";

export function registerGameIpc(input: GameIpcInput): { drainSecrets(): Promise<void> } {
  const secretParts = secrets(input);
  const parts = ownedOnce<InvokeKey<GameChannels>>()([
    client(input),
    network(input),
    secretParts,
    settings(input),
    diagnostics(input),
    app(input),
    clipboard(),
    templates(input),
  ]);
  for (const part of parts) register(input.windows, "game", part.channels);
  return { drainSecrets: () => secretParts.drain() };
}
