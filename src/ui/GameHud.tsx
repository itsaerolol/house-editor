import { useApp } from '../store/useApp';
import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { CATALOG, CATEGORIES } from '../model/catalog';
import { serializeProject } from '../model/serialize';
import { EXTERIOR_STYLES, applyExteriorStyle, currentExteriorStyle } from '../model/exteriorStyles';
import { formatLength } from '../model/units';
import type { IsoCorner, ViewMode } from '../model/types';
import { useStore } from '../store/store';
import { ISO_CORNERS, viewLabel } from '../viewport/cameraViews';
import { HierarchyTab, LevelsTab } from './LeftPanel';
import { saveFile, fileSafeName } from '../store/files';
import { goHome, importFiles } from '../store/projects';
import { THUMBS } from './thumbs';
import { byName } from './MaterialPicker';
import { isTouch, useCompact, useTouch } from './device';
import { input } from '../viewport/input';

/** A one-off tip, shown the first time something happens on this device. */
export function firstTimeTip(key: string, text: string) {
  try {
    if (localStorage.getItem('tip:' + key)) return;
    localStorage.setItem('tip:' + key, '1');
  } catch {
    /* private mode: show it anyway */
  }
  useStore.getState().toast('info', text);
}

const SORTED_CATEGORIES = [...CATEGORIES].sort((a, b) => a.localeCompare(b));
import { texturesPending } from '../render/textures';
import { furniturePending } from '../render/furnitureGeometry';
import { openingsPending } from '../render/openings';

/** Quiet progress while textures, furniture and trim stream in from the workers. */
function LoadingChip() {
  const [n, setN] = useState(0);
  const peak = useRef(0);
  useEffect(() => {
    const t = setInterval(() => {
      const v = texturesPending() + furniturePending() + openingsPending();
      peak.current = v ? Math.max(peak.current, v) : 0;
      setN(v);
    }, 200);
    return () => clearInterval(t);
  }, []);
  if (!n) return null;
  const pct = peak.current ? Math.round(100 * (1 - n / peak.current)) : 0;
  return (
    <span className="loadchip" role="status" aria-live="polite">
      <i style={{ transform: `scaleX(${Math.max(0.04, pct / 100)})` }} />
      Building the house · {pct}%
    </span>
  );
}

/** Game modes: what the player is doing, not which panel is open. */
export type GameMode = 'explore' | 'build' | 'decorate';
type Drawer = null | 'world' | 'layers' | 'settings';

export const useUi = create<{ mode: GameMode; drawer: Drawer; cat: string; setMode: (m: GameMode) => void; setDrawer: (d: Drawer) => void; setCat: (c: string) => void }>((set) => ({
  mode: 'explore',
  drawer: null,
  cat: 'Living',
  setMode: (mode) => set({ mode }),
  setDrawer: (drawer) => set({ drawer }),
  setCat: (cat) => set({ cat }),
}));

/* ---------------------------------------------------------------- icons (stroke, 20px) */

const I = {
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  home: 'M3 11 12 3l9 8M5 9.5V20h5v-6h4v6h5V9.5',
  camera: 'M3 8h3l2-3h8l2 3h3v11H3zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  explore: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z',
  build: 'M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6',
  decorate: 'M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3v-4ZM6 17v2M18 17v2',
  walk: 'M13 4a1.5 1.5 0 1 1 0 .01M10 21l2-6 3 3v3M12 15l-1-5 4 1 2 3M11 10l-3 2-1 3',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'm15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5',
  world: 'M3 21V9l9-6 9 6v12M3 13h18M3 17h18',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 18h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  close: 'M6 6l12 12M18 6 6 18',
  cursor: 'M5 3l14 7-6 2-2 6-6-15Z',
  wall: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6',
  door: 'M6 21V3h12v18M3 21h18M14 12h.01',
  door2: 'M4 21V3h16v18M12 3v18M2 21h20M10 12h.01M14 12h.01',
  slider: 'M3 4h18v17H3zM12 4v17M7 12h3M8 10l-2 2 2 2M17 12h-3M16 10l2 2-2 2',
  cased: 'M6 21V9a6 6 0 0 1 12 0v12M3 21h18',
  garage: 'M3 21V8l9-5 9 5v13M6 21V11h12v10M6 14h12M6 17h12',
  picture: 'M4 5h16v14H4z',
  brick: 'M3 5h18v14H3zM3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19',
  transom: 'M4 3h16v18H4zM4 8h16M12 8v13',
  window: 'M4 4h16v16H4zM12 4v16M4 12h16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
};
export function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const Kbd = ({ k }: { k: string }) => <kbd>{k}</kbd>;

