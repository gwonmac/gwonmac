// The Core game preload: the game bridge on the Core channels only. Built to
// build/preload/preload-core.cjs; the Tools namespaces live in tools.ts, which
// this bundle never contains.
import { exposeGameBridge } from "./game-bridge.js";

exposeGameBridge();
