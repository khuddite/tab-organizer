import { BADGE_COLOR, BADGE_TEXT } from '../shared/constants';
import type { Message } from '../shared/messages';
import {
  deleteRename,
  getAllRenames,
  getRenameForUrl,
  saveRename,
} from '../shared/storage';

// ─── Badge ───────────────────────────────────────────────────────────────────

async function updateBadgeForTab(tabId: number, url: string): Promise<void> {
  const match = await getRenameForUrl(url);
  if (match) {
    await chrome.action.setBadgeText({ text: BADGE_TEXT, tabId });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId });
  } else {
    await chrome.action.setBadgeText({ text: '', tabId });
  }
}

// ─── Tab event listeners (keep badge in sync) ────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) await updateBadgeForTab(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    await updateBadgeForTab(tabId, tab.url);
  }
});

// ─── Hotkey command ──────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-rename-popup') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) sendOpenPopup(tab.id);
});

// ─── Message hub ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    // Return true to keep the message channel open for async responses
    return true;
  },
);

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<void> {
  switch (message.type) {
    case 'TRIGGER_RENAME_IN_ACTIVE_TAB': {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) sendOpenPopup(tab.id);
      sendResponse();
      break;
    }

    case 'GET_RENAME_FOR_URL': {
      const match = await getRenameForUrl(message.url);
      // Capture original title from the active tab if no saved entry exists
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const originalTitle = match?.entry.originalTitle ?? tab?.title ?? '';
      const response: Message = {
        type: 'RENAME_DATA_RESPONSE',
        entry: match?.entry ?? null,
        originalTitle,
      };
      sendResponse(response);
      break;
    }

    case 'RENAME_TAB': {
      const renameTabId = sender.tab?.id;
      await saveRename(message.entry);
      if (renameTabId) {
        await chrome.scripting
          .executeScript({
            target: { tabId: renameTabId },
            func: (title: string) => {
              document.title = title;
            },
            args: [message.entry.customTitle],
          })
          .catch(() => {
            /* tab may not support scripting */
          });
        await updateBadgeForTab(renameTabId, message.url);
      }
      sendResponse();
      break;
    }

    case 'RESET_TAB': {
      const resetTabId = sender.tab?.id;
      const match = await getRenameForUrl(message.url);
      if (match) {
        const originalTitle = match.entry.originalTitle;
        await deleteRename(match.key);
        if (resetTabId) {
          await chrome.scripting
            .executeScript({
              target: { tabId: resetTabId },
              func: (title: string) => {
                document.title = title;
              },
              args: [originalTitle],
            })
            .catch(() => {
              /* tab may not support scripting */
            });
          await updateBadgeForTab(resetTabId, message.url);
        }
      }
      sendResponse();
      break;
    }

    case 'GET_ALL_RENAMES': {
      const renames = await getAllRenames();
      const response: Message = { type: 'ALL_RENAMES_RESPONSE', renames };
      sendResponse(response);
      break;
    }

    case 'DELETE_RENAME': {
      await deleteRename(message.key);
      // Clear badge on any tab matching this key
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          await updateBadgeForTab(tab.id, tab.url);
        }
      }
      sendResponse();
      break;
    }

    case 'FOCUS_TAB_BY_URL': {
      const tabs = await chrome.tabs.query({});
      const match = tabs.find(
        (t) => t.url?.startsWith(message.url) || t.url === message.url,
      );
      if (match?.id && match.windowId) {
        await chrome.tabs.update(match.id, { active: true });
        await chrome.windows.update(match.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: message.url });
      }
      sendResponse();
      break;
    }

    default:
      sendResponse();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendOpenPopup(tabId: number): void {
  const msg: Message = { type: 'OPEN_RENAME_POPUP' };
  chrome.tabs.sendMessage(tabId, msg).catch(() => {
    // Content script not available on this page (e.g. chrome://)
  });
}
