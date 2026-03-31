import { STORAGE_KEY_RENAMES, STORAGE_KEY_SETTINGS } from './constants'

export interface TabRenameEntry {
  customTitle: string      // full display title (emoji + text)
  emoji: string            // emoji prefix, empty string if none
  originalTitle: string    // captured at rename time, used for reset
  matchMode: 'exact' | 'domain'
  url: string              // normalized: exact URL path or domain hostname
  createdAt: number
  updatedAt: number
}

export interface StorageSchema {
  renames: Record<string, TabRenameEntry>
  settings: {
    hotkey: string
  }
}

// Normalize a full URL into a storage key based on matchMode.
// exact: strips query string and fragment, keeps scheme + host + path
// domain: hostname only (e.g. "github.com")
export function normalizeUrl(rawUrl: string, matchMode: 'exact' | 'domain'): string {
  try {
    const u = new URL(rawUrl)
    if (matchMode === 'domain') {
      return u.hostname
    }
    // exact: scheme + hostname + port + pathname, no trailing slash (except root)
    const path = u.pathname.replace(/\/$/, '') || '/'
    return `${u.protocol}//${u.host}${path}`
  } catch {
    return rawUrl
  }
}

// Look up a saved rename for a given URL.
// Exact match takes priority over domain match.
export async function getRenameForUrl(rawUrl: string): Promise<{ key: string; entry: TabRenameEntry } | null> {
  const data = await chrome.storage.local.get(STORAGE_KEY_RENAMES)
  const renames: Record<string, TabRenameEntry> = data[STORAGE_KEY_RENAMES] ?? {}

  const exactKey = normalizeUrl(rawUrl, 'exact')
  if (renames[exactKey]) {
    return { key: exactKey, entry: renames[exactKey] }
  }

  const domainKey = normalizeUrl(rawUrl, 'domain')
  if (renames[domainKey]) {
    return { key: domainKey, entry: renames[domainKey] }
  }

  return null
}

export async function getAllRenames(): Promise<Record<string, TabRenameEntry>> {
  const data = await chrome.storage.local.get(STORAGE_KEY_RENAMES)
  return data[STORAGE_KEY_RENAMES] ?? {}
}

export async function saveRename(entry: TabRenameEntry): Promise<void> {
  const key = normalizeUrl(entry.url, entry.matchMode)
  const data = await chrome.storage.local.get(STORAGE_KEY_RENAMES)
  const renames: Record<string, TabRenameEntry> = data[STORAGE_KEY_RENAMES] ?? {}
  renames[key] = { ...entry, url: key }
  await chrome.storage.local.set({ [STORAGE_KEY_RENAMES]: renames })
}

export async function deleteRename(key: string): Promise<void> {
  const data = await chrome.storage.local.get(STORAGE_KEY_RENAMES)
  const renames: Record<string, TabRenameEntry> = data[STORAGE_KEY_RENAMES] ?? {}
  delete renames[key]
  await chrome.storage.local.set({ [STORAGE_KEY_RENAMES]: renames })
}

export async function getSettings(): Promise<StorageSchema['settings']> {
  const data = await chrome.storage.local.get(STORAGE_KEY_SETTINGS)
  return data[STORAGE_KEY_SETTINGS] ?? { hotkey: 'Alt+R' }
}
