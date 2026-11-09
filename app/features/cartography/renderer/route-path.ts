/**
 * Owns the walking line from a kernel route: pulls it tight through the edges
 * the route crosses, measures how far along it the player has walked, and
 * decides when the kernel must search again. Pure and in game units; the
 * painters only draw what this returns.
 */
import { GAME_UNITS_PER_MAP_UNIT } from "./map-projections.js";
import type { CartographyRoute } from "./reachability-kernel.js";

type Point = Readonly<{ x: number; y: number }>;

/** A walking line in game units, with the length walked to each corner. */
export type RoutePath = Readonly<{
  /** x, y per corner, from the player's position at the search to the end. */
  points: Float32Array;
  /** Cumulative length to each corner; the last entry is the whole length. */
  lengths: Float32Array;
  /** False when the line ends on the ground nearest an unreachable target. */
  reached: boolean;
  /** Changes with every search, so painters repaint only for a new line. */
  version: number;
}>;

/** The target the player set: a point in game units on one map instance. */
export type RouteTarget = Readonly<{ mapId: number; areaEpoch: number; x: number; y: number }>;

/**
 * The point the player set, in continent map units. Every map of a continent
 * shares these units, so the target outlives travel to the next area.
 */
export type RouteGoal = Readonly<{ continent: number; x: number; y: number }>;

/** Where the player is: one area of one continent, and its anchor in map units. */
export type RouteArea = Readonly<{
  continent: number; mapId: number; areaEpoch: number; worldAnchor: Readonly<{ x: number; y: number }>;
}>;

/**
 * The goal as this area's search target, or null when it no longer applies:
 * another continent forgets it.
 */
export function routeTargetIn(goal: RouteGoal, area: RouteArea): RouteTarget | null {
  if (goal.continent !== area.continent) return null;
  return Object.freeze({
    mapId: area.mapId, areaEpoch: area.areaEpoch,
    x: (goal.x - area.worldAnchor.x) * GAME_UNITS_PER_MAP_UNIT,
    y: (area.worldAnchor.y - goal.y) * GAME_UNITS_PER_MAP_UNIT,
  });
}

/** A point in this area's game units as a goal in continent map units, the inverse of `routeTargetIn`. */
export function routeGoalAt(point: Point, area: RouteArea): RouteGoal {
  return Object.freeze({
    continent: area.continent,
    x: area.worldAnchor.x + point.x / GAME_UNITS_PER_MAP_UNIT,
    y: area.worldAnchor.y - point.y / GAME_UNITS_PER_MAP_UNIT,
  });
}

/** Whose target the route leads to: the point the player set, or the quest marker. */
export type RouteKind = "own" | "quest";

/** What the route leads to in one area, in both units. */
export type RouteChoice = Readonly<{ target: RouteTarget; goal: RouteGoal; kind: RouteKind }>;

/**
 * The player's own goal while it applies here; otherwise the quest marker,
 * which the client sets in the game units of the map the player is in, so it
 * counts only in that map. `own` is the goal to keep: another continent
 * forgets it.
 */
export function routeChoice(
  own: RouteGoal | null,
  quest: Readonly<{ mapId: number; x: number; y: number }> | null,
  area: RouteArea,
): Readonly<{ own: RouteGoal | null; route: RouteChoice | null }> {
  const target = own === null ? null : routeTargetIn(own, area);
  if (own !== null && target !== null) return { own, route: Object.freeze({ target, goal: own, kind: "own" }) };
  if (quest === null || quest.mapId !== area.mapId) return { own: null, route: null };
  return { own: null, route: Object.freeze({
    target: Object.freeze({ mapId: area.mapId, areaEpoch: area.areaEpoch, x: quest.x, y: quest.y }),
    goal: routeGoalAt(quest, area),
    kind: "quest",
  }) };
}

/** A line in this area's game units as continent map units, like `routeGoalAt` for each corner. */
export function routeInMapUnits(points: Float32Array, worldAnchor: Readonly<{ x: number; y: number }>): Float32Array {
  const map = new Float32Array(points.length);
  for (let at = 0; at < points.length; at += 2) {
    map[at] = worldAnchor.x + points[at]! / GAME_UNITS_PER_MAP_UNIT;
    map[at + 1] = worldAnchor.y - points[at + 1]! / GAME_UNITS_PER_MAP_UNIT;
  }
  return map;
}

