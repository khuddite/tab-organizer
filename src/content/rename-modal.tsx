import { useEffect, useRef, useState } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';
import type { Message } from '@/shared/messages';
import type { TabRenameEntry } from '@/shared/storage';
import { normalizeUrl } from '@/shared/storage';
import { setAppliedTitle } from './title-applier';

interface RenameModalProps {
  savedEntry: TabRenameEntry | null;
  originalTitle: string;
  url: string;
  onClose: () => void;
}

export function RenameModal({
  savedEntry,
  originalTitle,
  url,
  onClose,
}: RenameModalProps) {
  const savedText = savedEntry
    ? savedEntry.emoji
      ? savedEntry.customTitle.replace(savedEntry.emoji, '').trim()
      : savedEntry.customTitle
    : document.title;

  const initialEmoji = savedEntry?.emoji ?? '';
  const initialMatchMode = savedEntry?.matchMode ?? 'exact';

  const [selectedEmoji, setSelectedEmoji] = useState(initialEmoji);
  const [matchMode, setMatchMode] = useState<'exact' | 'domain'>(
    initialMatchMode,
  );
  const [titleValue, setTitleValue] = useState(savedText);
  const [pickerVisible, setPickerVisible] = useState(false);

  const hasChange =
    titleValue !== savedText ||
    selectedEmoji !== initialEmoji ||
    matchMode !== initialMatchMode;

  const inputRef = useRef<HTMLInputElement>(null);
  const pickerWrapperRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSave() {
    const textPart = titleValue.trim();
    if (!textPart) return;

    const customTitle = selectedEmoji
      ? `${selectedEmoji} ${textPart}`
      : textPart;

    const entry: TabRenameEntry = {
      customTitle,
      emoji: selectedEmoji,
      originalTitle,
      matchMode,
      url: normalizeUrl(url, matchMode),
      createdAt: savedEntry?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    const msg: Message = { type: 'RENAME_TAB', url, entry };
    await chrome.runtime.sendMessage(msg);
    setAppliedTitle(customTitle);
    onClose();
  }

  async function handleReset() {
    setAppliedTitle(null);
    document.title = originalTitle;
    const msg: Message = { type: 'RESET_TAB', url };
    await chrome.runtime.sendMessage(msg);
    onClose();
  }

  function handleEmojiToggle() {
    setPickerVisible((v) => !v);
  }

  function handleEmojiSelect(emojiData: EmojiClickData) {
    setSelectedEmoji(emojiData.emoji);
    setPickerVisible(false);
    inputRef.current?.focus();
  }

  function handleEmojiClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedEmoji('');
    setPickerVisible(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    if (e.key === 'Enter' && e.target !== emojiBtnRef.current) {
      e.preventDefault();
      if (hasChange) handleSave();
      else onClose();
    }
    if (e.key === 'Tab') {
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'input, button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active =
        modal.getRootNode() instanceof ShadowRoot
          ? (modal.getRootNode() as ShadowRoot).activeElement
          : document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function blockEvent(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleModalClick(e: React.MouseEvent) {
    if (
      pickerVisible &&
      pickerWrapperRef.current &&
      !pickerWrapperRef.current.contains(e.target as Node) &&
      e.target !== emojiBtnRef.current
    ) {
      setPickerVisible(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex animate-[overlay-fade-in_0.15s_ease] items-center justify-center font-sans"
      onClick={handleOverlayClick}
      onMouseDown={blockEvent}
      onMouseUp={blockEvent}
      onDoubleClick={blockEvent}
      onContextMenu={blockEvent}
      onPointerDown={blockEvent}
      onPointerUp={blockEvent}
      onPointerMove={blockEvent}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Rename tab"
        className="border-border/60 bg-background text-foreground w-[480px] max-w-[calc(100vw-32px)] animate-[modal-slide-in_0.15s_ease] rounded-xl border p-5 shadow-[0_25px_70px_rgba(0,0,0,0.2),0_6px_20px_rgba(0,0,0,0.12)] ring-1 ring-black/5 dark:border-zinc-600 dark:shadow-[0_25px_70px_rgba(0,0,0,0.5),0_6px_20px_rgba(0,0,0,0.35)] dark:ring-zinc-600/20"
        onClick={handleModalClick}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-[15px] font-semibold">
            Rename Tab
          </h2>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="text-muted-foreground hover:bg-border hover:text-foreground cursor-pointer rounded-md border-none bg-transparent px-1.5 py-0.5 text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Input row */}
        <div className="relative mb-3 flex items-center gap-2">
          <div className="relative shrink-0">
            <button
              ref={emojiBtnRef}
              type="button"
              title={selectedEmoji ? 'Change emoji' : 'Add emoji prefix'}
              onClick={handleEmojiToggle}
              className={`bg-input hover:border-ring flex size-10 cursor-pointer items-center justify-center rounded-lg border text-xl transition-colors ${pickerVisible ? 'border-ring' : 'border-border'}`}
            >
              {selectedEmoji || '😀'}
            </button>
            {selectedEmoji && (
              <button
                type="button"
                title="Remove emoji"
                onClick={handleEmojiClear}
                className="border-border bg-background text-muted-foreground hover:border-destructive hover:bg-destructive absolute -top-1.5 -right-1.5 z-[1] flex size-[18px] cursor-pointer items-center justify-center rounded-full border text-[10px] leading-none shadow-sm transition-colors hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Tab title…"
            aria-label="Tab title"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            className="border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-ring h-10 flex-1 rounded-lg border px-3 text-sm transition-[border-color,box-shadow] outline-none focus:shadow-[0_0_0_3px_var(--color-ring)/15%]"
          />
          {pickerVisible && (
            <div
              ref={pickerWrapperRef}
              className="absolute top-[calc(100%+8px)] left-0 z-10"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiSelect}
                theme={Theme.AUTO}
                width={350}
                height={400}
                skinTonesDisabled
                searchPlaceholder="Search emoji…"
                lazyLoadEmojis
              />
            </div>
          )}
        </div>

        {/* Match mode */}
        <div className="bg-muted mb-4 flex gap-0.5 rounded-lg p-0.5">
          <button
            type="button"
            title="Apply to this exact URL only"
            onClick={() => setMatchMode('exact')}
            className={`flex-1 cursor-pointer rounded-md border-none px-3 py-1.5 text-center text-xs transition-all ${
              matchMode === 'exact'
                ? 'bg-background text-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground bg-transparent'
            }`}
          >
            This URL
          </button>
          <button
            type="button"
            title="Apply to all pages on this domain"
            onClick={() => setMatchMode('domain')}
            className={`flex-1 cursor-pointer rounded-md border-none px-3 py-1.5 text-center text-xs transition-all ${
              matchMode === 'domain'
                ? 'bg-background text-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground bg-transparent'
            }`}
          >
            All of {hostname}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasChange}
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 flex-1 cursor-pointer rounded-lg border-none text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            disabled={!savedEntry}
            onClick={handleReset}
            className="border-border text-muted-foreground hover:border-destructive hover:text-destructive h-9 cursor-pointer rounded-lg border bg-transparent px-3.5 text-[13px] whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            Restore original
          </button>
        </div>

        {/* Hint */}
        <p className="text-muted-foreground mt-3 text-center text-[11px]">
          Enter to save · Esc to close
        </p>
      </div>
    </div>
  );
}
