import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useStore } from '../store/store';
import { viewLabel } from './cameraViews';

/** Handles "Export image": re-renders at a higher pixel ratio, saves a PNG, restores. */
export function ExportBridge() {
  const req = useStore((s) => s.exportRequest);
  const { gl, setDpr, viewport, invalidate } = useThree();
  const state = useRef<{ nonce: number; frames: number; prev: number } | null>(null);
  useEffect(() => {
    if (!req) return;
    state.current = { nonce: req.nonce, frames: 0, prev: viewport.dpr };
    setDpr(Math.min(4, req.scale * Math.max(1, window.devicePixelRatio)));
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.nonce]);
  useFrame(() => {
    const s = state.current;
    if (!s) return;
    s.frames++;
    invalidate();
    if (s.frames < 4) return;
    state.current = null;
    const p = useStore.getState().hist.project;
    gl.domElement.toBlob((blob) => {
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const label = viewLabel(p.view.mode, p.view.isoCorner).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        a.download = `farmhouse-${label}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        useStore.getState().toast('success', `Saved ${gl.domElement.width} x ${gl.domElement.height} PNG`);
      } else useStore.getState().toast('error', 'Image export failed.');
      setDpr(s.prev);
    }, 'image/png');
  });
  return null;
}
