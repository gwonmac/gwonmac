/**
 * Minimal game-start fallback owned by the game renderer, and the screen that
 * replaces the game when the client stops: its copy and its Reload Game and
 * Quit buttons. Client preparation, updates, repair, and recovery live in the
 * launcher.
 */
window.gwAutomation = (function (): EnhancementAutomation {
  let stage = 'renderer.loading';
  let sequence = 0;
  const history: { sequence: number; stage: string; atMs: number }[] = [];
  return Object.freeze({
    set(next: string) {
      if (typeof next !== 'string' || next === stage) return;
      stage = next;
      sequence += 1;
      history.push({ sequence, stage, atMs: performance.now() });
      if (history.length > 32) history.shift();
    },
    read() {
      const enhancement = window.gwCompanionState;
      return Object.freeze({ stage, sequence, transitions: history.slice(), enhancementStatus: enhancement?.status ?? 'not-installed', tickCount: enhancement && 'tickCount' in enhancement ? enhancement.tickCount : 0 });
    },
  });
})();

window.gwLoading = (function (): LoadingController {
  const required = (id: string): HTMLElement => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`missing renderer element: ${id}`);
    return element;
  };
  const root = required('loading');
  const label = required('loading-label');
  const detail = required('loading-detail');
  const actions = required('loading-actions');
  const reloadButton = required('loading-reload') as HTMLButtonElement;
  const quitButton = required('loading-quit') as HTMLButtonElement;
  const crashDetail = required('loading-crash-detail') as HTMLDetailsElement;
  const crashText = required('loading-crash-text');
  // done() ran: the player was in the game, so a crash interrupts play.
  let started = false;
  const showFailure = (text: string, explanation: string, offerReload = false): void => {
    root.classList.add('failed');
    root.classList.remove('gone');
    // done() hid the element outright once the game started; a crash after
    // that point must still reach the player.
    root.style.display = '';
    label.textContent = text;
    detail.textContent = explanation;
    actions.hidden = !offerReload;
  };
  // Both buttons use main's own paths: Reload Game is the account-local reload
  // that honours the saved "return to my character" choice; Quit closes this game.
  const act = (run: () => Promise<void>): void => {
    reloadButton.disabled = true;
    quitButton.disabled = true;
    run().catch(() => {
      reloadButton.disabled = false;
      quitButton.disabled = false;
    });
  };
  reloadButton.addEventListener('click', () => act(() => window.gwNative.app.reloadGame('crash-retry')));
  quitButton.addEventListener('click', () => act(() => window.gwNative.app.requestQuit()));
  const api: LoadingController = {
    set(text, _fraction, explanation) { label.textContent = text; detail.textContent = explanation || ''; },
    fail(text, explanation) { showFailure(text, explanation ?? 'Close this window and try this account again from the launcher.'); },
    failFilesystem() { showFailure('Saved game files could not be opened.', 'Close this window and reset this account’s game storage from the launcher.'); },
    failCrash(_crashCount, technicalDetail) {
      // The repeat-crash call follows the first within moments; it must not
      // pull the keyboard off a button the player already moved to.
      const firstShow = actions.hidden;
      if (started) showFailure('Guild Wars stopped.', 'Reload the game to play on.', true);
      else showFailure('Guild Wars stopped before it was ready.', 'Reload the game to try again.', true);
      if (technicalDetail !== undefined) crashText.textContent = technicalDetail;
      crashDetail.hidden = !crashText.textContent;
      if (firstShow) reloadButton.focus();
    },
    covering() { return !root.classList.contains('gone'); },
    done() {
      if (root.classList.contains('gone')) return;
      started = true;
      root.classList.add('gone');
      setTimeout(() => {
        if (root.classList.contains('gone')) root.style.display = 'none';
      }, 220);
      required('canvas').focus();
    },
    async waitForClient() { return true; },
  };
  return api;
})();
