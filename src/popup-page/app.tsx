import { useCallback, useEffect, useState } from 'react'
import { Pencil, ArrowRight, X } from 'lucide-react'
import type { Message } from '@/shared/messages'
import type { TabRenameEntry } from '@/shared/storage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export function App() {
  const [renames, setRenames] = useState<Record<string, TabRenameEntry>>({})
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadRenames().then((data) => {
      setRenames(data)
      setLoaded(true)
    })
  }, [])

  const handleTriggerRename = useCallback(async () => {
    try {
      const msg: Message = { type: 'TRIGGER_RENAME_IN_ACTIVE_TAB' }
      await chrome.runtime.sendMessage(msg)
      window.close()
    } catch {
      setError('Could not open rename dialog on this page.')
    }
  }, [])

  const handleDelete = useCallback(
    async (key: string) => {
      const msg: Message = { type: 'DELETE_RENAME', key }
      await chrome.runtime.sendMessage(msg)
      setRenames((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [],
  )

  const handleGoToTab = useCallback(async (url: string) => {
    const msg: Message = { type: 'FOCUS_TAB_BY_URL', url }
    await chrome.runtime.sendMessage(msg)
    window.close()
  }, [])

  if (!loaded) return null

  const entries = Object.entries(renames)

  return (
    <div className="flex h-full w-[400px] flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <span className="text-lg">🗂</span>
        <h1 className="flex-1 text-sm font-semibold">Tab Organizer</h1>
        <Button size="sm" onClick={handleTriggerRename} title="Open rename dialog for the current tab">
          <Pencil className="size-3.5" />
          Rename Tab
        </Button>
      </header>

      {error && (
        <div className="mx-4 mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-muted-foreground">
          <span className="text-3xl opacity-50">🏷</span>
          <p className="text-sm">
            No renamed tabs yet.
            <br />
            Press <strong>Alt+R</strong> on any tab to start.
          </p>
        </div>
      ) : (
        <>
          <div className="px-4 pt-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Saved renames ({entries.length})
          </div>
          <ScrollArea className="flex-1 px-2 pb-2">
            <div className="space-y-0.5">
              {entries.map(([key, entry]) => (
                <RenameItem
                  key={key}
                  entryKey={key}
                  entry={entry}
                  onDelete={handleDelete}
                  onGoToTab={handleGoToTab}
                />
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  )
}

function RenameItem({
  entryKey,
  entry,
  onDelete,
  onGoToTab,
}: {
  entryKey: string
  entry: TabRenameEntry
  onDelete: (key: string) => void
  onGoToTab: (url: string) => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[13px] font-medium"
          title={entry.customTitle}
        >
          {entry.customTitle}
        </div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
            {entry.matchMode === 'domain' ? 'domain' : 'url'}
          </Badge>
          <span className="truncate">{entry.url}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          title="Go to this tab"
          onClick={() => onGoToTab(entry.url)}
        >
          <ArrowRight />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          title="Remove this rename"
          onClick={() => onDelete(entryKey)}
          className="hover:border-destructive hover:text-destructive"
        >
          <X />
        </Button>
      </div>
    </div>
  )
}

async function loadRenames(): Promise<Record<string, TabRenameEntry>> {
  try {
    const msg: Message = { type: 'GET_ALL_RENAMES' }
    const response = await chrome.runtime.sendMessage<Message, Message>(msg)
    if (response?.type === 'ALL_RENAMES_RESPONSE') return response.renames
  } catch { /* fall through */ }
  return {}
}