/** A player this far from the line gets a new search. */
export const ROUTE_STRAY_UNITS = 500;
/** Gates and doors change the ground, so a standing route is searched again this often. */
export const ROUTE_REFRESH_MS = 30_000;
/** No two searches run closer together than this, whatever the player does. */
export const ROUTE_MIN_SEARCH_MS = 1_000;
/** A failed search waits this long before the next attempt. */
export const ROUTE_RETRY_MS = 3_000;

// Positive when `c` lies to the left of the line from `a` to `b` (game y points up).
function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function same(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;
}

/**
 * The shortest line from the route's start to its end that passes through every
 * edge the route crosses (the "simple stupid funnel" string pull, described by
 * Mikko Mononen). Returns x, y per corner.
 */
export function pullRoute(route: CartographyRoute): Float32Array {
  const steps = route.centres.length / 2;
  const portals: [Point, Point][] = [[route.start, route.start]];
  for (let step = 1; step < steps; step += 1) {
    const from = { x: route.centres[(step - 1) * 2]!, y: route.centres[(step - 1) * 2 + 1]! };
    const to = { x: route.centres[step * 2]!, y: route.centres[step * 2 + 1]! };
    const p = { x: route.edges[step * 4]!, y: route.edges[step * 4 + 1]! };
    const q = { x: route.edges[step * 4 + 2]!, y: route.edges[step * 4 + 3]! };
    // Name the edge's ends as seen walking from the previous centre to this one.
    portals.push(cross(from, to, p) >= cross(from, to, q) ? [p, q] : [q, p]);
  }
  portals.push([route.end, route.end]);

  const corners: Point[] = [route.start];
  let apex = route.start;
  let [left, right] = portals[0]!;
  let leftIndex = 0;
  let rightIndex = 0;
  for (let index = 1; index < portals.length; index += 1) {
    const [nextLeft, nextRight] = portals[index]!;
    // Narrow the right side of the funnel, or turn at the left corner it crosses.
    if (cross(apex, right, nextRight) >= 0) {
      if (same(apex, right) || cross(apex, left, nextRight) < 0) {
        right = nextRight;
        rightIndex = index;
      } else {
        corners.push(left);
        apex = left;
        right = apex;
        rightIndex = leftIndex;
        index = leftIndex;
        continue;
      }
    }
    // Narrow the left side, or turn at the right corner it crosses.
    if (cross(apex, left, nextLeft) <= 0) {
      if (same(apex, left) || cross(apex, right, nextLeft) > 0) {
        left = nextLeft;
        leftIndex = index;
      } else {
        corners.push(right);
        apex = right;
        left = apex;
        leftIndex = rightIndex;
        index = rightIndex;
        continue;
      }
    }
  }
  if (!same(corners.at(-1)!, route.end)) corners.push(route.end);
  return Float32Array.from(corners.flatMap(({ x, y }) => [x, y]));
}

export function routePath(points: Float32Array, reached: boolean, version: number): RoutePath {
  const count = points.length / 2;
  const lengths = new Float32Array(count);
  for (let corner = 1; corner < count; corner += 1) {
    lengths[corner] = lengths[corner - 1]! + Math.hypot(
      points[corner * 2]! - points[(corner - 1) * 2]!,
      points[corner * 2 + 1]! - points[(corner - 1) * 2 + 1]!,
    );
  }
  return Object.freeze({ points, lengths, reached, version });
}

/**
 * Where the player stands against the line: how far along it the nearest point
 * lies, and how far from it the player is. `from` is a length already walked;
 * the answer never goes back before it, so a line that passes near itself
 * cannot pull the player back to an earlier stretch.
 */
