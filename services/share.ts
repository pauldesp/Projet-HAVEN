export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable';

type ShareCapableNavigator = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export async function shareOrCopy(
  data: ShareData,
  browserNavigator: ShareCapableNavigator = navigator
): Promise<ShareResult> {
  if (browserNavigator.share) {
    try {
      await browserNavigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }

  if (browserNavigator.clipboard) {
    try {
      await browserNavigator.clipboard.writeText(data.url || '');
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }

  return 'unavailable';
}
