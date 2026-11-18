import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/store';
import { bootLibrary, closeHome, copyEntry, createProject, exportEntry, importFiles, openProject, removeEntry, renameEntry, useHome } from '../store/projects';
import type { LibraryEntry } from '../store/library';

const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : new Date(t).toLocaleDateString();
};

const P = {
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  open: 'M12 4v12m0 0 4-4m-4 4-4-4M5 20h14',
};
const Ico = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

function ItemMenu({ e, onRename, className = '' }: { e: LibraryEntry; onRename: () => void; className?: string }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const off = (ev: PointerEvent) => {
      if (!wrap.current?.contains(ev.target as Node)) {
        setMenu(false);
        setConfirm(false);
      }
    };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [menu]);
  return (
    <div className={'itemmenu ' + className} ref={wrap}>
      <button className="hcard-more" onClick={() => (setMenu(!menu), setConfirm(false))} aria-label={`Options for ${e.name}`} aria-expanded={menu}>
        <Ico d={P.more} />
      </button>
      {menu && (
        <div className="hmenu" role="menu">
          {!confirm ? (
            <>
              <button role="menuitem" onClick={() => (setMenu(false), onRename())}>
                Rename
              </button>
              <button role="menuitem" onClick={() => (setMenu(false), void copyEntry(e.id))}>
                Duplicate
              </button>
              <button role="menuitem" onClick={() => (setMenu(false), void exportEntry(e.id))}>
                Export file
              </button>
              <button role="menuitem" className="danger" onClick={() => setConfirm(true)}>
                Delete
              </button>
            </>
          ) : (
            <>
              <p>Delete "{e.name}" for good?</p>
              <button role="menuitem" className="danger solid" onClick={() => (setMenu(false), setConfirm(false), void removeEntry(e.id))}>
                Delete
              </button>
              <button role="menuitem" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NameField({ e, value, setValue, className }: { e: LibraryEntry; value: string; setValue: (v: string | null) => void; className: string }) {
  return (
    <input
      className={className}
      autoFocus
      value={value}
      maxLength={60}
      aria-label="House name"
      onChange={(ev) => setValue(ev.target.value)}
      onFocus={(ev) => ev.target.select()}
      onBlur={() => {
        void renameEntry(e.id, value);
        setValue(null);
      }}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
        if (ev.key === 'Escape') setValue(null);
      }}
    />
  );
}

function Card({ e, i }: { e: LibraryEntry; i: number }) {
  const [rename, setRename] = useState<string | null>(null);
  return (
    <div className="hcard" style={{ animationDelay: `${50 + i * 45}ms` }}>
      <button className="hcard-open" onClick={() => openProject(e.id)} aria-label={`Open ${e.name}`}>
        <span className="hcard-art">{e.thumb ? <img src={e.thumb} alt="" draggable={false} /> : <i />}</span>
      </button>
      <div className="hcard-info">
        {rename === null ? (
          <button className="hcard-name" onClick={() => openProject(e.id)}>
            {e.name}
          </button>
        ) : (
          <NameField e={e} value={rename} setValue={setRename} className="hcard-rename" />
        )}
        <small>
          {e.rooms ? `${e.rooms} rooms · ` : ''}
          {e.items} items · {ago(e.updatedAt)}
        </small>
      </div>
      <ItemMenu e={e} onRename={() => setRename(e.name)} className="in-card" />
    </div>
  );
}

export function Home() {
  const { open, items, ready, busy } = useHome();
  // the open house shows at once from the live project; the library fills in its picture and timestamp
  const live = useStore(
    useShallow((s) => {
      const p = s.hist.project;
      return open ? { id: p.id, name: p.name, rooms: Object.keys(p.rooms).length, items: Object.keys(p.furniture).length } : null;
    }),
  );
  const curId = live?.id;
  const file = useRef<HTMLInputElement>(null);
  const [heroName, setHeroName] = useState<string | null>(null);
  useEffect(() => void bootLibrary(), []);
  useEffect(() => {
    if (!open) return;
    const k = (ev: KeyboardEvent) => ev.key === 'Escape' && closeHome();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;
  const cur: LibraryEntry | undefined = items.find((i) => i.id === curId) ?? (live ? { ...live, createdAt: Date.now(), updatedAt: Date.now(), thumb: null } : undefined);
  const rest = items.filter((i) => i.id !== curId);
  return (
    <main className="home" aria-label="Your houses" aria-busy={busy}>
      <div className="home-scroll">
        <header className="home-head">
          <span className="home-mark" aria-hidden>
            <Ico d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6" size={22} />
          </span>
          <div>
            <h1>Farmhouse</h1>
            <small>Saved on this device. Works offline.</small>
          </div>
          <button className="home-import" onClick={() => file.current?.click()}>
            <Ico d={P.open} size={18} /> Import
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            multiple
            hidden
            onChange={(ev) => {
              const f = ev.target.files;
              if (f?.length) void importFiles(f);
              ev.target.value = '';
            }}
          />
        </header>

        {cur && (
          <section className="home-hero" aria-label="Continue">
            <button className="hero-art" onClick={closeHome} aria-label={`Continue ${cur.name}`}>
              {cur.thumb ? <img src={cur.thumb} alt="" draggable={false} /> : <i />}
            </button>
            <div className="hero-info">
              <small>Continue</small>
              {heroName === null ? <h2>{cur.name}</h2> : <NameField e={cur} value={heroName} setValue={setHeroName} className="hero-rename" />}
              <p>
                {cur.rooms ? `${cur.rooms} rooms · ` : ''}
                {cur.items} items · {ago(cur.updatedAt)}
              </p>
              <div className="hero-actions">
                <button className="go" onClick={closeHome}>
                  Continue
                </button>
                <ItemMenu e={cur} onRename={() => setHeroName(cur.name)} className="in-hero" />
              </div>
            </div>
          </section>
        )}

        <h3 className="home-sub">{rest.length ? 'Your houses' : 'Start something new'}</h3>
        <div className="home-grid">
          <div className="hcard new" style={{ animationDelay: '50ms' }}>
            <span className="new-ico" aria-hidden>
              <Ico d={P.plus} size={24} />
            </span>
            <b>New house</b>
            <div className="new-opts">
              <button disabled={busy} onClick={() => void createProject('starter')}>
                Starter farmhouse
              </button>
              <button disabled={busy} onClick={() => void createProject('blank')}>
                Blank lot
              </button>
            </div>
          </div>
          {rest.map((e, i) => (
            <Card key={e.id} e={e} i={i + 1} />
          ))}
        </div>
        {!ready && <p className="home-note">Loading your houses…</p>}
        <p className="home-note">Changes save as you work. Export a file to back up a house or move it to another device.</p>
      </div>
    </main>
  );
}
