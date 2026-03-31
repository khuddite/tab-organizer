import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message } from '@/shared/messages'
import type { TabRenameEntry } from '@/shared/storage'
import { normalizeUrl } from '@/shared/storage'
import { setAppliedTitle } from './title-applier'

interface RenameModalProps {
  savedEntry: TabRenameEntry | null
  originalTitle: string
  url: string
  onClose: () => void
}

export function RenameModal({ savedEntry, originalTitle, url, onClose }: RenameModalProps) {
  const savedText = savedEntry
    ? savedEntry.emoji
      ? savedEntry.customTitle.replace(savedEntry.emoji, '').trim()
      : savedEntry.customTitle
    : document.title

  const [selectedEmoji, setSelectedEmoji] = useState(savedEntry?.emoji ?? '')
  const [matchMode, setMatchMode] = useState<'exact' | 'domain'>(savedEntry?.matchMode ?? 'exact')
  const [titleValue, setTitleValue] = useState(
    selectedEmoji ? `${savedEntry?.emoji ?? ''} ${savedText}` : savedText,
  )
  const [pickerVisible, setPickerVisible] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const pickerWrapperRef = useRef<HTMLDivElement>(null)
  const pickerMountedRef = useRef(false)
  const emojiBtnRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {
    hostname = url
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSave = useCallback(async () => {
    const rawText = titleValue.trim()
    if (!rawText) return

    const parts = rawText.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s+(.*)/u)
    const emoji = parts ? parts[1] : selectedEmoji
    const textPart = parts ? parts[2] : selectedEmoji ? rawText.replace(selectedEmoji, '').trim() : rawText
    const customTitle = emoji ? `${emoji} ${textPart}` : textPart

    const entry: TabRenameEntry = {
      customTitle,
      emoji,
      originalTitle,
      matchMode,
      url: normalizeUrl(url, matchMode),
      createdAt: savedEntry?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }

    const msg: Message = { type: 'RENAME_TAB', url, entry }
    await chrome.runtime.sendMessage(msg)
    setAppliedTitle(customTitle)
    onClose()
  }, [titleValue, selectedEmoji, matchMode, originalTitle, url, savedEntry, onClose])

  const handleReset = useCallback(async () => {
    setAppliedTitle(null)
    document.title = originalTitle
    const msg: Message = { type: 'RESET_TAB', url }
    await chrome.runtime.sendMessage(msg)
    onClose()
  }, [originalTitle, url, onClose])

  const handleEmojiToggle = useCallback(async () => {
    const nextVisible = !pickerVisible
    setPickerVisible(nextVisible)

    if (nextVisible && !pickerMountedRef.current) {
      pickerMountedRef.current = true
      await import('emoji-picker-element')
      const wrapper = pickerWrapperRef.current
      if (!wrapper) return
      const pickerEl = document.createElement('emoji-picker')
      pickerEl.addEventListener('emoji-click', (e: Event) => {
        const detail = (e as CustomEvent<{ unicode: string }>).detail
        const newEmoji = detail.unicode
        setSelectedEmoji(newEmoji)
        setPickerVisible(false)
        setTitleValue((prev) => {
          const bare = prev.replace(/^\S+\s+/, '')
          return `${newEmoji} ${bare}`
        })
        inputRef.current?.focus()
      })
      wrapper.appendChild(pickerEl)
    }
  }, [pickerVisible])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Enter' && e.target !== emojiBtnRef.current) {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Tab') {
        const modal = modalRef.current
        if (!modal) return
        const focusable = modal.querySelectorAll<HTMLElement>(
          'input, button:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = modal.getRootNode() instanceof ShadowRoot
          ? (modal.getRootNode() as ShadowRoot).activeElement
          : document.activeElement
        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose, handleSave],
  )

  const blockEvent = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
  }, [])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  const handleModalClick = useCallback(
    (e: React.MouseEvent) => {
      if (
        pickerVisible &&
        pickerWrapperRef.current &&
        !pickerWrapperRef.current.contains(e.target as Node) &&
        e.target !== emojiBtnRef.current
      ) {
        setPickerVisible(false)
      }
    },
    [pickerVisible],
  )

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center font-sans animate-[overlay-fade-in_0.15s_ease]"
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
        className="w-[480px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-background p-5 text-foreground shadow-[0_25px_70px_rgba(0,0,0,0.2),0_6px_20px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.06)] ring-1 ring-white/10 animate-[modal-slide-in_0.15s_ease] dark:shadow-[0_25px_70px_rgba(0,0,0,0.5),0_6px_20px_rgba(0,0,0,0.35),0_0_40px_rgba(255,255,255,0.03)] dark:ring-white/[0.08]"
        onClick={handleModalClick}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">Rename Tab</h2>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="cursor-pointer rounded-md border-none bg-transparent px-1.5 py-0.5 text-lg leading-none text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Input row */}
        <div className="relative mb-3 flex items-center gap-2">
          <button
            ref={emojiBtnRef}
            type="button"
            title="Add emoji prefix"
            onClick={handleEmojiToggle}
            className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-input text-xl transition-colors hover:border-ring ${pickerVisible ? 'border-ring' : 'border-border'}`}
          >
            {selectedEmoji || '😀'}
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Tab title…"
            aria-label="Tab title"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:shadow-[0_0_0_3px_var(--color-ring)/15%]"
          />
          <div
            ref={pickerWrapperRef}
            className={`absolute top-[calc(100%+8px)] left-0 z-10 ${pickerVisible ? '' : 'hidden'}`}
          />
        </div>

        {/* Match mode */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            title="Apply to this exact URL only"
            onClick={() => setMatchMode('exact')}
            className={`flex-1 cursor-pointer rounded-lg border px-3 py-1.5 text-center text-xs transition-colors ${
              matchMode === 'exact'
                ? 'border-ring bg-ring/10 font-medium text-ring'
                : 'border-border bg-input text-muted-foreground hover:border-ring hover:text-foreground'
            }`}
          >
            This URL
          </button>
          <button
            type="button"
            title="Apply to all pages on this domain"
            onClick={() => setMatchMode('domain')}
            className={`flex-1 cursor-pointer rounded-lg border px-3 py-1.5 text-center text-xs transition-colors ${
              matchMode === 'domain'
                ? 'border-ring bg-ring/10 font-medium text-ring'
                : 'border-border bg-input text-muted-foreground hover:border-ring hover:text-foreground'
            }`}
          >
            All of {hostname}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="h-9 flex-1 cursor-pointer rounded-lg border-none bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Save
          </button>
          <button
            type="button"
            disabled={!savedEntry}
            onClick={handleReset}
            className="h-9 cursor-pointer whitespace-nowrap rounded-lg border border-border bg-transparent px-3.5 text-[13px] text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
          >
            Restore original
          </button>
        </div>

        {/* Hint */}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Enter to save · Esc to close
        </p>
      </div>
    </div>
  )
}
