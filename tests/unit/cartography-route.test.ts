import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CartographyRoute } from "../../app/features/cartography/renderer/reachability-kernel.js";
import {
  ROUTE_RETRY_MS,
  ROUTE_STRAY_UNITS,
  createRouteTracker,
  pullRoute,
  routeFrom,
  routePath,
  routeChoice,
  routeInMapUnits,
  routeProgress,
  routeTargetIn,
  type RouteTarget,
} from "../../app/features/cartography/renderer/route-path.js";

import {
  readCartographyQuestMarker,
  updateCartographyQuest,
} from "../../app/features/cartography/renderer/cartography-player-state.js";

type Step = Readonly<{ centre: readonly [number, number]; edge?: readonly [number, number, number, number] }>;

function route(start: readonly [number, number], end: readonly [number, number], steps: readonly Step[]): CartographyRoute {
  return Object.freeze({
    mapId: 200,
    areaEpoch: 7,
    reached: true,
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    centres: Float32Array.from(steps.flatMap(({ centre }) => centre)),
    edges: Float32Array.from(steps.flatMap(({ edge = [0, 0, 0, 0] }) => edge)),
  });
}

// East along y 0..10, then north along x 10..20.
const L_CORRIDOR = route([2, 2], [12, 28], [
  { centre: [5, 5] },
  { centre: [15, 5], edge: [10, 0, 10, 10] },
  { centre: [15, 15], edge: [10, 10, 20, 10] },
  { centre: [15, 25], edge: [20, 20, 10, 20] },
]);

describe("the walking line", () => {
  it("goes straight when nothing is in the way and bends only at the corner a wall forces", () => {
    const straight = route([1, 5], [29, 5], [
      { centre: [5, 5] },
      { centre: [15, 5], edge: [10, 0, 10, 10] },
      { centre: [25, 5], edge: [20, 10, 20, 0] },
    ]);
    assert.deepEqual([...pullRoute(straight)], [1, 5, 29, 5]);
    // A line straight to (12, 28) would leave the corridor before x = 10.
    assert.deepEqual([...pullRoute(L_CORRIDOR)], [2, 2, 10, 10, 12, 28]);
  });

  it("measures progress along the line and never moves the player back to an earlier stretch", () => {
    const path = routePath(Float32Array.of(0, 0, 100, 0, 100, 100), true, 1);
    assert.deepEqual(routeProgress(path, { x: 50, y: 10 }), { along: 50, away: 10 });
    assert.deepEqual([...routeFrom(path, 50)], [50, 0, 100, 0, 100, 100]);
    assert.deepEqual([...routeFrom(path, 150)], [100, 50, 100, 100]);
    // Back near the first stretch, after having walked 150: the line keeps its place.
    assert.equal(routeProgress(path, { x: 50, y: 0 }, 150).along, 150);
  });
});

describe("the route tracker", () => {
  const target: RouteTarget = Object.freeze({ mapId: 200, areaEpoch: 7, x: 12, y: 28 });
  const frame = (now: number, player = { x: 2, y: 2 }, asked: RouteTarget | null = target) => ({ now, target: asked, player });

  it("searches once, then again only when the player strays, and a refresh with the same line repaints nothing", () => {
    const searches: RouteTarget[] = [];
    const tracker = createRouteTracker((asked) => { searches.push(asked); return L_CORRIDOR; });
    const first = tracker.update(frame(0));
    assert.equal(first?.path.version, 1);
    for (let now = 16; now < 5_000; now += 16) tracker.update(frame(now, { x: 6, y: 6 }));
    assert.equal(searches.length, 1, "walking along the line costs no search");
    const strayed = tracker.update(frame(5_000, { x: 2 + ROUTE_STRAY_UNITS + 10, y: 2 }));
    assert.equal(searches.length, 2);
    assert.equal(strayed?.path.version, 1, "the kernel found the same line, so the version stays");
  });

  it("waits after a failed search, searches at once for the next area and drops the line without a target", () => {
    let answer: CartographyRoute | null = null;
    const searches: RouteTarget[] = [];
    const tracker = createRouteTracker((asked) => { searches.push(asked); return answer; });
    assert.equal(tracker.update(frame(0)), null);
    assert.equal(tracker.update(frame(ROUTE_RETRY_MS - 1)), null);
    assert.equal(searches.length, 1, "a failed search is not repeated at once");
    answer = L_CORRIDOR;
    assert.notEqual(tracker.update(frame(ROUTE_RETRY_MS)), null);
    // The same goal in the next area: the kernel still answers for map 200, so the line is refused.
    const next = { ...target, mapId: 201, areaEpoch: 8 };
    assert.equal(tracker.update(frame(ROUTE_RETRY_MS + 16, undefined, next)), null);
    assert.deepEqual(searches.at(-1), next, "a new area searches without waiting");
    assert.equal(tracker.update(frame(ROUTE_RETRY_MS + 32, undefined, null)), null);
    assert.equal(searches.length, 3);
  });
});

