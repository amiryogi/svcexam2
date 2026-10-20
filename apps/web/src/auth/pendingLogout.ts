/**
 * Remembers a sign-out whose request didn't reach the server (e.g. a hosting-firewall block). The
 * server session and its cookie are then still valid, so on the next start the app finishes the
 * sign-out instead of restoring that session (see AuthProvider). Kept in localStorage so it also
 * holds for a new tab or after the browser restarts; storage that throws just loses the flag.
 */
const KEY = 'svi.pendingLogout';

export function hasPendingLogout(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setPendingLogout(pending: boolean): void {
  try {
    if (pending) globalThis.localStorage?.setItem(KEY, '1');
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // storage blocked: nothing more can be done here
  }
}
