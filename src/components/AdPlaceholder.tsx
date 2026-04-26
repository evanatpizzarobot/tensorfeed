'use client';

import { useEffect, useRef } from 'react';

/**
 * Google AdSense ad unit component.
 * Publisher ID: pub-7224757913262984
 *
 * Supported formats:
 *   - 'horizontal'  : leaderboard / banner (between sections)
 *   - 'in-article'  : responsive in-content unit
 *   - 'sidebar'     : rectangle for sidebar / rail
 */

type AdFormat = 'horizontal' | 'in-article' | 'sidebar';

interface AdPlaceholderProps {
  className?: string;
  format?: AdFormat;
  slot?: string;
}

// Prevent duplicate push calls per slot element
const pushedSlots = new Set<HTMLElement>();

export default function AdPlaceholder({
  className = '',
  format = 'in-article',
  slot = '',
}: AdPlaceholderProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    const el = adRef.current;
    if (!el || pushedSlots.has(el)) return;

    try {
      const w = window as unknown as Record<string, unknown>;
      const adsbygoogle = (w.adsbygoogle || []) as Array<Record<string, unknown>>;
      adsbygoogle.push({});
      pushedSlots.add(el);
    } catch {
      // AdSense not loaded yet or blocked by ad-blocker
    }
  }, []);

  const layoutClass =
    format === 'horizontal'
      ? 'min-h-[90px]'
      : format === 'sidebar'
        ? 'min-h-[250px]'
        : 'min-h-[100px]';

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <ins
        ref={adRef}
        className={`adsbygoogle block w-full ${layoutClass}`}
        style={{ display: 'block' }}
        data-ad-client="ca-pub-7224757913262984"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
