import { useRef, useState, TouchEvent } from 'react';
import { getNextMonth, getPreviousMonth } from '../utils/rollover';

interface UseMonthSwipeOptions {
  selectedMonth: string;
  onMonthChange?: (newMonth: string) => void;
  threshold?: number;
}

export function useMonthSwipe({
  selectedMonth,
  onMonthChange,
  threshold = 45,
}: UseMonthSwipeOptions) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeFeedback, setSwipeFeedback] = useState<'prev' | 'next' | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchStartRef.current || !onMonthChange) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Must be a relatively swift gesture (<800ms) and primarily horizontal
    if (elapsed > 800) return;

    if (Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < 0) {
        // Swiped left -> advance to next month
        const next = getNextMonth(selectedMonth);
        setSwipeFeedback('next');
        setTimeout(() => setSwipeFeedback(null), 350);
        onMonthChange(next);
      } else {
        // Swiped right -> go back to previous month
        const prev = getPreviousMonth(selectedMonth);
        setSwipeFeedback('prev');
        setTimeout(() => setSwipeFeedback(null), 350);
        onMonthChange(prev);
      }
    }
  };

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
    },
    swipeFeedback,
  };
}
