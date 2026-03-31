import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { Message } from '@/shared/messages';
import type { TabRenameEntry } from '@/shared/storage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function App() {
  const [renames, setRenames] = useState<Record<string, TabRenameEntry>>({});
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadRenames().then((data) => {
      setRenames(data);
      setLoaded(true);
    });
  }, []);

  async function handleTriggerRename() {
    try {
      const msg: Message = { type: 'TRIGGER_RENAME_IN_ACTIVE_TAB' };
      await chrome.runtime.sendMessage(msg);
      window.close();
    } catch {
      setError('Could not open rename dialog on this page.');
    }
  }

  async function handleDelete(key: string) {
    const msg: Message = { type: 'DELETE_RENAME', key };
    await chrome.runtime.sendMessage(msg);
    setRenames((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleGoToTab(url: string) {
    const msg: Message = { type: 'FOCUS_TAB_BY_URL', url };
    await chrome.runtime.sendMessage(msg);
    window.close();
  }

  if (!loaded) return null;

  const entries = Object.entries(renames);

  return (
    <div className="flex max-h-[500px] w-[400px] flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <span className="text-lg">🗂</span>
        <h1 className="flex-1 text-sm font-semibold">Tab Organizer</h1>
        <Button
          size="sm"
          onClick={handleTriggerRename}
          title="Open rename dialog for the current tab"
        >
          <Pencil className="size-3.5" />
          Rename Tab
        </Button>
      </header>

      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mx-4 mt-2 rounded-lg border px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <span className="text-3xl opacity-50">🏷</span>
          <p className="text-sm">
            No renamed tabs yet.
            <br />
            Press <strong>Alt+R</strong> on any tab to start.
          </p>
        </div>
      ) : (
        <>
          <div className="text-muted-foreground shrink-0 px-4 pt-2.5 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
            Saved renames ({entries.length})
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
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
          </div>
        </>
      )}
    </div>
  );
}

function RenameItem({
  entryKey,
  entry,
  onDelete,
  onGoToTab,
}: {
  entryKey: string;
  entry: TabRenameEntry;
  onDelete: (key: string) => void;
  onGoToTab: (url: string) => void;
}) {
  return (
    <div
      className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors"
      role="button"
      tabIndex={0}
      title="Go to this tab"
      onClick={() => onGoToTab(entry.url)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onGoToTab(entry.url);
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[13px] font-medium"
          title={entry.customTitle}
        >
          {entry.customTitle}
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-[11px]">
          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
            {entry.matchMode === 'domain' ? 'domain' : 'url'}
          </Badge>
          <span className="truncate">{entry.url}</span>
        </div>
      </div>
      <Button
        variant="outline"
        size="icon-xs"
        title="Remove this rename"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entryKey);
        }}
        className="hover:border-destructive hover:text-destructive shrink-0"
      >
        <X />
      </Button>
    </div>
  );
}

async function loadRenames(): Promise<Record<string, TabRenameEntry>> {
  try {
    const msg: Message = { type: 'GET_ALL_RENAMES' };
    const response = await chrome.runtime.sendMessage<Message, Message>(msg);
    if (response?.type === 'ALL_RENAMES_RESPONSE') return response.renames;
  } catch {
    /* fall through */
  }
  return {};
}
