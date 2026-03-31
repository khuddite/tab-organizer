import type { TabRenameEntry } from './storage'

export type Message =
  // Background → Content script: open the rename popup
  | { type: 'OPEN_RENAME_POPUP' }

  // Content script → Background: request saved entry for current URL
  | { type: 'GET_RENAME_FOR_URL'; url: string }

  // Background → Content script: response with saved entry (or null)
  | { type: 'RENAME_DATA_RESPONSE'; entry: TabRenameEntry | null; originalTitle: string }

  // Content script → Background: user submitted rename (tabId resolved from sender)
  | { type: 'RENAME_TAB'; url: string; entry: TabRenameEntry }

  // Content script → Background: user clicked reset (tabId resolved from sender)
  | { type: 'RESET_TAB'; url: string }

  // Popup page → Background: request full list of saved renames
  | { type: 'GET_ALL_RENAMES' }

  // Background → Popup page: response with all entries
  | { type: 'ALL_RENAMES_RESPONSE'; renames: Record<string, TabRenameEntry> }

  // Popup page → Background: delete a saved entry
  | { type: 'DELETE_RENAME'; key: string }

  // Popup page → Background: focus or open tab by URL
  | { type: 'FOCUS_TAB_BY_URL'; url: string }

  // Popup page → Background: trigger rename popup in active tab
  | { type: 'TRIGGER_RENAME_IN_ACTIVE_TAB' }
