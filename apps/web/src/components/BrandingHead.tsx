import { useEffect } from 'react';
import { logoUrl, useBranding } from '../api/hooks';

/** Puts the school name in the browser tab title and uses the school logo as the tab icon. */
export function BrandingHead() {
  const { data } = useBranding();

  useEffect(() => {
    if (!data) return;
    document.title = `${data.name} · Exam Management`;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const logo = logoUrl(data);
    if (link) {
      link.href = logo ?? '/favicon.svg';
      link.type = logo ? '' : 'image/svg+xml';
    }
  }, [data]);

  return null;
}
