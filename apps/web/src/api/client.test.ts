import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  ApiError,
  FIREWALL_RETRY_DELAYS_MS,
  isFirewallBlock,
  isFirewallError,
} from './client';

/** What the hosting firewall sends: a bare 403 page, without the API's X-Request-Id header. */
const firewall403 = () => new Response('<html>Access denied</html>', { status: 403 });
const apiResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-1' },
  });

describe('isFirewallBlock', () => {
  it('is a 403 without the API request id', () => {
    expect(isFirewallBlock(firewall403())).toBe(true);
    expect(isFirewallBlock(apiResponse(403, { error: { code: 'FORBIDDEN', message: 'No' } }))).toBe(
      false,
    );
    expect(isFirewallBlock(new Response('', { status: 500 }))).toBe(false);
  });
});

describe('api() firewall retries', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends a blocked request again and returns the answer once it gets through', async () => {
    fetchMock
      .mockResolvedValueOnce(firewall403())
      .mockResolvedValueOnce(firewall403())
      .mockResolvedValueOnce(apiResponse(200, { ok: true }));
    const p = api<{ ok: boolean }>('/exams', { method: 'PUT', body: { a: 1 } });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last retry with a FIREWALL_BLOCKED error', async () => {
    fetchMock.mockImplementation(async () => firewall403());
    const p = api('/exams');
    const settled = p.catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const e = await settled;
    expect(e).toBeInstanceOf(ApiError);
    expect(isFirewallError(e)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(FIREWALL_RETRY_DELAYS_MS.length + 1);
  });

  it("does not retry the API's own 403", async () => {
    fetchMock.mockResolvedValue(
      apiResponse(403, { error: { code: 'FORBIDDEN', message: 'Not allowed' } }),
    );
    const settled = api('/users').catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const e = await settled;
    expect(e).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Not allowed' });
    expect(isFirewallError(e)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
