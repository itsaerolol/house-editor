import { useApp } from '../store/useApp';
import { useEffect, useMemo, useState } from 'react';
import type { MaterialDefinition, MaterialKind } from '../model/types';
import { useStore } from '../store/store';
import { FIXED_SLOT_MATERIAL } from '../model/catalog';

// materials that only make sense on furniture parts (rubber, porcelain, art canvas...) stay out of building finishes
const FURNITURE_ONLY = new Set<string>([...Object.values(FIXED_SLOT_MATERIAL), 'canvas-horizon', 'rug-persian']);
import { canDelete, finishTargets } from './walkEdit';
import { Chip, byName } from './MaterialPicker';

const KIND_LABEL: Partial<Record<MaterialKind, string>> = {
  paint: 'Paint',
  siding: 'Siding',
  stone: 'Stone & brick',
  wood: 'Wood',
  tile: 'Tile',
  concrete: 'Concrete',
  fabric: 'Fabric & leather',
  metal: 'Metal',
  roof: 'Roofing',
  glass: 'Glass',
  ground: 'Ground',
};
const ORDER: Record<string, MaterialKind[]> = {
  wall: ['paint', 'siding', 'stone', 'wood', 'tile', 'concrete', 'metal'],
  room: ['wood', 'tile', 'stone', 'concrete', 'fabric', 'paint'],
  furniture: ['wood', 'fabric', 'metal', 'stone', 'paint', 'tile'],
  opening: ['wood', 'paint', 'metal'],
  slab: ['wood', 'concrete', 'stone', 'tile', 'ground'],
  roof: ['roof', 'metal'],
  stair: ['wood', 'stone', 'concrete', 'paint', 'metal'],
};

export function relockWalk() {
  if (matchMedia('(pointer: coarse)').matches) return;
  const c = document.querySelector('#viewport canvas') as HTMLCanvasElement | null;
  c?.requestPointerLock?.();
}

/** Finish picker over the walk view: tabs for each paintable part, a swatch grid grouped by material family. */
export function WalkPalette() {
  const s = useApp();
  const p = s.hist.project;
  const targets = useMemo(() => finishTargets(p, s.selection, s.group), [p, s.selection, s.group]);
  const [tab, setTab] = useState(0);
  const t = targets[Math.min(tab, targets.length - 1)];
  const kind = (s.group[0] ?? s.selection)?.kind ?? 'wall';
  const groups = useMemo(() => {
    const order = ORDER[kind] ?? ORDER.wall;
    const by: Record<string, MaterialDefinition[]> = {};
    for (const m of Object.values(p.materials)) {
      if (m.kind === 'light' || m.kind === 'foliage' || m.kind === 'glass') continue;
      if (kind !== 'furniture' && (FURNITURE_ONLY.has(m.id) || m.texture === 'horizon' || m.texture === 'persian')) continue;
      (by[m.kind] ??= []).push(m);
    }
    // alphabetical: families by name, then materials by name inside each family
    void order;
    const kinds = (Object.keys(by) as MaterialKind[]).sort((a, b) => (KIND_LABEL[a] ?? a).localeCompare(KIND_LABEL[b] ?? b));
    return kinds.map((k) => ({ kind: k, list: by[k].sort(byName) }));
  }, [p.materials, kind]);
  useEffect(() => setTab(0), [s.selection?.id, s.group.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        useStore.setState({ walkPalette: false });
      }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, []);
  const done = () => {
    useStore.setState({ walkPalette: false });
    relockWalk();
  };
  if (!t) {
    return (
      <div className="palette-scrim">
        <div className="palette">
          <p className="note">This selection has nothing to recolor. Pick one kind of thing at a time.</p>
          <div className="actions">
            <button onClick={done}>Keep walking</button>
          </div>
        </div>
      </div>
    );
  }
  const cur = new Set(t.current);
  return (
    <div className="palette-scrim" onMouseDown={(e) => e.target === e.currentTarget && done()}>
      <div className="palette" role="dialog" aria-label="Change finish">
        <header>
          <div className="seg" role="tablist">
            {targets.map((x, i) => (
              <button key={x.key} role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
                {x.label}
              </button>
            ))}
          </div>
          <span className="spacer" />
          {canDelete(s.selection, s.group) && (
            <button className="danger pill-btn" onClick={() => (s.deleteSelected(), done())}>
              Delete
            </button>
          )}
          <button className="on pill-btn" onClick={done}>
            Done · keep walking
          </button>
        </header>
        <div className="palette-body">
          {groups.map((g) => (
            <section key={g.kind}>
              <h4>{KIND_LABEL[g.kind] ?? g.kind}</h4>
              <div className="swatches">
                {g.list.map((m) => (
                  <button key={m.id} className={'sw' + (cur.has(m.id) ? ' on' : '')} onClick={() => s.edit(`${t.label}: ${m.name}`, (d) => t.apply(d, m.id))} title={m.name}>
                    <Chip m={m} size={46} />
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <footer className="note">Changes apply live. Ctrl+Z undoes. Esc closes.</footer>
      </div>
    </div>
  );
}
