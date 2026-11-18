import { useApp } from '../store/useApp';
import { useMemo, useState } from 'react';
import { sideFacingRoom, sideIsOutside, outsideWallsOnLevel, wallsOnLevel } from '../model/selectHelpers';
import type { Id, Project, Selection, Wall } from '../model/types';
import { useStore } from '../store/store';
import { LengthField } from './fields';
import { MaterialPicker, byName } from './MaterialPicker';

const NOUN: Record<string, [string, string]> = {
  wall: ['wall', 'walls'],
  furniture: ['piece', 'pieces'],
  opening: ['door or window', 'doors and windows'],
  room: ['room', 'rooms'],
  slab: ['slab', 'slabs'],
  roof: ['roof', 'roofs'],
  stair: ['stair', 'stairs'],
};

/** Pick one material for many faces at once. Shows the shared sample, or "Mixed". */
export function BatchMaterial({ label, values, onPick }: { label: string; values: Id[]; onPick: (id: Id) => void }) {
  return <MaterialPicker label={label} values={values} onChange={onPick} note={`${values.length} ${values.length === 1 ? 'face' : 'faces'}`} />;
}

/** For every selected wall, which faces are outside and which face rooms. */
function faces(p: Project, walls: Wall[]) {
  const out: { id: Id; side: 'A' | 'B' }[] = [];
  const inn: { id: Id; side: 'A' | 'B' }[] = [];
  for (const w of walls) {
    for (const [sg, side] of [[1, 'A'], [-1, 'B']] as const) (sideIsOutside(p, w, sg) ? out : inn).push({ id: w.id, side });
  }
  return { out, inn };
}

export function QuickSelect({ levelId }: { levelId: Id }) {
  const s = useApp();
  const p = s.hist.project;
  const lv = p.levels[levelId]?.name ?? 'this floor';
  return (
    <div className="quick">
      <span>Select on {lv}</span>
      <div>
        <button className="mini" onClick={() => s.selectMany(wallsOnLevel(p, levelId))}>All walls</button>
        <button className="mini" onClick={() => s.selectMany(outsideWallsOnLevel(p, levelId))}>Outside walls</button>
      </div>
    </div>
  );
}

export function GroupCard() {
  const s = useApp();
  const p = s.hist.project;
  const group = s.group;
  const [, force] = useState(0);
  const byKind = useMemo(() => {
    const m: Record<string, Selection[]> = {};
    for (const g of group) (m[g.kind] ??= []).push(g);
    return m;
  }, [group]);
  const walls = (byKind.wall ?? []).map((g) => p.walls[g.id]).filter(Boolean) as Wall[];
  const { out, inn } = useMemo(() => faces(p, walls), [p, walls]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = Object.entries(byKind)
    .map(([k, l]) => `${l.length} ${NOUN[k]?.[l.length === 1 ? 0 : 1] ?? k}`)
    .join(', ');
  const fin = (list: { id: Id; side: 'A' | 'B' }[]) => list.map((f) => (f.side === 'A' ? p.walls[f.id].finishA : p.walls[f.id].finishB));
  const paint = (label: string, list: { id: Id; side: 'A' | 'B' }[], id: Id) =>
    s.edit(label, (d) => {
      for (const f of list) {
        const w = d.walls[f.id];
        if (!w || w.locked) continue;
        if (f.side === 'A') w.finishA = id;
        else w.finishB = id;
      }
    });
  const eachWall = (label: string, fn: (w: Wall) => void, key?: string) =>
    s.edit(label, (d) => {
      for (const w0 of walls) {
        const w = d.walls[w0.id];
        if (w && !w.locked) fn(w);
      }
    }, key);
  const rooms = Object.values(p.rooms).filter((r) => r.levelId === walls[0]?.levelId).sort(byName);
  const [roomId, setRoomId] = useState('');
  const room = rooms.find((r) => r.id === roomId);
  const roomFaces = room
    ? walls.flatMap((w) => {
        const sg = sideFacingRoom(w, room);
        return sg ? [{ id: w.id, side: (sg === 1 ? 'A' : 'B') as 'A' | 'B' }] : [];
      })
    : [];
  const locked = walls.filter((w) => w.locked).length;

  return (
    <>
      <h4>{group.length} selected</h4>
      <p className="note">{summary}. Shift-click to add or remove.</p>
      {walls.length > 0 && (
        <>
          {out.length > 0 && <BatchMaterial label="Outside faces" values={fin(out)} onPick={(id) => paint('Outside finish', out, id)} />}
          {inn.length > 0 && <BatchMaterial label="Room faces" values={fin(inn)} onPick={(id) => paint('Room finish', inn, id)} />}
          {rooms.length > 0 && (
            <label className="field">
              <span>Only faces into one room</span>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Choose a room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {room && (roomFaces.length ? <BatchMaterial label={`${room.name} faces`} values={fin(roomFaces)} onPick={(id) => paint(`${room.name} walls`, roomFaces, id)} /> : <p className="note">None of the selected walls face {room.name}.</p>)}
          <BatchMaterial label="Top cap" values={walls.map((w) => w.capMaterialId)} onPick={(id) => eachWall('Wall cap', (w) => void (w.capMaterialId = id))} />
          <div className="two">
            <LengthField label="Thickness" value={walls[0].thickness} min={0.02} onCommit={(v) => (eachWall('Wall thickness', (w) => void (w.thickness = v), 'grp-th'), force((n) => n + 1), [])} />
            <LengthField label="Height" value={walls[0].height ?? p.levels[walls[0].levelId].ceilingHeight} min={0.3} onCommit={(v) => (eachWall('Wall height', (w) => void ((w.height = v), (w.topLevelId = undefined)), 'grp-h'), [])} />
          </div>
          {locked > 0 && <p className="note">{locked} locked wall{locked > 1 ? 's are' : ' is'} skipped.</p>}
          <QuickSelect levelId={walls[0].levelId} />
        </>
      )}
      <div className="actions">
        <button onClick={() => s.edit('Toggle lock', (d) => { for (const g of group) { const e = (d as any)[g.kind === 'furniture' ? 'furniture' : g.kind + 's']?.[g.id]; if (e && ['wall', 'opening', 'furniture'].includes(g.kind)) e.locked = !e.locked; } })}>Lock / unlock</button>
        <button onClick={() => s.select(null)}>Clear</button>
        <button className="danger" onClick={s.deleteSelected}>
          Delete all
        </button>
      </div>
    </>
  );
}