describe("the route target", () => {
  it("stays on its continent point through travel and forgets it on another continent", () => {
    const goal = { continent: 1, x: 1_010, y: 2_020 };
    const here = { continent: 1, mapId: 200, areaEpoch: 7, worldAnchor: { x: 1_000, y: 2_000 } };
    assert.deepEqual(routeTargetIn(goal, here), { mapId: 200, areaEpoch: 7, x: 960, y: -1_920 });
    // The line comes back to the same map point, so it ends on the ring the player set.
    assert.deepEqual([...routeInMapUnits(Float32Array.of(960, -1_920), here.worldAnchor)], [1_010, 2_020]);
    // The next area of the continent has its own anchor: the same point, in its own game units.
    const next = { continent: 1, mapId: 201, areaEpoch: 8, worldAnchor: { x: 1_020, y: 2_000 } };
    assert.deepEqual(routeTargetIn(goal, next), { mapId: 201, areaEpoch: 8, x: -960, y: -1_920 });
    assert.equal(routeTargetIn(goal, { ...next, continent: 2 }), null);
  });

  it("leads to the quest marker on its own map unless the player set a target", () => {
    const here = { continent: 1, mapId: 200, areaEpoch: 7, worldAnchor: { x: 1_000, y: 2_000 } };
    const quest = { mapId: 200, x: 960, y: -1_920 };
    // The marker is the search target as it is, and its ring sits on the same map point.
    assert.deepEqual(routeChoice(null, quest, here), { own: null, route: {
      target: { mapId: 200, areaEpoch: 7, x: 960, y: -1_920 }, goal: { continent: 1, x: 1_010, y: 2_020 }, kind: "quest",
    } });
    const own = { continent: 1, x: 1_100, y: 2_000 };
    assert.deepEqual(routeChoice(own, quest, here).route?.kind, "own");
    // A marker read on another map is in that map's units: no line until Progress reads this one.
    assert.deepEqual(routeChoice(null, { ...quest, mapId: 201 }, here), { own: null, route: null });
    // Another continent forgets the player's target; the quest line takes over.
    assert.deepEqual(routeChoice({ ...own, continent: 2 }, quest, here).own, null);
    assert.equal(routeChoice({ ...own, continent: 2 }, quest, here).route?.kind, "quest");
  });
});

describe("the quest marker Maps receives", () => {
  it("belongs to the map Progress read it on, and goes away at a loading screen", () => {
    const ready = { status: "ready", sequence: 1, mapId: 13, characterKey: "00000000000000aa", missions: null,
      vanquished: null, cartographer: null, areas: [], quest: { id: 31, mapId: 81, marker: { x: -1_250.5, y: 3_400 } } } as const;
    updateCartographyQuest(ready);
    // The marker is where the client points in map 13 (the exit toward map 81), so it carries map 13.
    assert.deepEqual(readCartographyQuestMarker(), { mapId: 13, x: -1_250.5, y: 3_400 });
    updateCartographyQuest({ ...ready, quest: { ...ready.quest, marker: null } });
    assert.equal(readCartographyQuestMarker(), null);
    updateCartographyQuest(ready);
    updateCartographyQuest({ status: "waiting", reason: "loading" });
    assert.equal(readCartographyQuestMarker(), null);
  });
});
