import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

const toasts = createStore<{ list: Toast[] }>(() => ({ list: [] }));
let n = 0;

export const toast = (text: string, action?: Toast['action'], ms = 4200) => {
  const id = ++n;
  toasts.setState((s) => ({ list: [...s.list.slice(-2), { id, text, action }] }));
  window.setTimeout(() => dismissToast(id), ms);
};

export const dismissToast = (id: number) => toasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) }));

export const useToasts = () => useStore(toasts, (s) => s.list);
