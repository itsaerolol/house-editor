import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Id, MaterialDefinition } from '../model/types';
import { useStore } from '../store/store';
import { SWATCHES } from './swatches';

const KIND: Record<string, string> = { paint: 'Paint', wood: 'Wood', tile: 'Tile', stone: 'Stone', metal: 'Metal', glass: 'Glass', fabric: 'Fabric', roof: 'Roofing', siding: 'Siding', ground: 'Ground', foliage: 'Foliage', concrete: 'Concrete', light: 'Light' };

/** A material's sample image (real texture tile), or its colour if no chip was rendered. */
export function Chip({ m, size = 28 }: { m: MaterialDefinition | undefined; size?: number }) {
  const src = m ? SWATCHES[m.id] : undefined;
  return src ? (
    <img className="chip" src={src} width={size} height={size} alt="" draggable={false} />
  ) : (
    <i className="chip" style={{ width: size, height: size, background: m?.color ?? '#777' }} />
  );
}

export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

/**
 * Material field: shows the sample and name; opens a searchable, alphabetical list of samples.
 * `values` (several faces at once) shows "Mixed" when they differ.
 */
export function MaterialPicker({ label, value, values, onChange, kinds, note }: { label: string; value?: Id; values?: Id[]; onChange: (id: Id) => void; kinds?: string[]; note?: string }) {
  const mats = useStore((s) => s.hist.project.materials);
  const ids = values ?? (value ? [value] : []);
  const uniq = [...new Set(ids)];
  const current = uniq.length === 1 ? mats[uniq[0]] : undefined;
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const lid = useId();
  return (
    <div className="field">
      <span id={lid + 'l'}>
        {label}
        {note && <small className="count"> {note}</small>}
      </span>
      <button ref={btn} type="button" className="mpick" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={lid + 'l'} onClick={() => setOpen(!open)}>
        {current ? (
          <Chip m={current} />
        ) : (
          <span className="chip-stack">
            {uniq.slice(0, 3).map((id) => (
              <Chip key={id} m={mats[id]} size={22} />
            ))}
          </span>
        )}
        <span className="mpick-name">{current ? current.name : uniq.length ? 'Mixed' : 'Choose'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <PickerList
          anchor={btn.current!}
          list={Object.values(mats).filter((m) => (!kinds || kinds.includes(m.kind) || uniq.includes(m.id)) && m.kind !== 'light')}
          selected={new Set(uniq)}
          onPick={(id) => {
            onChange(id);
            setOpen(false);
            btn.current?.focus();
          }}
          onClose={() => {
            setOpen(false);
            btn.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function PickerList({ anchor, list, selected, onPick, onClose }: { anchor: HTMLElement; list: MaterialDefinition[]; selected: Set<Id>; onPick: (id: Id) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const items = useMemo(() => list.filter((m) => !needle || m.name.toLowerCase().includes(needle) || (KIND[m.kind] ?? '').toLowerCase().includes(needle)).sort(byName), [list, needle]);
  const [hi, setHi] = useState(() => Math.max(0, items.findIndex((m) => selected.has(m.id))));
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxH: number; up: boolean } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const width = Math.max(r.width, 300);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 320 && above > below;
    setPos({ left: Math.min(r.left, window.innerWidth - width - 12), top: up ? r.top - 6 : r.bottom + 6, width, maxH: Math.min(420, up ? above : below), up });
  }, [anchor]);
  const first = useRef(true);
  useEffect(() => {
    // typing resets the highlight to the best match; on open it stays on the current material
    if (first.current) {
      first.current = false;
      return;
    }
    setHi(0);
  }, [needle]);
  useEffect(() => {
    const ul = listRef.current;
    const li = ul?.querySelector<HTMLElement>(`[data-i="${hi}"]`);
    if (ul && li) {
      if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop - 4;
      else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight + 4;
    }
  }, [hi, pos]);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', down, true);
    return () => window.removeEventListener('mousedown', down, true);
  }, [anchor, onClose]);
  if (!pos) return null;
  return createPortal(
    <div
      ref={panel}
      className={'mlist' + (pos.up ? ' up' : '')}
      style={{ left: pos.left, top: pos.up ? undefined : pos.top, bottom: pos.up ? window.innerHeight - pos.top : undefined, width: pos.width, maxHeight: pos.maxH }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHi((h) => Math.min(items.length - 1, h + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHi((h) => Math.max(0, h - 1));
        } else if (e.key === 'Enter' && items[hi]) {
          e.preventDefault();
          onPick(items[hi].id);
        }
      }}
    >
      <input className="mlist-find" autoFocus placeholder="Search materials" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search materials" />
      <ul ref={listRef} role="listbox" aria-label="Materials">
        {items.map((m, i) => (
          <li key={m.id} data-i={i} role="option" aria-selected={selected.has(m.id)} className={(i === hi ? 'hi ' : '') + (selected.has(m.id) ? 'on' : '')} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(m.id)}>
            <Chip m={m} size={40} />
            <span>
              <b>{m.name}</b>
              <small>{KIND[m.kind] ?? m.kind}</small>
            </span>
            {selected.has(m.id) && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12 5 5 9-10" />
              </svg>
            )}
          </li>
        ))}
        {!items.length && <li className="none">No material matches "{q}".</li>}
      </ul>
    </div>,
    document.body,
  );
}
