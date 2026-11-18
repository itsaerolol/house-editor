/** A 2D canvas that works on the main thread and inside workers (OffscreenCanvas). */
export function makeCanvas(w: number, h = w): HTMLCanvasElement {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement;
}
