import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { subscribeLive } from '../api/live';

/**
 * A number that grows when the server saves a change in one of `areas` (the modules' schemas; all when omitted):
 * add it to a loader's dependencies and the page refreshes by itself. Changes close together count once (`delay`),
 * and a hidden tab refreshes when it is shown again.
 */
export function useLiveTick(areas?: string[], delay = 1200): number {
  const [tick, setTick] = useState(0);
  const wanted = useRef(areas);
  wanted.current = areas;
  useEffect(() => {
    let timer: number | undefined;
    let missed = false;
    const bump = () => {
      if (document.hidden) {
        missed = true;
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTick((n) => n + 1), delay);
    };
    const stop = subscribeLive((changed) => {
      if (!wanted.current || changed.some((a) => wanted.current!.includes(a))) bump();
    });
    const shown = () => {
      if (!document.hidden && missed) {
        missed = false;
        bump();
      }
    };
    document.addEventListener('visibilitychange', shown);
    return () => {
      stop();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', shown);
    };
  }, [delay]);
  return tick;
}

const LiveTick = createContext(0);

/** Shares a page's live tick with every loader under it. */
export function LiveProvider({ tick, children }: { tick: number; children: ReactNode }) {
  return <LiveTick.Provider value={tick}>{children}</LiveTick.Provider>;
}

/** The live tick of the nearest {@link LiveProvider} (0 without one). */
export function useLive(): number {
  return useContext(LiveTick);
}

/**
 * Remembers the key a loader last showed: when only the live tick moved, the loader refreshes quietly (no skeleton,
 * filters kept); when the key changed (another period), it starts over.
 */
export function useFreshKey(key: string): () => boolean {
  const last = useRef<string | null>(null);
  return () => {
    const fresh = last.current !== key;
    last.current = key;
    return fresh;
  };
}
