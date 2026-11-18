import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { walkTouch } from '../viewport/walkTouch';
import { canDelete } from './walkEdit';
import { WALK_TIP_MS } from './WalkHud';

const R = 56; // thumbstick travel, px

/**
 * Touch walkthrough: the left side is a floating thumbstick (it appears under the thumb),
 * the right side is drag-to-look, and a quick tap anywhere on the right selects what is under the finger.
 */
export function TouchWalk() {
  const zone = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const info = useStore((s) => s.walkInfo);
  const sel = useStore((s) => s.selection);
  const group = useStore((s) => s.group);
  const del = useStore((s) => s.deleteSelected);
  const [coach, setCoach] = useState(() => {
    try {
      return !localStorage.getItem('tip:walk-touch');
    } catch {
      return true;
    }
  });

  const dismissCoach = () => {
    try {
      localStorage.setItem('tip:walk-touch', '1');
    } catch {
      /* ignore */
    }
    setCoach(false);
  };
  // the guide closes itself after 8 seconds, as if "Got it" were tapped
  useEffect(() => {
    if (!coach) return;
    const t = setTimeout(dismissCoach, WALK_TIP_MS);
    return () => clearTimeout(t);
  }, [coach]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = zone.current!;
    const moves = new Map<number, { kind: 'stick' | 'look'; x0: number; y0: number; x: number; y: number; t: number; moved: boolean }>();
    const down = (e: PointerEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const left = e.clientX - r.left < r.width * 0.42;
      const kind = left && ![...moves.values()].some((m) => m.kind === 'stick') ? 'stick' : 'look';
      moves.set(e.pointerId, { kind, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already-released pointer */
      }
      if (kind === 'stick') setStick({ x: e.clientX, y: e.clientY, kx: 0, ky: 0 });
    };
    const move = (e: PointerEvent) => {
      const m = moves.get(e.pointerId);
      if (!m) return;
      if (m.kind === 'stick') {
        let dx = e.clientX - m.x0;
        let dy = e.clientY - m.y0;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          dx = (dx / d) * R;
          dy = (dy / d) * R;
        }
        walkTouch.jx = dx / R;
        walkTouch.jy = dy / R;
        setStick({ x: m.x0, y: m.y0, kx: dx, ky: dy });
      } else {
        // about 180 degrees for a full-width swipe
        const k = Math.PI / Math.max(320, window.innerWidth);
        walkTouch.look.yaw += (e.clientX - m.x) * k;
        walkTouch.look.pitch += (e.clientY - m.y) * k;
      }
      if (Math.hypot(e.clientX - m.x0, e.clientY - m.y0) > 10) m.moved = true;
      m.x = e.clientX;
      m.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      const m = moves.get(e.pointerId);
      if (!m) return;
      moves.delete(e.pointerId);
      if (m.kind === 'stick') {
        walkTouch.jx = walkTouch.jy = 0;
        setStick(null);
      } else if (!m.moved && performance.now() - m.t < 300) {
        const st = useStore.getState();
        const hit = walkTouch.pickAt?.(e.clientX, e.clientY) ?? null;
        if (hit) st.select(hit);
        else st.select(null);
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      walkTouch.jx = walkTouch.jy = 0;
    };
  }, []);

  const picked = !!sel;
  return (
    <>
      <div ref={zone} className="touchwalk" aria-label="Walk: left thumb moves, right side looks, tap selects" />
      {stick && (
        <div className="stick" style={{ left: stick.x, top: stick.y }} aria-hidden>
          <i style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
        </div>
      )}
      <div className="walk-actions">
        {info?.door && (
          <button className="wa" onClick={() => walkTouch.toggleDoor?.()}>
            {info.door.open ? 'Close door' : 'Open door'}
          </button>
        )}
        {picked && (
          <button className="wa" onClick={() => useStore.setState({ walkPalette: true })}>
            Change finish
          </button>
        )}
        {picked && canDelete(sel, group) && (
          <button className="wa danger" onClick={del}>
            Delete
          </button>
        )}
        <button className="wa round" onClick={() => (walkTouch.jump = true)} aria-label="Jump">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 14 6-6 6 6" />
          </svg>
        </button>
      </div>
      {coach && (
        <div className="coach-scrim">
          <div className="coach" role="dialog" aria-label="How to walk">
            <button className="tip-x" onClick={dismissCoach} aria-label="Close guide">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <span className="walk-eyebrow">Walkthrough</span>
            <h2>Walk with your thumbs</h2>
            <ul>
              <li><b>Left thumb</b> Put it down anywhere on the left and slide to walk. Push to the edge to run.</li>
              <li><b>Right side</b> Drag to look around.</li>
              <li><b>Tap</b> Select what you tap, then change its finish or delete it.</li>
            </ul>
            <button className="on pill-btn" onClick={dismissCoach}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
