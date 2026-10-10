import { createStore } from 'zustand/vanilla';
import { useStore as useZustand } from 'zustand';
import type { CostTier, Exit, FloorFinish, LayoutSnapshot, PlacedItem, Room, TemplateId, ViewMode } from '../types';
import { TEMPLATES } from '../data/templates';
import { getDef, SETS } from '../data/catalog';
import { clampToRoom, findFreeSpot } from '../logic/geometry';

export interface PlannerState {
  templateId: TemplateId;
  projectName: string;
  room: Room;
  items: PlacedItem[];
  brand: string;
  staff: number;
  sprinklered: boolean;
  view: ViewMode;
  showEgress: boolean;
  costOpen: boolean;
  costTier: CostTier;
  selectedId: string | null;
  snap: boolean;
  exportOpen: boolean;
  /** Bumped when a template loads so the engine can play its build-in animation. */
  layoutEpoch: number;
  past: LayoutSnapshot[];
  future: LayoutSnapshot[];
}

export interface PlannerActions {
  loadTemplate: (id: TemplateId) => void;
  addItem: (type: string, at?: { x: number; z: number }) => string;
  addSet: (setId: string, at?: { x: number; z: number }) => void;
  /** Live move during a drag; call beginEdit() first and commitEdit() at the end. */
  moveItem: (id: string, x: number, z: number) => void;
  setRotation: (id: string, rot: number) => void;
  rotateBy: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  duplicate: (id: string) => void;
  select: (id: string | null) => void;
  beginEdit: () => void;
  commitEdit: () => void;
  undo: () => void;
  redo: () => void;
  setBrand: (hex: string) => void;
  setView: (v: ViewMode) => void;
  toggleEgress: (on?: boolean) => void;
  setCostOpen: (open: boolean) => void;
  setCostTier: (tier: CostTier) => void;
  setProjectName: (name: string) => void;
  setRoomSize: (width: number, depth: number) => void;
  setFloor: (floor: FloorFinish) => void;
  setFeatureWall: (on: boolean) => void;
  updateExit: (id: string, patch: Partial<Exit>) => void;
  addExit: () => void;
  removeExit: (id: string) => void;
  setStaff: (n: number) => void;
  setSprinklered: (on: boolean) => void;
  setSnap: (on: boolean) => void;
  setExportOpen: (open: boolean) => void;
}

export type Store = PlannerState & PlannerActions;

const STORAGE_KEY = 'fitout.layout.v1';
let uid = 0;
const newId = () => `i${Date.now().toString(36)}${(++uid).toString(36)}`;

const snapshot = (s: PlannerState): LayoutSnapshot => ({ room: s.room, items: s.items });

const fromTemplate = (id: TemplateId) => {
  const t = TEMPLATES[id];
  return {
    templateId: id,
    projectName: t.project,
    room: structuredClone(t.room),
    items: t.items.map((it) => ({ ...it, id: newId() })),
    brand: t.brand,
    staff: t.staff,
  };
};

const loadSaved = (): Partial<PlannerState> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !TEMPLATES[data.templateId as TemplateId] || !Array.isArray(data.items)) return null;
    const items = (data.items as PlacedItem[]).filter((it) => {
      try {
        getDef(it.type);
        return true;
      } catch {
        return false;
      }
    });
    return { ...data, items };
  } catch {
    return null;
  }
};

const saved = loadSaved();