export function routeProgress(path: RoutePath, player: Point, from = 0): Readonly<{ along: number; away: number }> {
  let best = { along: Math.min(from, path.lengths.at(-1) ?? 0), away: Number.POSITIVE_INFINITY };
  for (let corner = 1; corner < path.lengths.length; corner += 1) {
    if (path.lengths[corner]! < from) continue;
    const ax = path.points[(corner - 1) * 2]!, ay = path.points[(corner - 1) * 2 + 1]!;
    const dx = path.points[corner * 2]! - ax, dy = path.points[corner * 2 + 1]! - ay;
    const length = path.lengths[corner]! - path.lengths[corner - 1]!;
    let t = length === 0 ? 0 : ((player.x - ax) * dx + (player.y - ay) * dy) / (length * length);
    t = Math.min(1, Math.max(0, t));
    const along = Math.max(from, path.lengths[corner - 1]! + t * length);
    const away = Math.hypot(ax + dx * t - player.x, ay + dy * t - player.y);
    if (away < best.away) best = { along, away };
  }
  return Object.freeze(best);
}

/** The rest of the line from `along` onward, as x, y per corner. */
export function routeFrom(path: RoutePath, along: number): Float32Array {
  const count = path.lengths.length;
  const total = path.lengths[count - 1] ?? 0;
  if (count < 2 || along <= 0) return path.points;
  if (along >= total) return path.points.slice((count - 1) * 2);
  let corner = 1;
  while (corner < count - 1 && path.lengths[corner]! <= along) corner += 1;
  const start = path.lengths[corner - 1]!;
  const length = path.lengths[corner]! - start;
  const t = length === 0 ? 0 : (along - start) / length;
  const ax = path.points[(corner - 1) * 2]!, ay = path.points[(corner - 1) * 2 + 1]!;
  const rest = path.points.slice(corner * 2);
  const points = new Float32Array(rest.length + 2);
  points[0] = ax + (path.points[corner * 2]! - ax) * t;
  points[1] = ay + (path.points[corner * 2 + 1]! - ay) * t;
  points.set(rest, 2);
  return points;
}

/** What a frame draws: the line, and how far along it the player has walked. */
export type RouteView = Readonly<{ path: RoutePath; along: number }>;

function sameLine(a: RoutePath, points: Float32Array, reached: boolean): boolean {
  return a.reached === reached && a.points.length === points.length && a.points.every((value, index) => value === points[index]);
}

/**
 * Keeps one route current for one target. It searches when the target changes
 * (a new point, or the next area), when the player strays from the line, and on
 * a slow refresh; never more often than ROUTE_MIN_SEARCH_MS. Between searches it
 * only measures progress, which costs no kernel work. A refresh that finds the
 * same line keeps its version, so no surface repaints for it.
 */
export function createRouteTracker(search: (target: RouteTarget) => CartographyRoute | null) {
  let key = "";
  let path: RoutePath | null = null;
  let along = 0;
  let version = 0;
  let searchedAt = Number.NEGATIVE_INFINITY;
  let failedAt = Number.NEGATIVE_INFINITY;
  const reset = (): void => {
    key = ""; path = null; along = 0;
    searchedAt = Number.NEGATIVE_INFINITY; failedAt = Number.NEGATIVE_INFINITY;
  };
  return Object.freeze({
    update(input: Readonly<{ now: number; target: RouteTarget | null; player: Point }>): RouteView | null {
      const { target } = input;
      if (target === null) { reset(); return null; }
      const nextKey = `${target.mapId}:${target.areaEpoch}:${target.x}:${target.y}`;
      if (nextKey !== key) { reset(); key = nextKey; }
      const progress = path === null ? null : routeProgress(path, input.player, along);
      const due = path === null
        ? input.now - failedAt >= ROUTE_RETRY_MS
        : progress!.away > ROUTE_STRAY_UNITS || input.now - searchedAt >= ROUTE_REFRESH_MS;
      if (due && input.now - searchedAt >= ROUTE_MIN_SEARCH_MS) {
        searchedAt = input.now;
        const route = search(target);
        // The kernel reads the live game, which may already be in another area.
        if (route === null || route.mapId !== target.mapId || route.areaEpoch !== target.areaEpoch) {
          path = null; along = 0; failedAt = input.now;
          return null;
        }
        const points = pullRoute(route);
        if (path === null || !sameLine(path, points, route.reached)) {
          version += 1;
          path = routePath(points, route.reached, version);
        }
        along = routeProgress(path, input.player).along;
        return Object.freeze({ path, along });
      }
      if (path === null || progress === null) return null;
      along = progress.along;
      return Object.freeze({ path, along });
    },
  });
}
