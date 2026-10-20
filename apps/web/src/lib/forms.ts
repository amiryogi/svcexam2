import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError, errorMessage, isFirewallError } from '../api/client';

/** Shows server-side field errors on the form; falls back to a toast. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>) {
  if (e instanceof ApiError) {
    const fields = e.fieldErrors;
    const keys = Object.keys(fields);
    for (const k of keys) setError(k as Path<T>, { type: 'server', message: fields[k] });
    if (keys.length === 0 || e.code !== 'VALIDATION_ERROR') toast.error(e.message);
    return;
  }
  toast.error(errorMessage(e));
}

// Firewall blocks share one toast, so autosave retries every few seconds don't stack new ones.
export const toastError = (e: unknown) =>
  toast.error(errorMessage(e), isFirewallError(e) ? { id: 'firewall-blocked' } : undefined);

/** Convert null values to '' so controlled inputs stay controlled. */
export function nullsToEmpty<T extends object>(obj: T): { [K in keyof T]: Exclude<T[K], null> | '' } {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v ?? ''])) as never;
}
