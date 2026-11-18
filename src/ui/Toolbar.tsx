import { useRef } from 'react';
import { serializeProject } from '../model/serialize';
import { useStore } from '../store/store';
import type { IsoCorner, ViewMode } from '../model/types';
import { ISO_CORNERS } from '../viewport/cameraViews';

const FLAT: { id: ViewMode; label: string; key: string }[] = [
  { id: 'front', label: 'Front', key: '1' },
  { id: 'back', label: 'Back', key: '2' },
  { id: 'left', label: 'Left', key: '3' },
  { id: 'right', label: 'Right', key: '4' },
  { id: 'top', label: 'Top', key: '5' },
  { id: 'bottom', label: 'Bottom', key: '6' },
];

export function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function Toolbar() {
  const s = useStore();
  const p = s.hist.project;
  const v = p.view;
  const file = useRef<HTMLInputElement>(null);
  const modeBtn = (id: ViewMode, label: string, key?: string) => (
    <button key={id} className={v.mode === id ? 'on' : ''} onClick={() => s.setView({ mode: id })} title={key ? `${label} (${key})` : label}>
      {label}
    </button>
  );
  return (
    <header className="toolbar">
      <div className="brand">
        <b>Farmhouse</b>
        <span>Editor</span>
      </div>
      <div className="group" role="group" aria-label="Orthographic views">
        {FLAT.map((f) => modeBtn(f.id, f.label, f.key))}
      </div>
      <div className="group" role="group" aria-label="3D views">
        {modeBtn('iso', 'Iso', '7')}
        {modeBtn('plan', 'Plan', '8')}
        {modeBtn('persp', '3D', '9')}
        <button className={v.mode === 'walk' ? 'on walk' : 'walk'} onClick={() => s.setView({ mode: 'walk' })} title="First-person walkthrough">
          Walk
        </button>
      </div>
      {v.mode === 'iso' && (
        <div className="group" role="group" aria-label="Isometric corner">
          {(Object.keys(ISO_CORNERS) as IsoCorner[]).map((c) => (
            <button key={c} className={v.isoCorner === c ? 'on' : ''} onClick={() => s.setView({ isoCorner: c })} title={ISO_CORNERS[c].label}>
              {ISO_CORNERS[c].label.replace('Front', 'F').replace('Back', 'B').replace('-left', 'L').replace('-right', 'R')}
            </button>
          ))}
        </div>
      )}
      <div className="group" role="group" aria-label="Tools">
        <button className={s.tool === 'select' ? 'on' : ''} onClick={() => s.setTool('select')} title="Select / move (V)">
          Select
        </button>
        <button className={s.tool === 'wall' ? 'on' : ''} onClick={() => s.setTool('wall')} title="Draw walls (W)">
          Wall
        </button>
        <button className={s.tool === 'door' ? 'on' : ''} onClick={() => s.setTool('door')} title="Place a door on a wall">
          Door
        </button>
        <button className={s.tool === 'window' ? 'on' : ''} onClick={() => s.setTool('window')} title="Place a window on a wall">
          Window
        </button>
      </div>
      <div className="group" role="group" aria-label="History">
        <button disabled={!s.hist.past.length} onClick={s.undo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button disabled={!s.hist.future.length} onClick={s.redo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
      </div>
      <div className="spacer" />
      <div className="group" role="group" aria-label="Quality">
        {(['high', 'medium', 'low'] as const).map((q) => (
          <button key={q} className={v.quality === q ? 'on' : ''} onClick={() => s.setView({ quality: q })} title={`Render quality: ${q}`}>
            {q[0].toUpperCase() + q.slice(1)}
          </button>
        ))}
      </div>
      <div className="group" role="group" aria-label="Units">
        <button className={v.units === 'imperial' ? 'on' : ''} onClick={() => s.setView({ units: 'imperial' })}>
          ft-in
        </button>
        <button className={v.units === 'metric' ? 'on' : ''} onClick={() => s.setView({ units: 'metric' })}>
          m
        </button>
      </div>
      <div className="group" role="group" aria-label="File">
        <button onClick={() => download(`${p.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, serializeProject(p))} title="Export project JSON">
          Export
        </button>
        <button onClick={() => file.current?.click()} title="Import project JSON">
          Import
        </button>
        <button onClick={() => s.setDialog('export')} title="Export the current view as a PNG">
          Image
        </button>
        <button className="danger" onClick={() => s.setDialog('reset')} title="Reset to the starter house">
          Reset
        </button>
        <button onClick={() => s.setDialog('help')} title="Controls (?)">
          ?
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          s.loadText(await f.text());
        }}
      />
    </header>
  );
}
