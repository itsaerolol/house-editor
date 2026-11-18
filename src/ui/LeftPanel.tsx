import { useApp } from '../store/useApp';
import { useMemo, useState } from 'react';
import { CATALOG, CATEGORIES } from '../model/catalog';
import { useStore } from '../store/store';
import type { EntityKind, Id, Project } from '../model/types';
import { Check, LengthField } from './fields';
import { formatLength } from '../model/units';
import { THUMBS } from './thumbs';

export function LeftPanel() {
  const tab = useStore((s) => s.leftTab);
  const setTab = useStore((s) => s.setLeftTab);
  return (
    <aside className="panel left">
      <nav className="tabs">
        {(['levels', 'hierarchy', 'catalog'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'levels' ? 'Levels & view' : t === 'hierarchy' ? 'Hierarchy' : 'Furniture'}
          </button>
        ))}
      </nav>
      <div className="panel-body">{tab === 'levels' ? <LevelsTab /> : tab === 'hierarchy' ? <HierarchyTab /> : <CatalogTab />}</div>
    </aside>
  );
}

export function LevelsTab() {
  const s = useApp();
  const p = s.hist.project;
  const v = p.view;
  const [shiftAbove, setShiftAbove] = useState(true);
  const active = p.levels[v.activeLevelId];
  const order = [...p.levelOrder].reverse();

  const setElevation = (id: Id, value: number): string[] => {
    const idx = p.levelOrder.indexOf(id);
    const below = idx > 0 ? p.levels[p.levelOrder[idx - 1]] : null;
    if (below && value < below.elevation + 0.6) return [`Must be at least ${formatLength(0.6, v.units)} above "${below.name}".`];
    const delta = value - p.levels[id].elevation;
    if (!shiftAbove) {
      const above = idx + 1 < p.levelOrder.length ? p.levels[p.levelOrder[idx + 1]] : null;
      if (above && value > above.elevation - 0.6) return [`Must stay below "${above.name}". Turn on "Move levels above" to shift it too.`];
    }
    s.edit('Level elevation', (d) => {
      d.levels[id].elevation = value;
      if (shiftAbove) for (const lid of d.levelOrder.slice(idx + 1)) d.levels[lid].elevation += delta;
    }, 'level-elev' + id);
    return [];
  };

  return (
    <>
      <h4>Levels</h4>
      <ul className="levels">
        {order.map((id) => {
          const l = p.levels[id];
          const only = v.levelFilter === id;
          return (
            <li key={id} className={v.activeLevelId === id ? 'on' : ''}>
              <button className="lvl" onClick={() => s.setView({ activeLevelId: id })}>
                <b>{l.name}</b>
                <small>{formatLength(l.elevation, v.units)}</small>
              </button>
              <button className={'mini' + (only ? ' on' : '')} title="Show only this level" onClick={() => s.setView({ levelFilter: only ? 'all' : id })}>
                only
              </button>
            </li>
          );
        })}
      </ul>
      {active && (
        <div className="box">
          <h5>{active.name}</h5>
          <LengthField label="Floor elevation" value={active.elevation} onCommit={(x) => setElevation(active.id, x)} />
          <LengthField
            label="Ceiling height"
            value={active.ceilingHeight}
            min={1.8}
            onCommit={(x) => {
              s.edit('Ceiling height', (d) => void (d.levels[active.id].ceilingHeight = x), 'level-ceil' + active.id);
            }}
          />
          <LengthField
            label="Slab thickness"
            value={active.slabThickness}
            min={0.05}
            onCommit={(x) => {
              s.edit('Slab thickness', (d) => void (d.levels[active.id].slabThickness = x), 'level-slab' + active.id);
            }}
          />
          <Check label="Move levels above" checked={shiftAbove} onChange={setShiftAbove} title="Shift upper levels by the same amount" />
        </div>
      )}
      <h4>Visibility</h4>
      <div className="checks">
        <Check label="Roof" checked={v.showRoof} onChange={(x) => s.setView({ showRoof: x })} />
        <Check label="Ceilings" checked={v.showCeilings} onChange={(x) => s.setView({ showCeilings: x })} />
        <Check label="Furniture" checked={v.showFurniture} onChange={(x) => s.setView({ showFurniture: x })} />
        <Check label="Site & ground" checked={v.showSite} onChange={(x) => s.setView({ showSite: x })} />
        <Check label="Room labels" checked={v.showLabels} onChange={(x) => s.setView({ showLabels: x })} />
        <Check label="Dimensions" checked={v.showDimensions} onChange={(x) => s.setView({ showDimensions: x })} />
        <Check label="Isolate active level" checked={v.isolateActive} onChange={(x) => s.setView({ isolateActive: x })} />
        <Check label="Cutaway (dollhouse)" checked={v.cutaway} onChange={(x) => s.setView({ cutaway: x })} />
        <Check label="Ghost level below (plan)" checked={v.ghostLower} onChange={(x) => s.setView({ ghostLower: x })} />
      </div>
      <LengthField label="Cut height" value={v.cutHeight} min={0.3} onCommit={(x) => s.setView({ cutHeight: x })} title="Height above the active floor where walls are sectioned" />
      <h4>Grid & snapping</h4>
      <div className="checks">
        <Check label="Grid" checked={v.showGrid} onChange={(x) => s.setView({ showGrid: x })} />
        <Check label="Axes" checked={v.showAxes} onChange={(x) => s.setView({ showAxes: x })} />
        <Check label="Snap" checked={v.snapEnabled} onChange={(x) => s.setView({ snapEnabled: x })} />
      </div>
      <label className="field">
        <span>Grid spacing</span>
        <select value={String(v.gridSpacing)} onChange={(e) => s.setView({ gridSpacing: Number(e.target.value) })}>
          <option value="0.0762">3 in</option>
          <option value="0.1524">6 in</option>
          <option value="0.3048">1 ft</option>
          <option value="0.6096">2 ft</option>
          <option value="0.1">10 cm</option>
          <option value="0.5">50 cm</option>
        </select>
      </label>
      <label className="field">
        <span>Rotation snap</span>
        <select value={v.rotationSnap} onChange={(e) => s.setView({ rotationSnap: Number(e.target.value) })}>
          {[5, 15, 45, 90].map((d) => (
            <option key={d} value={d}>
              {d}°
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

const GROUPS_RAW: { kind: EntityKind; key: keyof Project; label: string }[] = [
  { kind: 'room', key: 'rooms', label: 'Rooms' },
  { kind: 'wall', key: 'walls', label: 'Walls' },
  { kind: 'opening', key: 'openings', label: 'Doors & windows' },
  { kind: 'slab', key: 'slabs', label: 'Slabs & decks' },
  { kind: 'stair', key: 'stairs', label: 'Stairs' },
  { kind: 'roof', key: 'roofs', label: 'Roofs' },
  { kind: 'furniture', key: 'furniture', label: 'Furniture' },
];

export const GROUPS = [...GROUPS_RAW].sort((a, b) => a.label.localeCompare(b.label));

export function HierarchyTab() {
  const p = useStore((s) => s.hist.project);
  const sel = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const setView = useStore((s) => s.setView);
  const edit = useStore((s) => s.edit);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ 'L1:furniture': false });
  const needle = q.trim().toLowerCase();

  const rows = useMemo(() => {
    const out: Record<string, { id: Id; name: string; hidden?: boolean; locked?: boolean; catalogId?: string }[]> = {};
    for (const lid of p.levelOrder) {
      for (const g of GROUPS) {
        const coll = p[g.key] as unknown as Record<Id, any>;
        const list = Object.values(coll)
          .filter((e) => {
            if (g.kind === 'opening') return p.walls[e.wallId]?.levelId === lid;
            if (g.kind === 'stair') return e.levelIds[0] === lid;
            return e.levelId === lid;
          })
          .map((e) => ({ id: e.id as Id, name: (e.name ?? e.id) as string, hidden: e.hidden, locked: e.locked, catalogId: e.catalogId as string | undefined }))
          .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.id.includes(needle))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        out[`${lid}:${g.kind}`] = list;
      }
    }
    return out;
  }, [p, needle]);

  return (
    <>
      <input className="search" placeholder="Filter by name or id" value={q} onChange={(e) => setQ(e.target.value)} />
      {[...p.levelOrder].reverse().map((lid) => (
        <details key={lid} open={lid === p.view.activeLevelId || !!needle}>
          <summary>{p.levels[lid].name}</summary>
          {GROUPS.map((g) => {
            const key = `${lid}:${g.kind}`;
            const list = rows[key] ?? [];
            if (!list.length) return null;
            const isOpen = !!needle || open[key];
            return (
              <div key={key} className="grp">
                <button className="grp-h" onClick={() => setOpen({ ...open, [key]: !open[key] })}>
                  <span>{isOpen ? '▾' : '▸'}</span> {g.label} <small>{list.length}</small>
                </button>
                {isOpen && (
                  <ul className="tree">
                    {list.slice(0, 400).map((e) => (
                      <li key={e.id} className={sel?.id === e.id && sel.kind === g.kind ? 'on' : ''}>
                        <button
                          onClick={() => {
                            select({ kind: g.kind, id: e.id });
                            if (p.view.activeLevelId !== lid) setView({ activeLevelId: lid });
                          }}
                        >
                          {e.catalogId && THUMBS[e.catalogId] && <img className="tree-thumb" src={THUMBS[e.catalogId]} alt="" width={28} height={28} />}
                          {e.name}
                        </button>
                        {g.kind !== 'room' && g.kind !== 'stair' && g.kind !== 'roof' && (
                          <>
                            <button
                              className={'ico' + (e.hidden ? ' off' : '')}
                              title={e.hidden ? 'Show' : 'Hide'}
                              onClick={() => edit('Toggle visibility', (d) => void ((d as any)[g.key][e.id].hidden = !e.hidden))}
                            >
                              {e.hidden ? '◌' : '●'}
                            </button>
                            {g.kind !== 'slab' && (
                              <button className={'ico' + (e.locked ? ' on' : '')} title={e.locked ? 'Unlock' : 'Lock'} onClick={() => edit('Toggle lock', (d) => void ((d as any)[g.key][e.id].locked = !e.locked))}>
                                {e.locked ? '🔒' : '⌂'}
                              </button>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </details>
      ))}
    </>
  );
}

function CatalogTab() {
  const placing = useStore((s) => s.placing);
  const start = useStore((s) => s.startPlacing);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  return (
    <>
      <input className="search" placeholder="Search furniture" value={q} onChange={(e) => setQ(e.target.value)} />
      {placing && <p className="note">Placing {CATALOG.find((c) => c.id === placing.catalogId)?.name}. Click to place, R rotates, Esc cancels. Hold Shift to keep placing.</p>}
      {CATEGORIES.map((cat) => {
        const items = CATALOG.filter((c) => c.category === cat && (!needle || c.name.toLowerCase().includes(needle)));
        if (!items.length) return null;
        return (
          <details key={cat} open={!!needle || cat === 'Living'}>
            <summary>{cat}</summary>
            <div className="catalog">
              {items.map((c) => (
                <button key={c.id} className={placing?.catalogId === c.id ? 'on' : ''} onClick={() => start(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}
