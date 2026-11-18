import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { thumbBus } from './thumbBus';

/** Lets the Home screen ask for a small picture of the current view to use as the house's card. */
export function ThumbBridge() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    thumbBus.grab = () => {
      try {
        gl.render(scene, camera);
        const src = gl.domElement;
        const W = 480;
        const H = 300;
        const k = Math.max(W / src.width, H / src.height);
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        if (!g) return null;
        g.drawImage(src, (W - src.width * k) / 2, (H - src.height * k) / 2, src.width * k, src.height * k);
        return c.toDataURL('image/jpeg', 0.78);
      } catch {
        return null;
      }
    };
    return () => {
      thumbBus.grab = null;
    };
  }, [gl, scene, camera]);
  return null;
}
