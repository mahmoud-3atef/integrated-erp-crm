// The company's changes as the server saves them (GET /api/v1/system/live, server-sent events): only the modules'
// names («operations», «housing»…), never data. One stream per tab, open while a page listens.

type Listener = (areas: string[]) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let retry: number | undefined;

function open() {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/v1/system/live');
  source.addEventListener('change', (event) => {
    const areas = (event as MessageEvent<string>).data.split(',').filter(Boolean);
    listeners.forEach((listener) => listener(areas));
  });
  source.onerror = () => {
    // The browser reconnects by itself; when it gives up (signed out, server down) try again a little later.
    if (source?.readyState === EventSource.CLOSED) {
      source = null;
      window.clearTimeout(retry);
      retry = window.setTimeout(() => listeners.size > 0 && open(), 30_000);
    }
  };
}

function close() {
  window.clearTimeout(retry);
  source?.close();
  source = null;
}

/** Calls `listener` with the modules changed; returns the way to stop. */
export function subscribeLive(listener: Listener): () => void {
  listeners.add(listener);
  open();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) close();
  };
}
