import { useEffect, useRef, useState } from 'react';

/**
 * useContainerWidth — measure an element's own width via ResizeObserver.
 *
 * Generalizes the container-responsive pattern from EditorHUD (`barWidth`):
 * attach the returned `ref` to any element and read its live, rounded width.
 * This is the reusable basis for components that "auto-fit / adjust perfectly"
 * to whatever space their parent gives them (container queries in JS).
 *
 * - SSR-safe: width starts at 0 and ResizeObserver only runs in the browser.
 * - Rounded + 1px threshold to avoid sub-pixel re-render loops.
 * - Cleans up the observer on unmount.
 *
 * @example
 *   const { ref, width } = useContainerWidth();
 *   return <div ref={ref}>{width < 480 ? <Compact/> : <Full/>}</div>;
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T>;
  width: number;
} {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      // Round + threshold to avoid sub-pixel re-render loops.
      setWidth((prev) => (Math.abs(prev - w) > 1 ? Math.round(w) : prev));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

export default useContainerWidth;
