import { useEffect } from 'react';
import { store } from '../state/store';
import { getDef } from '../data/catalog';
import { clampToRoom } from '../logic/geometry';

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

/** Planner shortcuts. Ignored while typing in a field or when a dialog is open. */
export function useKeyboard() {
  useEffect(() => {
    let nudging = false;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = store.getState();
      if (s.exportOpen) return;
      const mod = e.metaKey || e.ctrlKey;
      const sel = s.items.find((i) => i.id === s.selectedId);
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && k === 'd' && sel) {
        e.preventDefault();
        s.duplicate(sel.id);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        s.removeItem(sel.id);
      } else if (k === 'r' && !mod && sel) {
        s.rotateBy(sel.id, (e.shiftKey ? -1 : 1) * (e.altKey ? Math.PI / 12 : Math.PI / 4));
      } else if (e.key === 'Escape') {
        if (s.costOpen) s.setCostOpen(false);
        else s.select(null);
      } else if (k === 'f' && !mod) {
        s.toggleEgress();
      } else if (k === 'v' && !mod) {
        s.setView(s.view === '3d' ? 'plan' : '3d');
      } else if (!mod && (k === '1' || k === '2' || k === '3')) {
        s.setView(k === '1' ? 'plan' : k === '2' ? 'split' : '3d');
      } else if (sel && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dz = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (!nudging) {
          s.beginEdit();
          nudging = true;
        }
        const p = clampToRoom(s.room, getDef(sel.type), sel.x + dx, sel.z + dz, sel.rot);
        s.moveItem(sel.id, +p.x.toFixed(3), +p.z.toFixed(3));
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (nudging && e.key.startsWith('Arrow')) {
        nudging = false;
        store.getState().commitEdit();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  }, []);
}
