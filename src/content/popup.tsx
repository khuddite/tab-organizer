import { createRoot, type Root } from 'react-dom/client';
import type { Message } from '@/shared/messages';
import type { TabRenameEntry } from '@/shared/storage';
import { ROOT_ELEMENT_ID } from '@/shared/constants';
import { RenameModal } from './rename-modal';
import contentCss from './content.css?inline';

let shadowHost: HTMLDivElement | null = null;
let reactRoot: Root | null = null;
let savedBodyOverflow: string | null = null;

export function openRenamePopup(): void {
  if (shadowHost) return;
  injectPopup();
}

export function closeRenamePopup(): void {
  if (savedBodyOverflow !== null) {
    document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = null;
  }
  reactRoot?.unmount();
  reactRoot = null;
  shadowHost?.remove();
  shadowHost = null;
}

async function injectPopup(): Promise<void> {
  const url = location.href;
  let savedEntry: TabRenameEntry | null = null;
  let originalTitle = document.title;

  try {
    const msg: Message = { type: 'GET_RENAME_FOR_URL', url };
    const response = await chrome.runtime.sendMessage<Message, Message>(msg);
    if (response?.type === 'RENAME_DATA_RESPONSE') {
      savedEntry = response.entry;
      originalTitle = response.originalTitle || document.title;
    }
  } catch {
    // Use defaults
  }

  shadowHost = document.createElement('div');
  shadowHost.id = ROOT_ELEMENT_ID;
  const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = contentCss;
  shadowRoot.appendChild(style);

  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  document.body.appendChild(shadowHost);

  reactRoot = createRoot(container);
  reactRoot.render(
    <RenameModal
      savedEntry={savedEntry}
      originalTitle={originalTitle}
      url={url}
      onClose={closeRenamePopup}
    />,
  );
}
