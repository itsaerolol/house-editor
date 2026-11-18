import { useApp } from '../store/useApp';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';

/** Keeps the last dialog mounted for the 180 ms exit so close is never an instant cut. Input stays live; a reopen cancels the exit. */
function useExit<T>(value: T | null, ms = 180): { shown: T | null; closing: boolean } {
  const last = useRef<T | null>(value);
  const [closing, setClosing] = useState(false);
  if (value !== null) last.current = value;
  useEffect(() => {
    if (value !== null) return setClosing(false);
    if (last.current === null) return;
    setClosing(true);
    const t = setTimeout(() => {
      last.current = null;
      setClosing(false);
    }, ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return { shown: value ?? last.current, closing: value === null && last.current !== null };
}

export function Dialogs() {
  const s = useApp();
  const { shown, closing } = useExit(s.dialog);
  const toastEls = s.toasts;
  useEffect(() => {
    if (!s.dialog) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        s.setDialog(null);
      }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [s.dialog]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="toasts" aria-live="polite">
        {toastEls.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => s.dismissToast(t.id)}>
            {t.text}
          </div>
        ))}
      </div>
      {shown && (
        <div className="scrim" data-state={closing ? 'closing' : 'open'} onMouseDown={(e) => e.target === e.currentTarget && s.setDialog(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
            {shown === 'reset' && (
              <>
                <h3 id="dlg-title">Reset to the starter house?</h3>
                <p>This puts the starter house back in this slot and clears undo history. Export first if you want to keep your version.</p>
                <div className="actions">
                  <button onClick={() => s.setDialog(null)} autoFocus>
                    Cancel
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      s.setDialog(null);
                      s.resetToStarter();
                    }}
                  >
                    Reset project
                  </button>
                </div>
              </>
            )}
            {shown === 'import-error' && (
              <>
                <h3 id="dlg-title">That file can't be imported</h3>
                <p>The current project was not changed.</p>
                <ul className="errs">
                  {s.importErrors.slice(0, 14).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {s.importErrors.length > 14 && <li>...and {s.importErrors.length - 14} more.</li>}
                </ul>
                <div className="actions">
                  <button onClick={() => s.setDialog(null)} autoFocus>
                    Close
                  </button>
                </div>
              </>
            )}
            {shown === 'export' && (
              <>
                <h3 id="dlg-title">Export image</h3>
                <p>Saves the current view as a PNG.</p>
                <div className="actions">
                  {[1, 2, 3].map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        s.setDialog(null);
                        s.requestExport(k);
                      }}
                    >
                      {k}x
                    </button>
                  ))}
                  <button onClick={() => s.setDialog(null)}>Cancel</button>
                </div>
              </>
            )}
            {shown === 'help' && <Help close={() => s.setDialog(null)} />}
          </div>
        </div>
      )}
    </>
  );
}

function Help({ close }: { close: () => void }) {
  return (
    <>
      <h3 id="dlg-title">Controls</h3>
      <div className="help">
        <section>
          <h5>Touch</h5>
          <p>One finger drags the view. Pinch zooms, two fingers slide the view. Tap to select; drag a selected piece to move it, twist two fingers to turn it. Double-tap empty ground to frame the house.</p>
          <p>Walk: left thumb walks (push to the edge to run), right side looks, tap selects.</p>
        </section>
        <section>
          <h5>Modes</h5>
          <p>X Explore · B Build · C Decorate · P Walk. The shelf at the bottom changes with the mode.</p>
        </section>
        <section>
          <h5>Views</h5>
          <p>1-6 Front / Back / Left / Right / Top / Under · 7 Iso · 8 Plan · 9 3D · F frame. Floor buttons on the left switch floors; tap the active one to isolate it.</p>
          <p>Flat views: wheel zooms at the cursor, drag pans. Iso and 3D: left-drag orbits, right-drag pans.</p>
        </section>
        <section>
          <h5>Editing</h5>
          <p>V select · W draw walls · click to start, click to end, Esc stops</p>
          <p>Shift or Ctrl click adds to the selection. Edit many walls at once, or pick a room and use Select its walls.</p>
          <p>Drag furniture to move. Orange handles resize and rotate. Q / E rotate by the snap angle.</p>
          <p>Ctrl+D duplicate · Delete removes · Esc cancels placement · Ctrl+Z / Ctrl+Shift+Z undo / redo</p>
          <p>Door / Window tools: hover a wall, click to place. Invalid spots show red.</p>
        </section>
        <section>
          <h5>Walkthrough</h5>
          <p>Click to capture the mouse · W A S D move · Shift run · Space jump · R reset · Esc release.</p>
        </section>
      </div>
      <div className="actions">
        <button onClick={close} autoFocus>
          Close
        </button>
      </div>
    </>
  );
}
