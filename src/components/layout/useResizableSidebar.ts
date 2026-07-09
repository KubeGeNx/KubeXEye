import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface UseResizableSidebarOptions {
  min: number;
  max: number;
  defaultWidth: number;
  /** localStorage key the width is persisted under, so it survives reloads. */
  storageKey: string;
}

interface UseResizableSidebarResult {
  width: number;
  isResizing: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/** Drag-to-resize width state for a side panel, persisted to `localStorage`. Pure UI-interaction
 * concern (pointer tracking, clamping, persistence) decoupled from whatever panel/layout renders
 * the drag handle — reusable and independently testable. */
export function useResizableSidebar({ min, max, defaultWidth, storageKey }: UseResizableSidebarOptions): UseResizableSidebarResult {
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(storageKey));
    return stored >= min && stored <= max ? stored : defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, width: defaultWidth });

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStart.current = { x: event.clientX, width };
      setIsResizing(true);
    },
    [width],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = event.clientX - resizeStart.current.x;
      const nextWidth = Math.min(max, Math.max(min, resizeStart.current.width + delta));
      setWidth(nextWidth);
    };
    const handlePointerUp = () => setIsResizing(false);

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing, min, max]);

  useEffect(() => {
    if (isResizing) return;
    localStorage.setItem(storageKey, String(width));
  }, [width, isResizing, storageKey]);

  return { width, isResizing, onPointerDown };
}
