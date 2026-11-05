export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable';

type ShareCapableNavigator = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

// Browsers hide navigator.share and navigator.clipboard outside HTTPS, so this keeps copying possible there.
function copyWithSelection(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.appendChild(field);
  field.focus({ preventScroll: true });
  field.setSelectionRange(0, text.length);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export async function shareOrCopy(
  data: ShareData,
  browserNavigator: ShareCapableNavigator = navigator,
  copyFallback: (text: string) => boolean = copyWithSelection
): Promise<ShareResult> {
  if (browserNavigator.share) {
    try {
      await browserNavigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }

  const text = data.url || '';
  if (browserNavigator.clipboard) {
    try {
      await browserNavigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Falls through to the selection-based copy.
    }
  }

  return copyFallback(text) ? 'copied' : 'unavailable';
}
