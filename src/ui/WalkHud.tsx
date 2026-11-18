import { useEffect, useState } from 'react';
import type { Project, Selection } from '../model/types';
import { useStore } from '../store/store';
import { WalkPalette, relockWalk } from './WalkPalette';
import { canDelete } from './walkEdit';
import { TouchWalk } from './TouchWalk';
import { useTouch } from './device';

const COLL: Record<string, keyof Project> = { wall: 'walls', opening: 'openings', furniture: 'furniture', room: 'rooms', slab: 'slabs', stair: 'stairs', roof: 'roofs' };
function nameOf(p: Project, s: Selection | null): string | null {
  if (!s) return null;
  const e = (p[COLL[s.kind]] as unknown as Record<string, { name?: string }> | undefined)?.[s.id];
  if (!e) return null;
  if (s.kind === 'room') return `${e.name} floor`;
  return e.name ?? (s.kind === 'wall' ? 'Wall' : s.kind);
}

/** The controls card closes itself after 8 seconds (or with its X). A small Controls button brings it back. */
export const WALK_TIP_MS = 8000;
export function useAutoClose(ms: number, active = true): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!open || !active) return;
    const t = setTimeout(() => setOpen(false), ms);
    return () => clearTimeout(t);
  }, [open, active, ms]);
  return [open, setOpen];
}

export function WalkHud() {
  const [keysOpen, setKeysOpen] = useAutoClose(WALK_TIP_MS);
  const locked = useStore((s) => s.walkLocked);
  const info = useStore((s) => s.walkInfo);
  const setView = useStore((s) => s.setView);
  const resetWalk = useStore((s) => s.resetWalk);
  const p = useStore((s) => s.hist.project);
  const hover = useStore((s) => s.hover);
  const sel = useStore((s) => s.selection);
  const group = useStore((s) => s.group);
  const palette = useStore((s) => s.walkPalette);
  const del = useStore((s) => s.deleteSelected);
  const touch = useTouch();
  const aimed = nameOf(p, hover);
  const picked = group.length > 1 ? `${group.length} items` : nameOf(p, sel);
  const aimedIsSel = !!hover && !!sel && hover.id === sel.id && hover.kind === sel.kind;
  if (touch)
    return (
      <>
        <TouchWalk />
        {palette && <WalkPalette />}
        {picked && !palette && (
          <div className="walk-status touch" key={picked}>
            <b>{picked}</b> selected
          </div>
        )}
        <div className="hud tl">
          <b>WALKTHROUGH</b>
          {info && (
            <span>
              {info.floor} · {info.y.toFixed(2)} m
            </span>
          )}
        </div>
      </>
    );
  return (
    <>
      {locked && <div className={'crosshair' + (aimed ? ' on' : '')} />}
      {locked && aimed && !aimedIsSel && (
        <div className="aim-tag" key={hover!.id}>
          <kbd>Click</kbd> {aimed}
        </div>
      )}
      {!locked && !picked && keysOpen && (
        <div className="walk-overlay">
          <div className="walk-card">
            <button className="tip-x" onClick={() => setKeysOpen(false)} aria-label="Close controls">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <span className="walk-eyebrow">Walkthrough</span>
            <h2>Click anywhere to start</h2>
            <ul className="walk-keys">
              <li><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>Move</li>
              <li><span><kbd>Mouse</kbd></span>Look</li>
              <li><span><kbd>Click</kbd></span>Select what you aim at</li>
              <li><span><kbd>Shift</kbd></span>Run · Shift-click adds</li>
              <li><span><kbd>Space</kbd></span>Jump</li>
              <li><span><kbd>E</kbd></span>Open the door ahead</li>
              <li><span><kbd>R</kbd></span>Back to the start</li>
              <li><span><kbd>F</kbd><kbd>Del</kbd></span>Recolor · delete it</li>
              <li><span><kbd>Esc</kbd></span>Pause</li>
            </ul>
            <div className="actions">
              <button onClick={resetWalk}>Reset position</button>
              <button onClick={() => setView({ mode: 'persp' })}>Leave walk</button>
            </div>
          </div>
        </div>
      )}
      {!locked && !picked && !keysOpen && (
        <div className="walk-status live">
          <span>Click to look around</span>
          <button className="pill-btn" onClick={() => setKeysOpen(true)}>Controls</button>
          <button className="pill-btn" onClick={resetWalk}>Reset</button>
          <button className="pill-btn" onClick={() => setView({ mode: 'persp' })}>Leave walk</button>
        </div>
      )}
      {picked && !palette && (
        <div className={'walk-status' + (locked ? '' : ' live')} key={locked ? 'l' : 'u'}>
          <b>{picked}</b>
          {locked ? (
            <>
              <span><kbd>F</kbd> change finish</span>
              {canDelete(sel, group) && <span><kbd>Del</kbd> delete</span>}
              <span><kbd>Esc</kbd> all settings</span>
            </>
          ) : (
            <>
              <button className="pill-btn" onClick={() => useStore.setState({ walkPalette: true })}>Change finish</button>
              {canDelete(sel, group) && (
                <button className="pill-btn danger" onClick={del}>
                  Delete
                </button>
              )}
              <button className="pill-btn on" onClick={relockWalk}>Keep walking</button>
            </>
          )}
        </div>
      )}
      {palette && <WalkPalette />}
      {locked && info?.door && <div className="walk-prompt">E: {info.door.open ? 'close' : 'open'} {info.door.name.toLowerCase()}</div>}
      <div className="hud tl">
        <b>WALKTHROUGH</b>
        {info && (
          <span>
            {info.floor} · {info.y.toFixed(2)} m
          </span>
        )}
      </div>
    </>
  );
}
