/**
 * Stops a verifier child for good. A polite stop (SIGTERM) is enough for a
 * healthy child, but a parser stuck in a synchronous loop never runs the
 * handler that would let it exit, and would keep a core busy after its pass
 * has been given up. So a child still alive after the grace period is killed.
 */

/** The part of a child process this needs; Electron's utility process and Node's child both fit. */
export interface StoppableChild {
  readonly pid?: number | undefined;
  kill(): boolean;
  once(event: "exit", listener: () => void): unknown;
}

export const VERIFIER_STOP_GRACE_MS = 5_000;

/**
 * Watch `child` from the moment it is spawned and return its stop. Watching
 * from the start matters: a child that already exited is never signalled, so
 * a reused process id is never killed.
 */
export function stoppableVerifierChild(
  child: StoppableChild,
  graceMs: number = VERIFIER_STOP_GRACE_MS,
): () => void {
  let exited = false;
  child.once("exit", () => { exited = true; });
  return () => {
    if (exited) return;
    child.kill();
    const pid = child.pid;
    if (pid === undefined) return;
    const timer = setTimeout(() => {
      if (exited) return;
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // It exited between the check and the signal.
      }
    }, graceMs);
    // The kill must never be what keeps the app from quitting.
    timer.unref();
  };
}
