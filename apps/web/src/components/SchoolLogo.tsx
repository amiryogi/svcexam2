import { useState } from 'react';
import { logoUrl, useBranding } from '../api/hooks';
import { cn } from './ui';

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-20 text-xl',
  xl: 'size-28 text-3xl',
};

/** "Siddhartha Vanasthali Institute" -> "SVI" (used when no logo is uploaded). */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !['of', 'and', 'the', '&'].includes(w.toLowerCase()))
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 3)
    .join('') || 'S';

/**
 * The school's logo on a white circle (so dark logos stay visible on the blue sidebar / login
 * background). Falls back to the school's initials when no logo is uploaded.
 */
export function SchoolLogo({ size = 'md', className }: { size?: keyof typeof sizes; className?: string }) {
  const branding = useBranding();
  const src = logoUrl(branding.data);
  const [failed, setFailed] = useState<string | null>(null);
  const name = branding.data?.name ?? '';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-bold text-brand-800 shadow-sm ring-1 ring-black/5',
        sizes[size],
        className,
      )}
    >
      {src && failed !== src ? (
        <img src={src} alt={name ? `${name} logo` : 'School logo'} className="size-full object-contain p-[6%]" onError={() => setFailed(src)} />
      ) : (
        <span aria-label={name || 'School'}>{initials(name)}</span>
      )}
    </span>
  );
}