export const store = createStore<Store>()((set, get) => {
  /** Record the current layout for undo, then apply a layout change. */
  const edit = (fn: (s: PlannerState) => Partial<PlannerState>) =>
    set((s) => ({ past: [...s.past.slice(-79), snapshot(s)], future: [], ...fn(s) }));

  let pending: LayoutSnapshot | null = null;

  return {
    ...fromTemplate('cafe'),
    sprinklered: true,
    // side-by-side plan and 3D needs room; phones start in 3D
    view: typeof window !== 'undefined' && window.innerWidth < 720 ? '3d' : 'split',
    showEgress: false,
    costOpen: false,
    costTier: 'standard',
    selectedId: null,
    snap: true,
    exportOpen: false,
    layoutEpoch: 0,
    past: [],
    future: [],
    ...(saved ?? {}),

    loadTemplate: (id) =>
      edit((s) => ({ ...fromTemplate(id), selectedId: null, layoutEpoch: s.layoutEpoch + 1 })),

    addItem: (type, at) => {
      const def = getDef(type);
      const { room, items } = get();
      const spot = at ? clampToRoom(room, def, at.x, at.z, 0) : findFreeSpot(room, items, def);
      const item: PlacedItem = { id: newId(), type, x: spot.x, z: spot.z, rot: spot.rot ?? 0 };
      edit((s) => ({ items: [...s.items, item], selectedId: item.id }));
      return item.id;
    },

    addSet: (setId, at) => {
      const set = SETS.find((x) => x.id === setId);
      if (!set) return;
      const { room, items } = get();
      const anchorDef = getDef(set.items[0].type);
      // Reserve space for the whole set by searching with an inflated footprint.
      const span = set.items.reduce(
        (acc, it) => {
          const d = getDef(it.type);
          const r = Math.max(d.w, d.d) / 2;
          return { w: Math.max(acc.w, Math.abs(it.x) * 2 + r * 2), d: Math.max(acc.d, Math.abs(it.z) * 2 + r * 2) };
        },
        { w: anchorDef.w, d: anchorDef.d },
      );
      const origin = at ?? findFreeSpot(room, items, { ...anchorDef, w: span.w, d: span.d });
      const created = set.items.map((it) => {
        const def = getDef(it.type);
        const p = clampToRoom(room, def, origin.x + it.x, origin.z + it.z, it.rot);
        return { id: newId(), type: it.type, x: p.x, z: p.z, rot: it.rot };
      });
      edit((s) => ({ items: [...s.items, ...created], selectedId: created[0].id }));
    },

    moveItem: (id, x, z) =>
      set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, x, z } : it)) })),

    setRotation: (id, rot) =>
      set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, rot } : it)) })),

    rotateBy: (id, delta) =>
      edit((s) => ({
        items: s.items.map((it) => {
          if (it.id !== id) return it;
          const def = getDef(it.type);
          const rot = normalizeAngle(it.rot + delta);
          const p = clampToRoom(s.room, def, it.x, it.z, rot);
          return { ...it, rot, x: p.x, z: p.z };
        }),
      })),

    removeItem: (id) =>
      edit((s) => ({ items: s.items.filter((it) => it.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),

    duplicate: (id) => {
      const src = get().items.find((it) => it.id === id);
      if (!src) return;
      const def = getDef(src.type);
      const { room } = get();
      const offset = Math.max(0.5, Math.min(def.w, 1.2) + 0.15);
      const p = clampToRoom(room, def, src.x + offset, src.z, src.rot);
      const copy = { ...src, id: newId(), x: p.x, z: p.z };
      edit((s) => ({ items: [...s.items, copy], selectedId: copy.id }));
    },

    select: (id) => set({ selectedId: id }),

    beginEdit: () => {
      pending = snapshot(get());
    },

    commitEdit: () => {
      const before = pending;
      pending = null;
      if (!before) return;
      const s = get();
      if (before.items === s.items && before.room === s.room) return;
      set({ past: [...s.past.slice(-79), before], future: [] });
    },

    undo: () => {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return;
      set({
        past: s.past.slice(0, -1),
        future: [snapshot(s), ...s.future].slice(0, 80),
        room: prev.room,
        items: prev.items,
        selectedId: prev.items.some((it) => it.id === s.selectedId) ? s.selectedId : null,
      });
    },

    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        future: s.future.slice(1),
        past: [...s.past, snapshot(s)],
        room: next.room,
        items: next.items,
        selectedId: next.items.some((it) => it.id === s.selectedId) ? s.selectedId : null,
      });
    },

    setBrand: (hex) => set({ brand: hex }),
    setView: (view) => set({ view }),
    toggleEgress: (on) => set((s) => ({ showEgress: on ?? !s.showEgress })),
    setCostOpen: (costOpen) => set({ costOpen }),
    setCostTier: (costTier) => set({ costTier }),
    setProjectName: (projectName) => set({ projectName }),

    setRoomSize: (width, depth) =>
      edit((s) => {
        const room = { ...s.room, width, depth };
        room.exits = room.exits.map((e) => clampExit(room, e));
        const items = s.items.map((it) => {
          const p = clampToRoom(room, getDef(it.type), it.x, it.z, it.rot);
          return p.x === it.x && p.z === it.z ? it : { ...it, x: p.x, z: p.z };
        });
        return { room, items };
      }),

    setFloor: (floor) => edit((s) => ({ room: { ...s.room, floor } })),
    setFeatureWall: (featureWall) => edit((s) => ({ room: { ...s.room, featureWall } })),

    updateExit: (id, patch) =>
      edit((s) => ({
        room: { ...s.room, exits: s.room.exits.map((e) => (e.id === id ? clampExit(s.room, { ...e, ...patch }) : e)) },
      })),

    addExit: () =>
      edit((s) => {
        const used = new Set(s.room.exits.map((e) => e.wall));
        const wall = (['left', 'right', 'back', 'front'] as const).find((w) => !used.has(w)) ?? 'left';
        const exit: Exit = { id: newId(), wall, offset: 0, width: 0.95, label: 'Fire exit' };
        return { room: { ...s.room, exits: [...s.room.exits, clampExit(s.room, exit)] } };
      }),

    removeExit: (id) =>
      edit((s) =>
        s.room.exits.length <= 1 ? {} : { room: { ...s.room, exits: s.room.exits.filter((e) => e.id !== id) } },
      ),

    setStaff: (staff) => set({ staff: Math.max(0, Math.min(40, Math.round(staff))) }),
    setSprinklered: (sprinklered) => set({ sprinklered }),
    setSnap: (snap) => set({ snap }),
    setExportOpen: (exportOpen) => set({ exportOpen }),
  };
});

export const normalizeAngle = (a: number) => {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return Math.abs(r) < 1e-6 ? 0 : r;
};

export const clampExit = (room: Room, e: Exit): Exit => {
  const len = e.wall === 'front' || e.wall === 'back' ? room.width : room.depth;
  const width = Math.max(0.81, Math.min(e.width, 3));
  const lim = Math.max(0, len / 2 - width / 2 - 0.2);
  return { ...e, width, offset: Math.max(-lim, Math.min(lim, e.offset)) };
};

// Persist the layout locally so a refresh keeps the user's work.
let saveTimer: number | undefined;
store.subscribe((s, prev) => {
  if (s.items === prev.items && s.room === prev.room && s.brand === prev.brand && s.projectName === prev.projectName && s.templateId === prev.templateId && s.staff === prev.staff && s.sprinklered === prev.sprinklered) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const { templateId, projectName, room, items, brand, staff, sprinklered } = store.getState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ templateId, projectName, room, items, brand, staff, sprinklered }));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, 400);
});

export function useStore<T>(selector: (s: Store) => T): T {
  return useZustand(store, selector);
}
