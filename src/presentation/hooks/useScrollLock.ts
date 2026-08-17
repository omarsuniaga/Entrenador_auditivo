/**
 * Custom Hook: useScrollLock
 * Locks background scrolling on document body whenever a modal or drawer is active.
 * Restores original body overflow style upon unmount or when modal closes.
 */

import { useEffect } from 'react';

export function useScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    // Save previous overflow style
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const originalPaddingRight = window.getComputedStyle(document.body).paddingRight;
    
    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Lock scrolling on document body and html
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalStyle === 'hidden' ? '' : originalStyle;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isLocked]);
}
