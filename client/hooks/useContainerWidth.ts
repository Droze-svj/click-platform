import { useCallback, useEffect, useState } from 'react';

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
  ref: React.RefCallback<T>;
  width: number;
} {
  // A callback ref, not useRef + a mount-only effect: pages render a loading
  // skeleton first and attach the ref to the real shell later. The old effect
  // ran once, found ref.current === null and never observed anything, so width
  // stayed 0 forever — Settings kept its desktop side-nav on phones (content
  // squeezed to ~40px), and every caller's "narrow" layout never kicked in.
  const [el, setEl] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setEl(node), []);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      // Round + threshold to avoid sub-pixel re-render loops.
      setWidth((prev) => (Math.abs(prev - w) > 1 ? Math.round(w) : prev));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return { ref, width };
}

export default useContainerWidth;
