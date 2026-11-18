import { useEffect, useState } from 'react';
import { formatLength, parseLength, radToDeg } from '../model/units';
import { useStore } from '../store/store';
import type { Id } from '../model/types';
import { MaterialPicker } from './MaterialPicker';

type Commit = (v: number) => string[] | void;

/** Text field for a length in meters, shown in the project's units. Shows validation errors inline. */
export function LengthField({ label, value, onCommit, min, title }: { label: string; value: number; onCommit: Commit; min?: number; title?: string }) {
  const units = useStore((s) => s.hist.project.view.units);
  const [text, setText] = useState(formatLength(value, units));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setText(formatLength(value, units));
    setErr(null);
  }, [value, units]);
  const apply = () => {
    const v = parseLength(text, units);
    if (v === null) {
      setErr(`Can't read "${text}". Try 12' 6", 3.2 m or 150 cm.`);
      return;
    }
    if (min !== undefined && v < min) {
      setErr(`Must be at least ${formatLength(min, units)}.`);
      return;
    }
    const r = onCommit(v);
    if (r && r.length) setErr(r[0]);
    else setErr(null);
  };
  return (
    <label className="field" title={title}>
      <span>{label}</span>
      <input
        className={err ? 'bad' : ''}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setText(formatLength(value, units));
            setErr(null);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {err && <em className="err">{err}</em>}
    </label>
  );
}

export function AngleField({ label, value, onCommit }: { label: string; value: number; onCommit: (rad: number) => void }) {
  const deg = Math.round(radToDeg(value) * 10) / 10;
  const [text, setText] = useState(String(deg));
  useEffect(() => setText(String(deg)), [deg]);
  const apply = () => {
    const v = parseFloat(text);
    if (Number.isFinite(v)) onCommit((v * Math.PI) / 180);
    else setText(String(deg));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <input value={text} onChange={(e) => setText(e.target.value)} onBlur={apply} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  );
}

export function IntField({ label, value, min = 0, max = 99, onCommit }: { label: string; value: number; min?: number; max?: number; onCommit: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onCommit(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || 0))))} />
    </label>
  );
}

export function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onCommit(text)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  );
}

/** Kept for existing call sites: the field is now the image picker. */
export function MaterialSelect({ label, value, onChange, kinds }: { label: string; value: Id; onChange: (id: Id) => void; kinds?: string[] }) {
  return <MaterialPicker label={label} value={value} onChange={onChange} kinds={kinds} />;
}

export function Check({ label, checked, onChange, title }: { label: string; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="check" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
