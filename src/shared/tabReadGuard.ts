/** Guards content reads against a same-tab navigation during an async response.
 *
 * Checking URL before/after is insufficient when a page reloads, navigates
 * away and back, or redirects to the same URL (ABA race).
 * Only tab IDs and navigation events are observed: no new Chrome permission.
 */
export function assertTabSettledForRead(tab: chrome.tabs.Tab): void {
  if (tab.status === 'loading' || Boolean(tab.pendingUrl)) {
    throw new Error('Privacy Gateway: navigazione della scheda in corso; lettura rifiutata.');
  }
}

export async function withStableTabRead<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
  let navigationObserved = false;
  const onUpdated = (id: number, change: { status?: string; url?: string }) => {
    if (id === tabId && (change.status === 'loading' || change.url !== undefined)) {
      navigationObserved = true;
    }
  };
  const onRemoved = (id: number) => {
    if (id === tabId) navigationObserved = true;
  };

  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onRemoved.addListener(onRemoved);
  try {
    const result = await operation();
    if (navigationObserved) {
      throw new Error('Privacy Gateway: scheda navigata durante la lettura; risultato scartato.');
    }
    return result;
  } finally {
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
  }
}
