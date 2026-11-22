/**
 * Shared drag, resize, and viewport fitting for independent in-game windows. An embedded window
 * keeps where the player put it in a placement store, its Feature's setting (Trade Chat,
 * Whispers); without one, a move lasts until the view goes.
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import { installResizeGrip } from "../../../shared/ui/resize";
import {
  captureFloatingWindowPlacement,
  placeFloatingWindow,
  type FloatingWindowPlacement,
  type FloatingWindowPlacementStore,
} from "../../../shared/ui/window-placement";

export function useFloatingWindow(options: {
  mode: "standalone" | "embedded";
  visible: Ref<boolean>;
  initialPosition: { left: number; top: number };
  minWidth: number;
  minHeight: number;
  viewportMargin?: number;
  /** Where an embedded window keeps its placement. */
  placement?: FloatingWindowPlacementStore | undefined;
  /** A window the never-placed panel opens beside rather than over, when there is room. */
  beside?: () => DOMRect | null;
}) {
  const panel = ref<HTMLElement | null>(null);
  const resizeGrip = ref<HTMLButtonElement | null>(null);
  const margin = options.viewportMargin ?? 0;
  const store = options.mode !== "embedded" ? null : options.placement ?? null;
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight, margin });
  const minimum = { width: options.minWidth, height: options.minHeight };
  const position = ref({ ...options.initialPosition });
  const size = ref<{ width: number; height: number } | null>(null);
  /**
   * Where the player last put the window, normalized to the viewport. A resize derives the box
   * from it and only the player's own moves are saved, so a window that shrinks and grows back
   * returns the panel to that place and size (HUB-109).
   */
  let intent: FloatingWindowPlacement | null = null;
  /** The placement the store holds, so an unmoved window saves nothing. */
  let saved: FloatingWindowPlacement | null = null;
  /** Placements this window saved that the store has not given back yet, oldest first. */
  const unanswered: string[] = [];
  /** True while the player drags or resizes the window. */
  let adjusting = false;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let mounted = false;
  // A placement from the store (at once, or later: a Reset, another game window's move) replaces
  // this one. The store giving back this window's own saves, or anything while the player is
  // still placing it, changes nothing: an older save must not rewind a newer move or size.
  const stopStore = store?.subscribe((placement) => {
    const text = JSON.stringify(placement);
    const echo = unanswered.indexOf(text);
    if (echo !== -1) {
      unanswered.splice(0, echo + 1);
      return;
    }
    if (adjusting || persistTimer !== null || text === JSON.stringify(intent)) return;
    const box = placeFloatingWindow(placement, viewport(), minimum);
    intent = saved = box ? placement : null;
    position.value = box ? { left: box.left, top: box.top } : { ...options.initialPosition };
    size.value = box ? { width: box.width, height: box.height } : null;
    if (mounted) fit();
  });
  const panelStyle = computed(() => options.mode === "embedded"
    ? {
        left: `${position.value.left}px`,
        top: `${position.value.top}px`,
        ...(size.value
          ? { width: `${size.value.width}px`, height: `${size.value.height}px` }
          : {}),
      }
    : undefined);

  const fitToViewport = async () => {
    if (options.mode !== "embedded" || !panel.value) return;
    const placed = placeFloatingWindow(intent, viewport(), minimum);
    if (placed) {
      position.value = { left: placed.left, top: placed.top };
      size.value = { width: placed.width, height: placed.height };
      return;
    }
    // Never placed: the default position and natural size, squeezed only while the viewport is smaller.
    if (size.value) {
      size.value = null;
      await nextTick();
      if (!panel.value) return;
    }
    const availableWidth = Math.max(0, window.innerWidth - margin * 2);
    const availableHeight = Math.max(0, window.innerHeight - margin * 2);
    const width = Math.min(panel.value.offsetWidth, availableWidth);
    const height = Math.min(panel.value.offsetHeight, availableHeight);
    if (width !== panel.value.offsetWidth || height !== panel.value.offsetHeight) {
      size.value = { width, height };
    }
    const preferred = besidePosition(width) ?? options.initialPosition;
    position.value = {
      left: Math.max(margin, Math.min(window.innerWidth - width - margin, preferred.left)),
      top: Math.max(margin, Math.min(window.innerHeight - height - margin, preferred.top)),
    };
  };
  /** Right of the other window, else left of it, top-aligned; null when neither side has room. */
  const besidePosition = (width: number): { left: number; top: number } | null => {
    const other = options.beside?.();
    if (!other) return null;
    const gap = Math.max(margin, 8);
    if (other.right + gap + width <= window.innerWidth - margin) return { left: other.right + gap, top: other.top };
    if (other.left - gap - width >= margin) return { left: other.left - gap - width, top: other.top };
    return null;
  };

  const fit = () => { void fitToViewport(); };

  const startDrag = (event: PointerEvent) => {
    if (event.button !== 0 || options.mode !== "embedded" || !panel.value) return;
    if ((event.target as Element).closest("button, input, select, textarea, a, summary, label")) return;
    const element = panel.value;
    const handle = event.currentTarget as HTMLElement;
    const box = element.getBoundingClientRect();
    const offsetX = event.clientX - box.left;
    const offsetY = event.clientY - box.top;
    handle.setPointerCapture(event.pointerId);
    element.dataset.dragging = "";
    adjusting = true;
    const move = (next: PointerEvent) => {
      position.value = {
        left: Math.max(margin, Math.min(
          window.innerWidth - element.offsetWidth - margin,
          next.clientX - offsetX,
        )),
        top: Math.max(margin, Math.min(
          window.innerHeight - element.offsetHeight - margin,
          next.clientY - offsetY,
        )),
      };
    };
    const finish = () => {
      delete element.dataset.dragging;
      adjusting = false;
      remember();
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      handle.removeEventListener("lostpointercapture", finish);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", finish);
  };

  let disposeResize: (() => void) | null = null;
  const persistPlacement = () => {
    if (!store || intent === null || intent === saved) return;
    saved = intent;
    // A store that never gives saves back keeps this list short.
    unanswered.push(JSON.stringify(intent));
    if (unanswered.length > 8) unanswered.shift();
    store.save(intent);
  };
  const schedulePersistence = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistPlacement();
    }, 150);
  };
  /** The player moved or resized the window: that box is the placement to keep. */
  function remember() {
    if (!panel.value) return;
    intent = captureFloatingWindowPlacement({
      ...position.value,
      width: size.value?.width ?? panel.value.offsetWidth,
      height: size.value?.height ?? panel.value.offsetHeight,
    }, viewport()) ?? intent;
    if (store) schedulePersistence();
  }
  onMounted(() => {
    mounted = true;
    window.addEventListener("resize", fit);
    if (store) window.addEventListener("pagehide", persistPlacement);
    requestAnimationFrame(fit);
    if (options.mode !== "embedded" || !panel.value || !resizeGrip.value) return;
    disposeResize = installResizeGrip(resizeGrip.value, {
      size: () => {
        const box = panel.value!.getBoundingClientRect();
        return { width: box.width, height: box.height };
      },
      limits: () => ({
        minWidth: Math.min(options.minWidth, window.innerWidth - position.value.left - margin),
        minHeight: Math.min(options.minHeight, window.innerHeight - position.value.top - margin),
        maxWidth: window.innerWidth - position.value.left - margin,
        maxHeight: window.innerHeight - position.value.top - margin,
      }),
      resize: (width, height) => { size.value = { width, height }; remember(); },
      setActive: (active) => {
        adjusting = active;
        if (!panel.value) return;
        if (active) panel.value.dataset.resizing = "";
        else delete panel.value.dataset.resizing;
      },
    });
  });
  onBeforeUnmount(() => {
    window.removeEventListener("resize", fit);
    if (store) {
      window.removeEventListener("pagehide", persistPlacement);
      if (persistTimer) clearTimeout(persistTimer);
      persistPlacement();
      stopStore?.();
    }
    disposeResize?.();
  });
  watch(options.visible, (visible) => {
    if (visible) requestAnimationFrame(fit);
  });

  return { panel, resizeGrip, panelStyle, startDrag, fitToViewport };
}
