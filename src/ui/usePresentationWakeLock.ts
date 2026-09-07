import { useEffect } from 'react';

/**
 * Keeps the screen awake while presenting a play to a team at practice —
 * released automatically when presentation mode ends. The Wake Lock API is
 * released by the browser whenever the tab loses visibility, so it's
 * re-requested on visibilitychange. Silently no-ops on browsers without the
 * API, or if the request is denied — a nice-to-have, not a requirement.
 */
export function usePresentationWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = () => {
      navigator.wakeLock
        .request('screen')
        .then((s) => {
          if (cancelled) {
            s.release().catch(() => {});
          } else {
            sentinel = s;
          }
        })
        .catch(() => {
          // Denied, or the tab isn't visible/focused enough to grant one — fine to just not hold a lock.
        });
    };
    request();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
