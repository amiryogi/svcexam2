import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasPendingLogout, setPendingLogout } from './pendingLogout';

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe('pending logout flag', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is remembered until cleared', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(hasPendingLogout()).toBe(false);
    setPendingLogout(true);
    expect(hasPendingLogout()).toBe(true);
    setPendingLogout(false);
    expect(hasPendingLogout()).toBe(false);
  });

  it('never throws when storage is unavailable or blocked', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => setPendingLogout(true)).not.toThrow();
    expect(hasPendingLogout()).toBe(false);
    const blocked = () => {
      throw new Error('SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => setPendingLogout(true)).not.toThrow();
    expect(hasPendingLogout()).toBe(false);
  });
});
