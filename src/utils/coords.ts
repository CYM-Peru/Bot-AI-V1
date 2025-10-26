export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export function screenToCanvas(
  clientX: number,
  clientY: number,
  viewportEl: HTMLElement,
  viewport: Viewport
): { x: number; y: number } {
  const rect = viewportEl.getBoundingClientRect();
  const zoom = viewport.zoom || 1;
  const x = (clientX - rect.left) / zoom + viewport.x;
  const y = (clientY - rect.top) / zoom + viewport.y;
  return { x, y };
}

export function canvasToScreen(
  x: number,
  y: number,
  viewportEl: HTMLElement,
  viewport: Viewport
): { clientX: number; clientY: number } {
  const rect = viewportEl.getBoundingClientRect();
  const zoom = viewport.zoom || 1;
  const clientX = (x - viewport.x) * zoom + rect.left;
  const clientY = (y - viewport.y) * zoom + rect.top;
  return { clientX, clientY };
}
