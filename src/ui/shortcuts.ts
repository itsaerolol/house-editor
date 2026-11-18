import { useEffect } from 'react';
import { useStore } from '../store/store';

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const walking = s.hist.project.view.mode === 'walk';
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (walking) return;
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelected();
        return;
      }
      if (e.key === 'Escape') {
        s.cancel();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection) {
          e.preventDefault();
          s.deleteSelected();
        }
        return;
      }
      if (mod || e.altKey) return;
      const k = e.key.toLowerCase();
      const sel = s.selection;
      if ((k === 'q' || k === 'e' || k === 'r') && s.placing) {
        const step = (s.hist.project.view.rotationSnap * Math.PI) / 180;
        useStore.setState({ placing: { ...s.placing, rotationY: s.placing.rotationY + (k === 'q' ? -step : step) } });
        return;
      }
      if ((k === 'q' || k === 'e' || k === 'r') && sel?.kind === 'furniture') {
        const f = s.hist.project.furniture[sel.id];
        if (!f) return;
        const step = (s.hist.project.view.rotationSnap * Math.PI) / 180;
        s.rotateFurniture(sel.id, f.rotationY + (k === 'q' ? -step : step), 'rot-key');
        return;
      }
      const modes = { '1': 'front', '2': 'back', '3': 'left', '4': 'right', '5': 'top', '6': 'bottom', '7': 'iso', '8': 'plan', '9': 'persp' } as const;
      if (k in modes) {
        s.setView({ mode: modes[k as keyof typeof modes] });
        return;
      }
      if (k === 'v') s.setTool('select');
      else if (k === 'w') s.setTool('wall');
      else if (k === 'g') s.setView({ showGrid: !s.hist.project.view.showGrid });
      else if (k === 'f' && s.selection) s.resetView();
      else if (k === '?') s.setDialog('help');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
