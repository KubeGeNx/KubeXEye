import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useResizableSidebar } from './useResizableSidebar';

const OPTS = { min: 200, max: 560, defaultWidth: 290, storageKey: 'test.sidebarWidth' };

function firePointer(type: 'pointermove' | 'pointerup', clientX = 0) {
  act(() => {
    document.dispatchEvent(new MouseEvent(type, { clientX } as MouseEventInit) as unknown as PointerEvent);
  });
}

describe('useResizableSidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts at the default width when nothing is stored', () => {
    const { result } = renderHook(() => useResizableSidebar(OPTS));
    expect(result.current.width).toBe(290);
    expect(result.current.isResizing).toBe(false);
  });

  it('restores a previously stored width if it is within [min, max]', () => {
    localStorage.setItem(OPTS.storageKey, '400');
    const { result } = renderHook(() => useResizableSidebar(OPTS));
    expect(result.current.width).toBe(400);
  });

  it('ignores a stored width outside [min, max] and falls back to the default', () => {
    localStorage.setItem(OPTS.storageKey, '9999');
    const { result } = renderHook(() => useResizableSidebar(OPTS));
    expect(result.current.width).toBe(290);
  });

  it('drags to a new width, clamped to [min, max], and persists it once released', () => {
    const { result } = renderHook(() => useResizableSidebar(OPTS));

    act(() => {
      result.current.onPointerDown({ preventDefault: () => {}, clientX: 100 } as any);
    });
    expect(result.current.isResizing).toBe(true);

    firePointer('pointermove', 100 + 1000); // way past max
    expect(result.current.width).toBe(OPTS.max);

    firePointer('pointerup');
    expect(result.current.isResizing).toBe(false);
    expect(localStorage.getItem(OPTS.storageKey)).toBe(String(OPTS.max));
  });

  it('does not persist the in-progress width to storage while still resizing', () => {
    const { result } = renderHook(() => useResizableSidebar(OPTS));
    const persistedBeforeDrag = localStorage.getItem(OPTS.storageKey); // mount persists the initial width

    act(() => {
      result.current.onPointerDown({ preventDefault: () => {}, clientX: 0 } as any);
    });
    firePointer('pointermove', 50);

    expect(result.current.width).toBe(OPTS.defaultWidth + 50); // hook state updates live...
    expect(localStorage.getItem(OPTS.storageKey)).toBe(persistedBeforeDrag); // ...but storage doesn't, until pointerup
  });
});
