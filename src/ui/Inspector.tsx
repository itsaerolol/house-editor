import { useApp } from '../store/useApp';
import { CATALOG_BY_ID } from '../model/catalog';
import { THUMBS } from './thumbs';
import { useCompact, useTouch } from './device';
import { useSheetDrag } from './GameHud';
import { wallLength } from '../model/arch';
import { FT, formatLength } from '../model/units';
import { useStore } from '../store/store';
import { BatchMaterial, GroupCard, QuickSelect } from './GroupCard';
import { sideFacingRoom, wallsOfRoom } from '../model/selectHelpers';
import { AngleField, Check, IntField, LengthField, MaterialSelect, TextField } from './fields';

export function Inspector() {
  const s = useApp();
  const compact = useCompact();
  const touch = useTouch();
  const sheet = useSheetDrag(() => s.select(null));
  const p = s.hist.project;
  const sel = s.selection;
  if (!sel || s.walkPalette || (touch && s.hist.project.view.mode === 'walk')) return null;
  void Empty;
  const multi = s.group.length > 1;
  return (
    <aside ref={sheet.ref as React.RefObject<HTMLElement>} className={'inspector' + (sheet.tall ? ' tall' : '')} key={multi ? 'group' : sel.kind + sel.id} aria-label="Selected object">
      {compact && (
        <div className="grabber" {...sheet.handle} aria-label="Drag down to let go">
          <i />
        </div>
      )}
      <header>
        <small>{multi ? 'multiple' : sel.kind === 'opening' ? 'door or window' : sel.kind}</small>
        {touch && (
          <button className={'pill-btn addmode' + (s.addMode ? ' on' : '')} aria-pressed={s.addMode} onClick={() => useStore.setState({ addMode: !s.addMode })}>
            {s.addMode ? 'Tap items to add' : 'Select more'}
          </button>
        )}
        <button className="orb sm" onClick={() => s.select(null)} aria-label="Deselect" title="Deselect (Esc)">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="inspector-body">{multi ? <GroupCard /> : Body()}</div>
    </aside>
  );
  function Empty() {
    const counts = {
      walls: Object.keys(p.walls).length,
      openings: Object.keys(p.openings).length,
      furniture: Object.keys(p.furniture).length,
      rooms: Object.keys(p.rooms).length,
    };
    return (
      <>
        <p className="note">Nothing selected. Click an object in the view or the hierarchy.</p>
        <table className="kv">
          <tbody>
            <tr><td>Project</td><td>{p.name}</td></tr>
            <tr><td>Levels</td><td>{p.levelOrder.length}</td></tr>
            <tr><td>Rooms</td><td>{counts.rooms}</td></tr>
            <tr><td>Walls</td><td>{counts.walls}</td></tr>
            <tr><td>Doors & windows</td><td>{counts.openings}</td></tr>
            <tr><td>Furniture</td><td>{counts.furniture}</td></tr>
          </tbody>
        </table>
      </>
    );
  }
  function Body() {
    if (!sel) return null;
    const u = p.view.units;
    const actions = (
      <div className="actions">
        {['furniture', 'wall'].includes(sel.kind) && <button onClick={s.duplicateSelected}>Duplicate</button>}
        {['furniture', 'wall', 'opening'].includes(sel.kind) && <button onClick={s.toggleLock}>Lock / unlock</button>}
        {sel.kind !== 'level' && sel.kind !== 'room' && sel.kind !== 'stair' && sel.kind !== 'roof' && <button onClick={s.toggleHidden}>Hide / show</button>}
        {!['level', 'room', 'roof', 'stair', 'slab'].includes(sel.kind) && (
          <button className="danger" onClick={s.deleteSelected}>
            Delete
          </button>
        )}
      </div>
    );

    if (sel.kind === 'furniture') {
      const f = p.furniture[sel.id];
      if (!f) return null;
      const item = CATALOG_BY_ID[f.catalogId];
      const lock = !!f.locked;
      return (
        <>
          {THUMBS[f.catalogId] && (
            <div className="insp-hero">
              <img src={THUMBS[f.catalogId]} alt={item?.name ?? ''} />
            </div>
          )}
          <h4 className="insp-title">{f.name}</h4>
          <p className="note">{item?.category} · {lock ? 'locked' : 'editable'}</p>
          {!lock && (
            <div className="quick-acts" role="group" aria-label="Quick actions">
              <button onClick={() => s.rotateFurniture(f.id, f.rotationY + Math.PI / 4, 'q-rot')} aria-label="Turn left">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /></svg>
                Turn
              </button>
              <button onClick={() => s.rotateFurniture(f.id, f.rotationY - Math.PI / 4, 'q-rot')} aria-label="Turn right">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" /></svg>
                Turn
              </button>
              <button onClick={s.duplicateSelected}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 9h11v11H9zM5 15H4V4h11v1" /></svg>
                Copy
              </button>
              <button className="danger" onClick={s.deleteSelected}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                Delete
              </button>
            </div>
          )}
          {item && (['primary', 'secondary', 'accent'] as const).map((slot) =>
            item.slots[slot] ? (
              <MaterialSelect
                key={slot}
                label={item.slots[slot]!.label}
                value={f.materialOverrides[slot] ?? item.slots[slot]!.default}
                onChange={(id) => s.edit('Material', (d) => void (d.furniture[f.id].materialOverrides[slot] = id))}
              />
            ) : null,
          )}
          <details className="adv" open={!compact}>
            <summary>Exact name, size and position</summary>
          <TextField label="Name" value={f.name} onCommit={(v) => s.edit('Rename', (d) => void (d.furniture[f.id].name = v))} />
          <label className="field">
            <span>Level</span>
            <select value={f.levelId} onChange={(e) => s.edit('Move to level', (d) => void (d.furniture[f.id].levelId = e.target.value))} disabled={lock}>
              {[...p.levelOrder].sort((a, b) => p.levels[a].name.localeCompare(p.levels[b].name)).map((id) => (
                <option key={id} value={id}>{p.levels[id].name}</option>
              ))}
            </select>
          </label>
          <div className="two">
            <LengthField label="Across (u)" value={-f.position.x} onCommit={(v) => void s.moveFurniture(f.id, { x: -v, z: f.position.z }, 'num-move')} />
            <LengthField label="Depth (v)" value={f.position.z} onCommit={(v) => void s.moveFurniture(f.id, { x: f.position.x, z: v }, 'num-move')} />
          </div>
          <LengthField label="Height above floor" value={f.elevation} onCommit={(v) => void s.edit('Elevate', (d) => void (d.furniture[f.id].elevation = v), 'elev' + f.id)} />
          <AngleField label="Rotation (deg)" value={f.rotationY} onCommit={(r) => s.rotateFurniture(f.id, r, 'num-rot')} />
          <div className="two">
            <LengthField label="Width" value={f.size.w} min={0.03} onCommit={(v) => void s.resizeFurniture(f.id, { w: v }, 'num-size')} />
            <LengthField label="Depth" value={f.size.d} min={0.03} onCommit={(v) => void s.resizeFurniture(f.id, { d: v }, 'num-size')} />
          </div>
          <LengthField label="Height" value={f.size.h} min={0.02} onCommit={(v) => void s.resizeFurniture(f.id, { h: v }, 'num-size')} />
          </details>
          {actions}
        </>
      );
    }

    if (sel.kind === 'wall') {
      const w = p.walls[sel.id];
      if (!w) return null;
      const L = wallLength(w);
      const err = (r: string[]) => r;
      return (
        <>
          <h4 className="insp-title">{w.name ?? 'Wall'}</h4>
          <p className="note">{w.kind} · length {formatLength(L, u)}</p>
          <MaterialSelect label="Side A finish" value={w.finishA} onChange={(id) => s.edit('Wall finish', (d) => void (d.walls[w.id].finishA = id))} />
          <MaterialSelect label="Side B finish" value={w.finishB} onChange={(id) => s.edit('Wall finish', (d) => void (d.walls[w.id].finishB = id))} />
          <details className="adv" open={!compact}>
            <summary>Exact name, shape and cap</summary>
          <TextField label="Name" value={w.name ?? ''} onCommit={(v) => s.edit('Rename', (d) => void (d.walls[w.id].name = v || undefined))} />
          <div className="two">
            <LengthField label="Start u" value={-w.start.x} onCommit={(v) => err(s.updateWall(w.id, { start: { x: -v, z: w.start.z } }, 'wall-pt'))} />
            <LengthField label="Start v" value={w.start.z} onCommit={(v) => err(s.updateWall(w.id, { start: { x: w.start.x, z: v } }, 'wall-pt'))} />
          </div>
          <div className="two">
            <LengthField label="End u" value={-w.end.x} onCommit={(v) => err(s.updateWall(w.id, { end: { x: -v, z: w.end.z } }, 'wall-pt'))} />
            <LengthField label="End v" value={w.end.z} onCommit={(v) => err(s.updateWall(w.id, { end: { x: w.end.x, z: v } }, 'wall-pt'))} />
          </div>
          <LengthField label="Thickness" value={w.thickness} min={0.02} onCommit={(v) => err(s.updateWall(w.id, { thickness: v }, 'wall-th'))} />
          <LengthField label="Height (blank = level)" value={w.height ?? p.levels[w.levelId].ceilingHeight} min={0.3} onCommit={(v) => err(s.updateWall(w.id, { height: v, topLevelId: undefined }, 'wall-h'))} />
          <label className="field">
            <span>Kind</span>
            <select value={w.kind} onChange={(e) => s.edit('Wall kind', (d) => void (d.walls[w.id].kind = e.target.value as any))}>
              <option value="exterior">Exterior</option>
              <option value="interior">Interior</option>
              <option value="rail">Rail / guard</option>
            </select>
          </label>
          <MaterialSelect label="Top cap" value={w.capMaterialId} onChange={(id) => s.edit('Wall cap', (d) => void (d.walls[w.id].capMaterialId = id))} />
          </details>
          <p className="note">{touch ? 'Tap Select below to edit many walls at once.' : 'Shift-click more walls to edit them together.'}</p>
          <QuickSelect levelId={w.levelId} />
          {actions}
        </>
      );
    }

    if (sel.kind === 'opening') {
      const o = p.openings[sel.id];
      if (!o) return null;
      const w = p.walls[o.wallId];
      const up = (patch: Record<string, unknown>, key = 'op') => s.updateOpening(o.id, patch as any, key);
      return (
        <>
          <h4>{o.name ?? (o.kind === 'door' ? 'Door' : 'Window')}</h4>
          <p className="note">Hosted on {w?.name ?? o.wallId} · wall length {w ? formatLength(wallLength(w), u) : '-'}</p>
          <LengthField label="Offset from wall start" value={o.offset} min={0} onCommit={(v) => up({ offset: v }, 'op-off')} />
          <div className="two">
            <LengthField label="Width" value={o.width} min={0.15} onCommit={(v) => up({ width: v }, 'op-w')} />
            <LengthField label="Height" value={o.height} min={0.15} onCommit={(v) => up({ height: v }, 'op-h')} />
          </div>
          <LengthField label="Sill height" value={o.sill} min={0} onCommit={(v) => up({ sill: v }, 'op-s')} />
          {o.kind === 'door' ? (
            <>
              <label className="field">
                <span>Style</span>
                <select value={o.style} onChange={(e) => up({ style: e.target.value as any })}>
                  {(
                    [
                      ['cased', 'Cased opening'],
                      ['double', 'French pair'],
                      ['garage', 'Garage'],
                      ['single', 'Single'],
                      ['sliding', 'Slider'],
                    ] as const
                  ).map(([x, l]) => (
                    <option key={x} value={x}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Hinge</span>
                <select value={o.hinge} onChange={(e) => up({ hinge: e.target.value as any })}>
                  <option value="end">End of wall</option>
                  <option value="start">Start of wall</option>
                </select>
              </label>
              <Check label="Open (passable)" checked={o.open || o.style === 'cased'} onChange={(x) => up({ open: x })} title="Closed doors block the walkthrough" />
              <MaterialSelect label="Leaf" value={o.leafMaterialId} onChange={(id) => up({ leafMaterialId: id })} />
            </>
          ) : (
            <>
              <label className="field">
                <span>Style</span>
                <select value={o.style} onChange={(e) => up({ style: e.target.value as any })}>
                  {(
                    [
                      ['casement', 'Casement'],
                      ['fixed', 'Picture'],
                      ['transom', 'Transom'],
                    ] as const
                  ).map(([x, l]) => (
                    <option key={x} value={x}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <div className="two">
                <IntField label="Muntin cols" value={o.muntinCols} min={1} max={12} onCommit={(v) => up({ muntinCols: v })} />
                <IntField label="Muntin rows" value={o.muntinRows} min={1} max={12} onCommit={(v) => up({ muntinRows: v })} />
              </div>
            </>
          )}
          <MaterialSelect label="Frame" value={o.frameMaterialId} onChange={(id) => up({ frameMaterialId: id })} />
          {actions}
        </>
      );
    }

    if (sel.kind === 'slab') {
      const sl = p.slabs[sel.id];
      if (!sl) return null;
      return (
        <>
          <h4>{sl.name ?? 'Slab'}</h4>
          <p className="note">{sl.kind} · {p.levels[sl.levelId]?.name}</p>
          <LengthField label="Thickness" value={sl.thickness ?? p.levels[sl.levelId].slabThickness} min={0.03} onCommit={(v) => void s.edit('Slab thickness', (d) => void (d.slabs[sl.id].thickness = v), 'slab-th' + sl.id)} />
          <LengthField label="Top offset" value={sl.topOffset} onCommit={(v) => void s.edit('Slab offset', (d) => void (d.slabs[sl.id].topOffset = v), 'slab-off' + sl.id)} />
          <MaterialSelect label="Top" value={sl.topMaterialId} onChange={(id) => s.edit('Slab material', (d) => void (d.slabs[sl.id].topMaterialId = id))} />
          <MaterialSelect label="Edge" value={sl.sideMaterialId} onChange={(id) => s.edit('Slab material', (d) => void (d.slabs[sl.id].sideMaterialId = id))} />
          {actions}
        </>
      );
    }

    if (sel.kind === 'room') {
      const r = p.rooms[sel.id];
      if (!r) return null;
      return (
        <>
          <h4>{r.name}</h4>
          <p className="note">{r.kind} · {p.levels[r.levelId]?.name}</p>
          <TextField label="Name" value={r.name} onCommit={(v) => s.edit('Rename room', (d) => void (d.rooms[r.id].name = v))} />
          <MaterialSelect label="Floor" value={r.floorMaterialId} onChange={(id) => s.edit('Floor material', (d) => void (d.rooms[r.id].floorMaterialId = id))} />
          <MaterialSelect label="Ceiling" value={r.ceilingMaterialId} onChange={(id) => s.edit('Ceiling material', (d) => void (d.rooms[r.id].ceilingMaterialId = id))} />
          <Check label="Show ceiling" checked={r.showCeiling} onChange={(x) => s.edit('Ceiling', (d) => void (d.rooms[r.id].showCeiling = x))} />
          <RoomWalls roomId={r.id} />
        </>
      );
    }

    if (sel.kind === 'roof') {
      const r = p.roofs[sel.id];
      if (!r) return null;
      return (
        <>
          <h4>{r.name ?? 'Roof'}</h4>
          <p className="note">{r.kind} · ridge along {r.ridgeAxis.toUpperCase()}</p>
          <label className="field">
            <span>Pitch (rise / 12)</span>
            <input type="number" min={0.5} max={18} step={0.5} value={Math.round(r.pitch * 12 * 10) / 10} onChange={(e) => s.edit('Roof pitch', (d) => void (d.roofs[r.id].pitch = Math.max(0.04, Number(e.target.value) / 12)), 'roof-p' + r.id)} />
          </label>
          <LengthField label="Eave overhang" value={r.eaveOverhang} min={0} onCommit={(v) => void s.edit('Overhang', (d) => void (d.roofs[r.id].eaveOverhang = v), 'roof-e' + r.id)} />
          <LengthField label="Rake overhang" value={r.rakeOverhang} min={0} onCommit={(v) => void s.edit('Overhang', (d) => void (d.roofs[r.id].rakeOverhang = v), 'roof-r' + r.id)} />
          <MaterialSelect label="Roofing" value={r.materialId} onChange={(id) => s.edit('Roof material', (d) => void (d.roofs[r.id].materialId = id))} />
        </>
      );
    }

    if (sel.kind === 'stair') {
      const st = p.stairs[sel.id];
      if (!st) return null;
      return (
        <>
          <h4>{st.name ?? 'Stair'}</h4>
          <p className="note">U-shaped with a landing, serving {st.levelIds.map((id) => p.levels[id]?.name).join(' → ')}.</p>
          <IntField label="Risers per flight" value={st.risersPerFlight} min={4} max={14} onCommit={(v) => s.edit('Stair risers', (d) => void (d.stairs[st.id].risersPerFlight = v), 'stair-r')} />
          <LengthField label="Tread depth" value={st.treadDepth} min={0.2} onCommit={(v) => void s.edit('Stair tread', (d) => void (d.stairs[st.id].treadDepth = v), 'stair-t')} />
          <LengthField label="Lane width" value={st.laneWidth} min={0.6} onCommit={(v) => void s.edit('Stair width', (d) => void (d.stairs[st.id].laneWidth = v), 'stair-w')} />
          <MaterialSelect label="Material" value={st.materialId} onChange={(id) => s.edit('Stair material', (d) => void (d.stairs[st.id].materialId = id))} />
          <p className="note">Floor openings above the stair are separate slab holes. Resizing the stair does not resize them.</p>
        </>
      );
    }
    return null;
  }
}

void FT;

/** Paint every wall face that looks into this room, or grab those walls for more edits. */
function RoomWalls({ roomId }: { roomId: string }) {
  const s = useApp();
  const p = s.hist.project;
  const r = p.rooms[roomId];
  if (!r) return null;
  const list = wallsOfRoom(p, r);
  const faces = list.flatMap((g) => {
    const w = p.walls[g.id];
    const sg = sideFacingRoom(w, r);
    return sg ? [{ id: w.id, side: sg === 1 ? 'A' : 'B' }] : [];
  });
  return (
    <>
      {faces.length > 0 && (
        <BatchMaterial
          label="Walls in this room"
          values={faces.map((f) => (f.side === 'A' ? p.walls[f.id].finishA : p.walls[f.id].finishB))}
          onPick={(id) =>
            s.edit(`${r.name} walls`, (d) => {
              for (const f of faces) {
                const w = d.walls[f.id];
                if (!w || w.locked) continue;
                if (f.side === 'A') w.finishA = id;
                else w.finishB = id;
              }
            })
          }
        />
      )}
      <div className="actions">
        <button onClick={() => s.selectMany(list)} disabled={!list.length}>
          Select its {list.length} walls
        </button>
      </div>
    </>
  );
}
