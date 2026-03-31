import { applyTitleFromStorage } from './title-applier'
import type { Message } from '../shared/messages'

// Apply saved title immediately (document_start)
applyTitleFromStorage()

// Listen for commands from the background service worker
chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'OPEN_RENAME_POPUP') {
    // Lazy-import the popup to keep the initial content script bundle small
    import('./popup').then(({ openRenamePopup }) => {
      openRenamePopup()
    })
  }
})
