/**
 * The one timed notice of a tools window: `show` replaces the notice and starts its timer,
 * `lasts` says how long a notice stays (null: until it is dismissed or replaced), and the timer
 * stops with the window. The Build Library, Trade and the Elite planner each keep their own
 * notice shape and markup; this owns only the timing.
 */
import { getCurrentScope, onScopeDispose, ref, type Ref } from "vue";

export function useNotice<T>(lasts: (notice: T) => number | null) {
  const notice = ref(null) as Ref<T | null>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function show(next: T) {
    clearTimeout(timer);
    notice.value = next;
    const ms = lasts(next);
    timer = ms === null ? undefined : setTimeout(() => { notice.value = null; }, ms);
  }
  function dismiss() {
    clearTimeout(timer);
    notice.value = null;
  }
  if (getCurrentScope()) onScopeDispose(() => clearTimeout(timer));
  return { notice, show, dismiss };
}
