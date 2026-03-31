import type { Message } from '../shared/messages';

let appliedTitle: string | null = null;
let observer: MutationObserver | null = null;

// Apply the saved title for the current URL, then watch for changes.
export async function applyTitleFromStorage(): Promise<void> {
  const url = location.href;
  const msg: Message = { type: 'GET_RENAME_FOR_URL', url };

  try {
    const response = await chrome.runtime.sendMessage<Message, Message>(msg);
    if (response?.type === 'RENAME_DATA_RESPONSE' && response.entry) {
      appliedTitle = response.entry.customTitle;
      applyTitle();
      watchTitle();
    }
  } catch {
    // Extension context not ready yet — will retry via content script init
  }
}

function applyTitle(): void {
  if (appliedTitle && document.title !== appliedTitle) {
    document.title = appliedTitle;
  }
}

// MutationObserver on <title> prevents the page from overwriting our custom title.
function watchTitle(): void {
  if (observer) return;

  // Wait for <head> to be available (document_start may fire before <head> exists)
  const start = (): void => {
    const titleEl = document.querySelector('title');
    const target = titleEl?.parentElement ?? document.documentElement;

    observer = new MutationObserver(() => {
      applyTitle();
    });

    observer.observe(target, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

// Re-run lookup when the URL changes (SPA navigation via pushState/replaceState).
function handleUrlChange(): void {
  const newUrl = location.href;
  if (newUrl === lastUrl) return;
  lastUrl = newUrl;

  // Disconnect old observer, reset state
  observer?.disconnect();
  observer = null;
  appliedTitle = null;

  applyTitleFromStorage();
}

let lastUrl = location.href;

window.addEventListener('popstate', handleUrlChange);
window.addEventListener('hashchange', handleUrlChange);

// Patch history methods to catch pushState/replaceState (SPA navigation)
const originalPushState = history.pushState.bind(history);
const originalReplaceState = history.replaceState.bind(history);

history.pushState = function (...args) {
  originalPushState(...args);
  handleUrlChange();
};

history.replaceState = function (...args) {
  originalReplaceState(...args);
  handleUrlChange();
};

export function setAppliedTitle(title: string | null): void {
  appliedTitle = title;
  if (title) {
    applyTitle();
    watchTitle();
  } else {
    observer?.disconnect();
    observer = null;
  }
}
