import { useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useReactFlow } from '@xyflow/react';

interface UseRightMousePanResult {
  onPaneMouseDown: (event: ReactMouseEvent) => void;
  onPaneMouseMove: (event: ReactMouseEvent) => void;
  onPaneMouseUp: () => void;
}

export function useRightMousePan(): UseRightMousePanResult {
  const { getViewport, setViewport } = useReactFlow();
  const isPanningRef = useRef(false);
  const startClientRef = useRef({ x: 0, y: 0 });
  const startViewportRef = useRef({ x: 0, y: 0, zoom: 1 });

  const onPaneMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      if (event.button !== 2) {
        return;
      }
      event.preventDefault();
      const viewport = getViewport();
      startClientRef.current = { x: event.clientX, y: event.clientY };
      startViewportRef.current = viewport;
      isPanningRef.current = true;
    },
    [getViewport],
  );

  const onPaneMouseMove = useCallback(
    (event: ReactMouseEvent) => {
      if (!isPanningRef.current) return;
      event.preventDefault();
      const viewport = startViewportRef.current;
      const dx = (event.clientX - startClientRef.current.x) / viewport.zoom;
      const dy = (event.clientY - startClientRef.current.y) / viewport.zoom;
      setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom });
    },
    [setViewport],
  );

  const onPaneMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  return {
    onPaneMouseDown,
    onPaneMouseMove,
    onPaneMouseUp,
  };
}
