import { useEffect, useRef, useState } from 'react';

const ANIMATION_DURATION_MS = 300;

export const useAnimatedNumber = (value: number | null) => {
  const [displayedValue, setDisplayedValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (value === null) {
      previousValueRef.current = null;
      setDisplayedValue(null);
      return;
    }

    const initialValue = previousValueRef.current ?? value;
    previousValueRef.current = value;

    if (
      initialValue === value ||
      typeof globalThis.requestAnimationFrame !== 'function'
    ) {
      setDisplayedValue(value);
      return;
    }

    const startedAt = globalThis.performance.now();
    let frameId = 0;

    const updateDisplayedValue = (now: number) => {
      const progress = Math.min((now - startedAt) / ANIMATION_DURATION_MS, 1);

      setDisplayedValue(
        Math.round(initialValue + (value - initialValue) * progress),
      );

      if (progress < 1) {
        frameId = globalThis.requestAnimationFrame(updateDisplayedValue);
      }
    };

    frameId = globalThis.requestAnimationFrame(updateDisplayedValue);

    return () => {
      globalThis.cancelAnimationFrame(frameId);
    };
  }, [value]);

  return displayedValue;
};