/* ---------------------------------------------------------------- top bar */

function ModeDock() {
  const mode = useUi((u) => u.mode);
  const setMode = useUi((u) => u.setMode);
  const s = useApp();
  const go = (m: GameMode) => {
    setMode(m);
    if (m === 'explore') s.setTool('select');
    if (m === 'build' && !['wall', 'door', 'window'].includes(s.tool)) s.setTool('select');
    if (m === 'decorate') s.setTool('select');
  };
  const items: { id: GameMode | 'walk'; label: string; icon: string; key: string }[] = [
    { id: 'explore', label: 'Explore', icon: I.explore, key: 'X' },
    { id: 'build', label: 'Build', icon: I.build, key: 'B' },
    { id: 'decorate', label: 'Decorate', icon: I.decorate, key: 'C' },
    { id: 'walk', label: 'Walk', icon: I.walk, key: 'P' },
  ];
  const idx = items.findIndex((i) => i.id === mode);
  return (
    <nav className="dock" role="tablist" aria-label="Mode">
      <span className="dock-thumb" style={{ transform: `translateX(${idx * 100}%)` }} aria-hidden />
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={mode === it.id}
          className={'dock-btn' + (mode === it.id ? ' on' : '')}
          onClick={() => (it.id === 'walk' ? s.setView({ mode: 'walk' }) : go(it.id))}
          title={`${it.label} (${it.key})`}
        >
          <Icon d={it.icon} />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

function TopBar() {
  const s = useApp();
  const p = s.hist.project;
  const drawer = useUi((u) => u.drawer);
  const setDrawer = useUi((u) => u.setDrawer);
  const toggle = (d: Drawer) => setDrawer(drawer === d ? null : d);
  const compact = useCompact();
  const [more, setMore] = useState(false);
  if (compact)
    return (
      <header className="topbar compact">
        <ModeDock />
        <div className="orbs">
          <button className="orb" disabled={!s.hist.past.length} onClick={s.undo} aria-label="Undo">
            <Icon d={I.undo} />
          </button>
          <button className={'orb' + (more || drawer ? ' on' : '')} onClick={() => (drawer ? setDrawer(null) : setMore(!more))} aria-label="More" aria-expanded={more}>
            <Icon d={I.more} />
          </button>
        </div>
        {more && (
          <Sheet title="More" onClose={() => setMore(false)}>
            <div className="rows">
              <button onClick={() => (setMore(false), void goHome())}>
                <Icon d={I.home} /> Home & saved houses
              </button>
              <button disabled={!s.hist.future.length} onClick={() => (s.redo(), setMore(false))}>
                <Icon d={I.redo} /> Redo
              </button>
              <button onClick={() => (setMore(false), setDrawer('world'))}>
                <Icon d={I.world} /> Floors & view
              </button>
              <button onClick={() => (setMore(false), setDrawer('layers'))}>
                <Icon d={I.layers} /> Everything in the house
              </button>
              <button onClick={() => (setMore(false), setDrawer('settings'))}>
                <Icon d={I.gear} /> Settings, style & sky
              </button>
              <button onClick={() => (setMore(false), s.setDialog('help'))}>
                <Icon d={I.help} /> How to use it
              </button>
            </div>
          </Sheet>
        )}
      </header>
    );
  return (
    <header className="topbar">
      <button className="crest crest-btn" onClick={() => void goHome()} title="Home and saved houses" aria-label="Home and saved houses">
        <span className="crest-mark" aria-hidden>
          <Icon d={I.home} size={18} />
        </span>
        <div>
          <b>{p.name}</b>
          <small>{p.levels[p.view.activeLevelId]?.name}</small>
        </div>
      </button>
      <ModeDock />
      <div className="orbs">
        <button className="orb" disabled={!s.hist.past.length} onClick={s.undo} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Icon d={I.undo} />
        </button>
        <button className="orb" disabled={!s.hist.future.length} onClick={s.redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <Icon d={I.redo} />
        </button>
        <span className="orb-sep" />
        <button className={'orb' + (drawer === 'world' ? ' on' : '')} onClick={() => toggle('world')} title="Floors and visibility" aria-label="Floors and visibility">
          <Icon d={I.world} />
        </button>
        <button className={'orb' + (drawer === 'layers' ? ' on' : '')} onClick={() => toggle('layers')} title="Everything in the house" aria-label="Layers">
          <Icon d={I.layers} />
        </button>
        <button className={'orb' + (drawer === 'settings' ? ' on' : '')} onClick={() => toggle('settings')} title="Settings and files" aria-label="Settings">
          <Icon d={I.gear} />
        </button>
        <button className="orb" onClick={() => s.setDialog('help')} title="Controls (?)" aria-label="Controls">
          <Icon d={I.help} />
        </button>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- bottom sheet (phones) */

/** Drag the grabber down to dismiss; tap it to expand or settle. */
export function useSheetDrag(onClose: () => void) {
  const ref = useRef<HTMLElement | null>(null);
  const [tall, setTall] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);
  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { y: e.clientY, t: performance.now() };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current || !ref.current) return;
      const dy = e.clientY - start.current.y;
      ref.current.style.transform = `translateY(${Math.max(-40, dy)}px)`;
      ref.current.style.transition = 'none';
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s0 = start.current;
      start.current = null;
      const el = ref.current;
      if (!s0 || !el) return;
      const dy = e.clientY - s0.y;
      const fast = dy / Math.max(1, performance.now() - s0.t) > 0.6;
      el.style.transition = '';
      el.style.transform = '';
      if (dy > 90 || (fast && dy > 30)) onClose();
      else if (Math.abs(dy) < 6) setTall((t) => !t);
      else if (dy < -30) setTall(true);
    },
  };
  return { ref, handle, tall };
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { ref, handle, tall } = useSheetDrag(onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  return (
    <div className="sheet-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={ref as React.RefObject<HTMLElement>} className={'sheet' + (tall ? ' tall' : '')} role="dialog" aria-label={title}>
        <div className="grabber" {...handle} aria-label="Drag down to close">
          <i />
        </div>
        <header>
          <h3>{title}</h3>
          <button className="orb sm" onClick={onClose} aria-label="Close">
            <Icon d={I.close} size={18} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- floors (elevator) */

function FloorRail() {
  const s = useApp();
  const p = s.hist.project;
  const v = p.view;
  const order = [...p.levelOrder].reverse();
  const short = (name: string, i: number) => (/base/i.test(name) ? 'B' : String(order.length - i - (order.some((id) => /base/i.test(p.levels[id].name)) ? 1 : 0)));
  return (
    <div className="floors" role="group" aria-label="Floors">
      {order.map((id, i) => {
        const l = p.levels[id];
        const on = v.activeLevelId === id;
        const solo = v.levelFilter === id;
        return (
          <div key={id} className={'floor' + (on ? ' on' : '')}>
            <button
              className="floor-btn"
              onClick={() => s.setView(on ? { levelFilter: solo ? 'all' : id } : { activeLevelId: id, levelFilter: v.levelFilter === 'all' ? 'all' : id })}
              title={on ? (solo ? `Show every floor` : `Show only ${l.name}`) : `Go to ${l.name}`}
              aria-pressed={on}
            >
              <b>{short(l.name, i)}</b>
            </button>
            <span className="floor-tip">
              {l.name}
              <small>{solo ? 'only this floor · tap to show all' : on ? 'tap again to isolate' : formatLength(l.elevation, v.units)}</small>
            </span>
          </div>
        );
      })}
      <button className={'floor-all' + (v.levelFilter === 'all' ? ' on' : '')} onClick={() => s.setView({ levelFilter: 'all' })} title="Show every floor">
        All
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- camera cluster */

const ORTHO: { id: ViewMode; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Under' },
];

function CameraCluster() {
  const s = useApp();
  const v = s.hist.project.view;
  const [more, setMore] = useState(false);
  const cam = (m: ViewMode) => s.setView({ mode: m });
  const compact = useCompact();
  if (compact)
    return (
      <div className="camera compact">
        <button className={'orb sm' + (more ? ' on' : '')} onClick={() => setMore(!more)} aria-label="Camera views">
          <Icon d={I.camera} size={20} />
        </button>
        <button className="orb sm" onClick={s.resetView} aria-label="Frame the house">
          <Icon d={I.fit} size={18} />
        </button>
        <button className={'orb sm' + (v.cutaway ? ' on' : '')} onClick={() => s.setView({ cutaway: !v.cutaway, showRoof: v.cutaway })} aria-label="Dollhouse cutaway">
          <Icon d={I.eye} size={18} />
        </button>
        {more && (
          <Sheet title="Camera" onClose={() => setMore(false)}>
            <div className="camgrid">
              {(
                [
                  ['persp', '3D', 'Orbit freely'],
                  ['iso', 'Iso', 'Tidy overview'],
                  ['plan', 'Plan', 'Top-down floor plan'],
                  ...ORTHO.map((o) => [o.id, o.label, 'Flat elevation'] as const),
                ] as [ViewMode, string, string][]
              ).map(([m, l, sub]) => (
                <button
                  key={m}
                  className={v.mode === m ? 'on' : ''}
                  onClick={() => {
                    cam(m);
                    setMore(false);
                  }}
                >
                  <b>{l}</b>
                  <small>{sub}</small>
                </button>
              ))}
            </div>
          </Sheet>
        )}
      </div>
    );
  return (
    <div className="camera">
      <div className="seg" role="group" aria-label="Camera">
        {(
          [
            ['persp', '3D'],
            ['iso', 'Iso'],
            ['plan', 'Plan'],
          ] as [ViewMode, string][]
        ).map(([m, l]) => (
          <button key={m} className={v.mode === m ? 'on' : ''} onClick={() => cam(m)}>
            {l}
          </button>
        ))}
        <button className={ORTHO.some((o) => o.id === v.mode) || more ? 'on' : ''} onClick={() => setMore(!more)} aria-expanded={more}>
          {ORTHO.find((o) => o.id === v.mode)?.label ?? 'Sides'}
        </button>
      </div>
      <button className="orb sm" onClick={s.resetView} title="Frame the house (F)" aria-label="Frame the house">
        <Icon d={I.fit} size={18} />
      </button>
      <button className={'orb sm' + (v.cutaway ? ' on' : '')} onClick={() => s.setView({ cutaway: !v.cutaway, showRoof: v.cutaway })} title="Dollhouse cutaway" aria-label="Dollhouse cutaway">
        <Icon d={I.eye} size={18} />
      </button>
      {more && (
        <div className="pop seg vert" role="menu">
          {ORTHO.map((o) => (
            <button
              key={o.id}
              role="menuitem"
              className={v.mode === o.id ? 'on' : ''}
              onClick={() => {
                cam(o.id);
                setMore(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {v.mode === 'iso' && (
        <div className="seg corners" role="group" aria-label="Isometric corner">
          {(Object.keys(ISO_CORNERS) as IsoCorner[]).map((c) => (
            <button key={c} className={v.isoCorner === c ? 'on' : ''} onClick={() => s.setView({ isoCorner: c })} title={ISO_CORNERS[c].label}>
              {ISO_CORNERS[c].label.replace('Front', 'F').replace('Back', 'B').replace('-left', 'L').replace('-right', 'R')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- hotbar */

const DOORS = [
  ['cased', 'Cased opening', I.cased],
  ['double', 'French pair', I.door2],
  ['garage', 'Garage', I.garage],
  ['single', 'Single', I.door],
  ['sliding', 'Slider', I.slider],
] as const;
const WINDOWS = [
  ['casement', 'Casement', I.window],
  ['fixed', 'Picture', I.picture],
  ['transom', 'Transom', I.transom],
] as const;

function BuildBar() {
  const s = useApp();
  const tool = s.tool;
  const card = (key: string, label: string, icon: string, on: boolean, onClick: () => void, hot?: string) => (
    <button key={key} className={'card tool' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}>
      <span className="card-art">
        <Icon d={icon} size={30} />
      </span>
      <span className="card-name">{label}</span>
      {hot && <kbd className="card-key">{hot}</kbd>}
    </button>
  );
  return (
    <div className="hotbar-row">
      {card('select', 'Grab', I.cursor, tool === 'select', () => s.setTool('select'), 'V')}
      {card('wall', 'Wall', I.wall, tool === 'wall', () => s.setTool('wall'), 'W')}
      <span className="hot-sep" />
      {DOORS.map(([id, label, ic]) => card('d' + id, label, ic, tool === 'door' && s.doorStyle === id, () => (useStore.setState({ doorStyle: id }), s.setTool('door'))))}
      <span className="hot-sep" />
      {WINDOWS.map(([id, label, ic]) => card('w' + id, label, ic, tool === 'window' && s.windowStyle === id, () => (useStore.setState({ windowStyle: id }), s.setTool('window'))))}
      <span className="hot-sep" />
      {card('style', 'House style', I.brick, false, () => useUi.getState().setDrawer('settings'))}
    </div>
  );
}

function DecorateBar() {
  const placing = useStore((s) => s.placing);
  const start = useStore((s) => s.startPlacing);
  const cat = useUi((u) => u.cat);
  const setCat = useUi((u) => u.setCat);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const items = useMemo(() => CATALOG.filter((c) => (needle ? c.name.toLowerCase().includes(needle) || c.category.toLowerCase().includes(needle) : c.category === cat)).sort(byName), [cat, needle]);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current?.scrollTo({ left: 0 });
  }, [cat, needle]);
  return (
    <>
      <div className="cats" role="tablist" aria-label="Furniture categories">
        <label className="find">
          <Icon d={I.search} size={16} />
          <input placeholder="Find" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find furniture" />
        </label>
        {SORTED_CATEGORIES.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={!needle && cat === c}
            className={!needle && cat === c ? 'on' : ''}
            ref={(el) => {
              // scroll only the tab strip (scrollIntoView would also nudge the whole page)
              const strip = el?.parentElement;
              if (el && strip && !needle && cat === c) strip.scrollLeft = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
            }}
            onClick={() => (setQ(''), setCat(c))}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="hotbar-row scroll" ref={row}>
        {items.map((c, i) => (
          <button
            key={c.id}
            className={'card' + (placing?.catalogId === c.id ? ' on' : '')}
            style={{ animationDelay: `${50 + Math.min(i, 10) * 45}ms` }}
            onClick={() => {
              // on touch there is no cursor to carry a piece: drop it mid-view, selected, and let the finger drag it
              if (isTouch() && input.placeAtCenter?.(c.id)) {
                firstTimeTip('place', 'Placed in the middle of the view. Drag it into place. Twist two fingers to turn it.');
                return;
              }
              start(c.id);
            }}
            title={`${c.name}. Click to pick up, then click the floor to place.`}
          >
            <span className="card-art">{THUMBS[c.id] ? <img src={THUMBS[c.id]} alt="" draggable={false} /> : <Icon d={I.decorate} size={30} />}</span>
            <span className="card-name">{c.name}</span>
          </button>
        ))}
        {!items.length && <p className="empty">Nothing matches "{q}".</p>}
      </div>
    </>
  );
}

function ExploreBar() {
  const p = useStore((s) => s.hist.project);
  const counts = [
    [Object.keys(p.rooms).length, 'rooms'],
    [Object.keys(p.furniture).length, 'pieces'],
    [Object.keys(p.openings).length, 'doors & windows'],
    [p.levelOrder.length, 'floors'],
  ] as const;
  return (
    <div className="stats">
      {counts.map(([n, l]) => (
        <span key={l}>
          <b>{n}</b> {l}
        </span>
      ))}
    </div>
  );
}

function Hotbar() {
  const mode = useUi((u) => u.mode);
  return (
    <div className={'hotbar ' + mode} key={mode}>
      {mode === 'build' && <BuildBar />}
      {mode === 'decorate' && <DecorateBar />}
      {mode === 'explore' && <ExploreBar />}
    </div>
  );
}

/* ---------------------------------------------------------------- hint line */

function HintLine() {
  const s = useApp();
  const mode = useUi((u) => u.mode);
  const v = s.hist.project.view;
  const touch = useTouch();
  let line: React.ReactNode = s.hint;
  if (!line && touch) {
    if (s.addMode) line = <>Tap items to add or remove them · tap Select more again when done</>;
    else if (s.tool === 'wall') line = <>Tap where the wall starts, tap where it ends · Grab to stop</>;
    else if (s.tool === 'door' || s.tool === 'window') line = <>Tap a wall to set it in · red means it won't fit</>;
    else if (s.group.length > 1) line = <>Tap more to add · edit them together below</>;
    else if (s.selection?.kind === 'furniture') line = <>Drag it to move · twist two fingers to turn</>;
    else if (s.selection) line = <>Change it in the card below · tap empty space to let go</>;
    else if (mode === 'decorate') line = <>Tap a piece to drop it in view</>;
    else if (mode === 'build') line = <>Pick a tool below</>;
    else line = v.mode === 'persp' || v.mode === 'iso' ? <>Drag to look around · pinch to zoom · two fingers to move</> : <>Drag to move · pinch to zoom</>;
  }
  if (!line) {
    if (s.placing) line = <>Click the floor to place · <Kbd k="R" /> rotate · <Kbd k="Shift" /> keep placing · <Kbd k="Esc" /> put back</>;
    else if (s.tool === 'wall') line = <>Click to start a wall, click again to end · <Kbd k="Esc" /> stop</>;
    else if (s.tool === 'door' || s.tool === 'window') line = <>Hover a wall and click to set it in · red means it won't fit</>;
    else if (s.group.length > 1) line = <><Kbd k="Shift" /> click to add or remove · <Kbd k="Del" /> removes all · <Kbd k="Esc" /> clear</>;
    else if (s.selection && s.selection.kind !== 'furniture') line = <>Change it in the card on the right · <Kbd k="Shift" /> click to select more</>;
    else if (s.selection) line = <>Drag to move · <Kbd k="Q" /> <Kbd k="E" /> turn · <Kbd k="Ctrl D" /> copy · <Kbd k="Del" /> remove</>;
    else if (mode === 'explore') line = v.mode === 'persp' || v.mode === 'iso' ? <>Drag to orbit · right-drag to pan · scroll to zoom</> : <>Drag to pan · scroll to zoom</>;
    else if (mode === 'decorate') line = <>Pick something from the shelf below</>;
    else line = <>Pick a tool below</>;
  }
  return (
    <div className="hintline" aria-live="polite" key={typeof line === 'string' ? line : s.tool + (s.placing?.catalogId ?? '') + (s.selection?.id ?? '') + mode}>
      {line}
    </div>
  );
}

/* ---------------------------------------------------------------- drawers */

function SettingsPane() {
  const s = useApp();
  const p = s.hist.project;
  const v = p.view;
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <h4>Time of day</h4>
      <div className="tod" role="group" aria-label="Time of day">
        {(['dawn', 'day', 'dusk', 'night'] as const).map((t) => (
          <button key={t} className={'tod-btn tod-' + t + ((v.timeOfDay ?? 'day') === t ? ' on' : '')} aria-pressed={(v.timeOfDay ?? 'day') === t} onClick={() => s.setView({ timeOfDay: t })}>
            <span className="tod-sky" aria-hidden />
            {t === 'day' ? 'Daylight' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <h4>House style</h4>
      <div className="styles">
        {[...EXTERIOR_STYLES].sort(byName).map((st) => {
          const on = currentExteriorStyle(p) === st.id;
          return (
            <button key={st.id} className={'style-card' + (on ? ' on' : '')} aria-pressed={on} onClick={() => s.edit(`Exterior: ${st.name}`, (d) => applyExteriorStyle(d, st.id))}>
              <span className="chips">
                {st.swatches.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <b>{st.name}</b>
              <small>{st.blurb}</small>
            </button>
          );
        })}
      </div>
      <p className="note">Restyles every outside wall, gable and roof at once. Click any wall to change one face by hand.</p>
      <h4>Graphics</h4>
      <div className="seg wide" role="group" aria-label="Quality">
        {(['low', 'medium', 'high'] as const).map((q) => (
          <button key={q} className={v.quality === q ? 'on' : ''} onClick={() => s.setView({ quality: q })}>
            {q[0].toUpperCase() + q.slice(1)}
          </button>
        ))}
      </div>
      <p className="note">High adds soft shadows, ambient occlusion and full-detail plants. Far trees drop detail on their own.</p>
      <h4>Units</h4>
      <div className="seg wide" role="group" aria-label="Units">
        <button className={v.units === 'imperial' ? 'on' : ''} onClick={() => s.setView({ units: 'imperial' })}>
          Feet & inches
        </button>
        <button className={v.units === 'metric' ? 'on' : ''} onClick={() => s.setView({ units: 'metric' })}>
          Meters
        </button>
      </div>
      <h4>Save file</h4>
      <div className="tiles">
        <button onClick={() => void saveFile(fileSafeName(p.name), serializeProject(p))}>Export house</button>
        <button onClick={() => file.current?.click()}>Import house</button>
        <button onClick={() => s.setDialog('export')}>Snapshot</button>
        <button className="danger" onClick={() => s.setDialog('reset')}>
          Start over
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importFiles([f]);
        }}
      />
    </>
  );
}

function Drawers() {
  const drawer = useUi((u) => u.drawer);
  const setDrawer = useUi((u) => u.setDrawer);
  const last = useRef<Drawer>(drawer);
  const [closing, setClosing] = useState(false);
  if (drawer) last.current = drawer;
  useEffect(() => {
    if (drawer) return setClosing(false);
    if (!last.current) return;
    setClosing(true);
    const t = setTimeout(() => {
      last.current = null;
      setClosing(false);
    }, 180);
    return () => clearTimeout(t);
  }, [drawer]);
  useEffect(() => {
    if (!drawer) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setDrawer(null));
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [drawer, setDrawer]);
  const compact = useCompact();
  const shown = drawer ?? (closing ? last.current : null);
  if (!shown) return null;
  const title = shown === 'world' ? 'Floors & view' : shown === 'layers' ? 'Everything in the house' : 'Settings';
  if (compact) {
    if (!drawer) return null;
    return (
      <Sheet title={title} onClose={() => setDrawer(null)}>
        {shown === 'world' && <LevelsTab />}
        {shown === 'layers' && <HierarchyTab />}
        {shown === 'settings' && <SettingsPane />}
      </Sheet>
    );
  }
  return (
    <aside className="drawer" data-state={drawer ? 'open' : 'closing'} aria-label={title}>
      <header>
        <h3>{title}</h3>
        <button className="orb sm" onClick={() => setDrawer(null)} aria-label="Close">
          <Icon d={I.close} size={18} />
        </button>
      </header>
      <div className="drawer-body">
        {shown === 'world' && <LevelsTab />}
        {shown === 'layers' && <HierarchyTab />}
        {shown === 'settings' && <SettingsPane />}
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------- save chip */

function SaveChip() {
  const sv = useStore((s) => s.save);
  const text = sv.status === 'saved' ? 'Saved' : sv.status === 'saving' ? 'Saving' : sv.status === 'unsaved' ? 'Unsaved' : 'Save failed';
  return (
    <span className={`savechip save ${sv.status}`} role="status" aria-live="polite" title={sv.message ?? ''}>
      <i /> {text}
    </span>
  );
}

/* ---------------------------------------------------------------- first-run gesture guide (touch) */

function TouchCoach() {
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem('tip:explore-touch');
    } catch {
      return true;
    }
  });
  if (!open) return null;
  const done = () => {
    try {
      localStorage.setItem('tip:explore-touch', '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  return (
    <div className="coach-scrim">
      <div className="coach" role="dialog" aria-label="Touch gestures">
        <span className="walk-eyebrow">Welcome</span>
        <h2>Your house, by touch</h2>
        <ul>
          <li><b>One finger</b> Drag to look around the house.</li>
          <li><b>Two fingers</b> Pinch to zoom. Slide together to move the view.</li>
          <li><b>Tap</b> Select a wall, floor, door or piece. Its options open below.</li>
          <li><b>Selected piece</b> Drag it to move. Twist two fingers to turn it.</li>
          <li><b>Double-tap</b> empty ground to bring the whole house back into view.</li>
        </ul>
        <button className="on pill-btn" onClick={done}>
          Start
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- root */

export function GameHud() {
  const s = useApp();
  const touch = useTouch();
  const v = s.hist.project.view;
  const mode = useUi((u) => u.mode);
  const setMode = useUi((u) => u.setMode);
  // keep the mode in step with tools picked by keyboard
  useEffect(() => {
    if (['wall', 'door', 'window'].includes(s.tool) && mode !== 'build') setMode('build');
    if (s.tool === 'place' && mode !== 'decorate') setMode('decorate');
  }, [s.tool]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || (t?.closest && t.closest('input,select,textarea')) || v.mode === 'walk') return;
      const key = e.key.toLowerCase();
      if (key === 'x') setMode('explore');
      else if (key === 'b') setMode('build');
      else if (key === 'c') setMode('decorate');
      else if (key === 'p') s.setView({ mode: 'walk' });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [v.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  if (v.mode === 'walk') {
    return (
      <div className="hud-layer">
        <button className="pill exit" onClick={() => s.setView({ mode: 'persp' })}>
          <Icon d={I.close} size={16} /> Leave walk
        </button>
      </div>
    );
  }
  return (
    <div className="hud-layer">
      {touch && <TouchCoach />}
      <TopBar />
      <FloorRail />
      <CameraCluster />
      <Drawers />
      <div className="bottom">
        <HintLine />
        <Hotbar />
      </div>
      <SaveChip />
      <LoadingChip />
      <span className="viewtag">{viewLabel(v.mode, v.isoCorner)}</span>
    </div>
  );
}
