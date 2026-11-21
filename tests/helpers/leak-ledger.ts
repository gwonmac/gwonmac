/**
 * Records what code under test takes from its environment and has not given back: timers,
 * intervals, animation frames, event listeners, observers, and anything a test hands out
 * itself (a bridge subscription, a Hub source). Each entry keeps the app frames of the stack
 * that took it, so a leak names the file that leaked.
 *
 * Used by the "stop leaves nothing" tests (plan step 4.2): the main-process parts in
 * tests/unit and the renderer parts in app/ui/tools, which has the DOM.
 */
export type Leak = Readonly<{ kind: string; what: string; where: string }>;

type Timers = Readonly<{
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
}>;

type Observed = new (...args: never[]) => { observe(...args: never[]): void; disconnect(): void };

/** The globals the ledger watches; leave out what the environment does not have. */
export type LeakScope = Readonly<{
  /** Where code reads its timers from: globalThis, and the window when it is another object. */
  timers: readonly object[];
  /** Objects whose listeners the ledger counts: it patches the prototype each inherits `addEventListener` from. */
  eventTargets?: readonly EventTarget[];
  /** Animation frames run on the ledger's own timers, so they count as soon as they are asked for. */
  animationFrames?: readonly object[];
  /** Observer classes to replace by counting ones, by global name, on each object. */
  observers?: Readonly<{ owners: readonly object[]; names: readonly string[] }>;
  /** A listener whose target is a removed node is garbage; this says which targets still fire. */
  reachable?: (target: EventTarget) => boolean;
  describe?: (target: EventTarget) => string;
}>;

const where = () => (new Error().stack ?? "").split("\n").slice(3)
  .filter((line) => /\/app\/(features|renderer|main|shared)\//u.test(line) && !line.includes("leak-ledger"))
  .slice(0, 3).map((line) => line.trim().replace(/^at /u, "").replace(/\(?file:\/\/.*?\/app\//u, "app/").replace(/\)$/u, ""))
  .join(" ← ");

export function installLeakLedger(scope: LeakScope) {
  const live = new Map<unknown, Leak & { target?: EventTarget }>();
  const take = (key: unknown, kind: string, what: string, target?: EventTarget) => {
    live.set(key, { kind, what, where: where(), ...(target === undefined ? {} : { target }) });
  };
  const give = (key: unknown) => { live.delete(key); };
  const restore: (() => void)[] = [];
  const replace = (owner: object, name: string, value: unknown) => {
    const record = owner as Record<string, unknown>;
    const previous = record[name];
    record[name] = value;
    restore.push(() => { record[name] = previous; });
  };

  const node: Timers = {
    setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval,
    clearTimeout: globalThis.clearTimeout, clearInterval: globalThis.clearInterval,
  };
  const timers: Timers = {
    setTimeout: ((handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      const handle = node.setTimeout((...inner: unknown[]) => { give(handle); handler(...inner); }, delay, ...args);
      take(handle, "timer", `setTimeout ${delay ?? 0} ms`);
      return handle;
    }) as typeof setTimeout,
    setInterval: ((handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      const handle = node.setInterval(handler, delay, ...args);
      take(handle, "interval", `setInterval ${delay ?? 0} ms`);
      return handle;
    }) as typeof setInterval,
    clearTimeout: ((handle?: Parameters<typeof clearTimeout>[0]) => { give(handle); node.clearTimeout(handle); }) as typeof clearTimeout,
    clearInterval: ((handle?: Parameters<typeof clearInterval>[0]) => { give(handle); node.clearInterval(handle); }) as typeof clearInterval,
  };
  for (const owner of scope.timers) for (const [name, value] of Object.entries(timers)) replace(owner, name, value);

  let frame = 0;
  const frames = new Map<number, ReturnType<typeof setTimeout>>();
  for (const owner of scope.animationFrames ?? []) {
    replace(owner, "requestAnimationFrame", (callback: FrameRequestCallback) => {
      frame += 1;
      const id = frame;
      frames.set(id, node.setTimeout(() => { frames.delete(id); give(`frame ${id}`); callback(performance.now()); }, 16));
      take(`frame ${id}`, "animation frame", "requestAnimationFrame");
      return id;
    });
    replace(owner, "cancelAnimationFrame", (id: number) => {
      node.clearTimeout(frames.get(id));
      frames.delete(id);
      give(`frame ${id}`);
    });
  }

  const ids = new WeakMap<object, number>();
  let next = 0;
  const id = (value: object) => {
    let known = ids.get(value);
    if (known === undefined) { next += 1; known = next; ids.set(value, known); }
    return known;
  };
  const capture = (options: unknown) => typeof options === "boolean" ? options
    : typeof options === "object" && options !== null && "capture" in options && options.capture === true;
  const keyOf = (target: EventTarget, type: string, listener: object, options: unknown) =>
    `listener ${id(target)} ${type} ${id(listener)} ${capture(options)}`;
  const describe = scope.describe ?? ((target: EventTarget) => target.constructor.name);
  const patched = new Set<object>();
  for (const target of scope.eventTargets ?? []) {
    let prototype: object | null = target;
    while (prototype !== null && !Object.hasOwn(prototype, "addEventListener")) prototype = Object.getPrototypeOf(prototype);
    if (prototype === null || patched.has(prototype)) continue;
    patched.add(prototype);
    const owner = prototype as EventTarget;
    const add = owner.addEventListener;
    const remove = owner.removeEventListener;
    replace(owner, "addEventListener", function (this: EventTarget, type: string,
      listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
      add.call(this, type, listener, options);
      if (listener === null) return;
      const key = keyOf(this, type, listener, options);
      take(key, "listener", `${describe(this)} ${type}`, this);
      if (typeof options === "object" && options.signal) {
        add.call(options.signal, "abort", () => give(key), { once: true });
      }
    });
    replace(owner, "removeEventListener", function (this: EventTarget, type: string,
      listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
      remove.call(this, type, listener, options);
      if (listener !== null) give(keyOf(this, type, listener, options));
    });
  }

  for (const owner of scope.observers?.owners ?? []) {
    for (const name of scope.observers?.names ?? []) {
      const Base = (owner as Record<string, Observed | undefined>)[name];
      if (Base === undefined) continue;
      replace(owner, name, class extends Base {
        override observe(...args: never[]) { take(this, "observer", name); super.observe(...args); }
        override disconnect() { give(this); super.disconnect(); }
      });
    }
  }

  const reachable = scope.reachable ?? (() => true);
  return Object.freeze({
    take,
    give,
    /** What is held now; pass it to `since` after Stop. */
    mark: (): ReadonlySet<unknown> => new Set(live.keys()),
    /** What was taken after `mark` and is still held, minus listeners on targets that can no longer fire. */
    since(mark: ReadonlySet<unknown>): Leak[] {
      return [...live].filter(([key, entry]) => !mark.has(key) && (entry.target === undefined || reachable(entry.target)))
        .map(([, { kind, what, where: at }]) => ({ kind, what, where: at }));
    },
    uninstall() { for (const step of restore.reverse()) step(); live.clear(); },
  });
}

export type LeakLedger = ReturnType<typeof installLeakLedger>;
