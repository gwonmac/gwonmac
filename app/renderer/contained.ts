/**
 * Owns error containment for the renderer's direct-call fan-out: a loop that calls each part,
 * listener or session in turn. DOM events already keep one listener's throw from the next one;
 * a plain loop does not, so one throw would skip every later entry, teardown included.
 */

/**
 * Runs `run` and answers whether it finished. A throw is logged as one line that names only the
 * fixed `label` ("the X …"), never the error: a message can carry paths or game values.
 */
export function safely(label: string, run: () => void): boolean {
  try {
    run();
    return true;
  } catch {
    console.error(`[err] ${label} failed`);
    return false;
  }
}
