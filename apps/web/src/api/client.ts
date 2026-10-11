import type { ApiErrorBody } from '@svi/shared';

const BASE = '/api/v1';

let csrfToken: string | null = null;
export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

let unauthorizedHandler: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  unauthorizedHandler = fn;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  /** Field errors from VALIDATION_ERROR / DUPLICATE responses, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    const fields = (this.details as { fields?: unknown[] } | undefined)?.fields ?? [];
    const out: Record<string, string> = {};
    for (const f of fields) {
      if (typeof f === 'string') out[f] = 'Already in use';
      else if (f && typeof f === 'object' && 'path' in f) {
        const { path, message } = f as { path: string; message: string };
        out[path] ??= message;
      }
    }
    return out;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send a raw body (file upload, CSV) instead of JSON. */
  rawBody?: BodyInit;
  contentType?: string;
  query?: Query;
  signal?: AbortSignal;
}

async function toError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // non-JSON error (proxy, network)
  }
  return new ApiError(
    res.status,
    body?.error.code ?? 'HTTP_ERROR',
    body?.error.message ?? `Request failed (${res.status})`,
    body?.error.details,
  );
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (opts.rawBody !== undefined) {
    body = opts.rawBody;
    if (opts.contentType) headers['Content-Type'] = opts.contentType;
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body,
    credentials: 'same-origin',
    signal: opts.signal,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await toError(res);
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') unauthorizedHandler?.();
    throw err;
  }
  return (await res.json()) as T;
}

/** Downloads a file response (PDF, XLSX) and saves it with the server-provided file name. */
/**
 * Fetches a report file as base64 inside JSON (`as=base64`). Microsoft Edge recognises PDF bytes in a
 * fetched response and hands the page an empty body, so the raw file is never fetched directly.
 */
async function fetchFile(path: string, query?: Query): Promise<{ blob: Blob; name: string }> {
  const r = await api<{ filename: string; mime: string; data: string }>(path, { query: { ...query, as: 'base64' } });
  const bin = atob(r.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length === 0) throw new ApiError(200, 'EMPTY_FILE', 'The file came back empty. Please try again.');
  return { blob: new Blob([bytes], { type: r.mime }), name: r.filename };
}

export async function downloadFile(path: string, query?: Query): Promise<void> {
  const { blob, name } = await fetchFile(path, query);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Opens a PDF in a new tab for preview/printing. The tab is opened synchronously on the click (so
 * popup blockers allow it) and filled once the PDF arrives; if popups are blocked, it downloads instead.
 */
export async function openPdf(path: string, query?: Query): Promise<void> {
  const tab = window.open('', '_blank');
  if (tab) tab.document.title = 'Preparing PDF…';
  try {
    const { blob, name } = await fetchFile(path, query);
    const url = URL.createObjectURL(blob);
    if (tab && !tab.closed) {
      tab.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}

export const errorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong';
