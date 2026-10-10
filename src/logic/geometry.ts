import type { Exit, ItemDef, PlacedItem, Room } from '../types';
import { getDef } from '../data/catalog';

export interface Vec2 {
  x: number;
  z: number;
}

/** Half-extents of an item's axis-aligned bounding box once rotated. */
export const rotatedHalfExtents = (w: number, d: number, rot: number) => {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  return { hx: (w * c + d * s) / 2, hz: (w * s + d * c) / 2 };
};

export const clampToRoom = (
  room: Room,
  def: Pick<ItemDef, 'w' | 'd'>,
  x: number,
  z: number,
  rot: number,
): { x: number; z: number; rot: number } => {
  const { hx, hz } = rotatedHalfExtents(def.w, def.d, rot);
  const mx = Math.max(0, room.width / 2 - hx);
  const mz = Math.max(0, room.depth / 2 - hz);
  return { x: Math.max(-mx, Math.min(mx, x)), z: Math.max(-mz, Math.min(mz, z)), rot };
};

/** World-space corners of an item's footprint, in order. */
export const footprint = (it: Pick<PlacedItem, 'x' | 'z' | 'rot'>, w: number, d: number, inflate = 0): Vec2[] => {
  const c = Math.cos(it.rot);
  const s = Math.sin(it.rot);
  const hw = w / 2 + inflate;
  const hd = d / 2 + inflate;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, lz]) => ({ x: it.x + lx * c + lz * s, z: it.z - lx * s + lz * c }));
};

/** Is world point p inside an item's (optionally inflated) footprint? */
export const pointInItem = (p: Vec2, it: PlacedItem, def: ItemDef, inflate = 0): boolean => {
  const dx = p.x - it.x;
  const dz = p.z - it.z;
  if (def.round) {
    const r = def.w / 2 + inflate;
    return dx * dx + dz * dz <= r * r;
  }
  const c = Math.cos(it.rot);
  const s = Math.sin(it.rot);
  // inverse rotation
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= def.w / 2 + inflate && Math.abs(lz) <= def.d / 2 + inflate;
};

const aabb = (it: { x: number; z: number; rot: number }, def: Pick<ItemDef, 'w' | 'd'>) => {
  const { hx, hz } = rotatedHalfExtents(def.w, def.d, it.rot);
  return { x0: it.x - hx, x1: it.x + hx, z0: it.z - hz, z1: it.z + hz };
};

/** Find an open spot near the room centre for a new item, scanning outward in rings. */
export const findFreeSpot = (room: Room, items: PlacedItem[], def: Pick<ItemDef, 'w' | 'd'>) => {
  const boxes = items
    .map((it) => {
      const dd = getDef(it.type);
      return dd.wallMounted ? null : aabb(it, dd);
    })
    .filter((b): b is NonNullable<typeof b> => !!b);
  const free = (x: number, z: number) => {
    const b = aabb({ x, z, rot: 0 }, { w: def.w + 0.3, d: def.d + 0.3 });
    if (b.x0 < -room.width / 2 || b.x1 > room.width / 2 || b.z0 < -room.depth / 2 || b.z1 > room.depth / 2) return false;
    return !boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.z0 < o.z1 && b.z1 > o.z0);
  };
  const step = 0.25;
  for (let r = 0; r < Math.max(room.width, room.depth); r += step) {
    const n = Math.max(1, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.round((Math.cos(a) * r) / 0.05) * 0.05;
      const z = Math.round((Math.sin(a) * r) / 0.05) * 0.05;
      if (free(x, z)) return { x, z, rot: 0 };
    }
  }
  return { ...clampToRoom(room, def, 0, 0, 0) };
};

/** Centre point of an exit door on the wall line, plus the inward-facing normal. */
export const exitGeometry = (room: Room, e: Exit) => {
  const hw = room.width / 2;
  const hd = room.depth / 2;
  switch (e.wall) {
    case 'front':
      return { x: e.offset, z: hd, nx: 0, nz: -1, along: { x: 1, z: 0 } };
    case 'back':
      return { x: e.offset, z: -hd, nx: 0, nz: 1, along: { x: 1, z: 0 } };
    case 'left':
      return { x: -hw, z: e.offset, nx: 1, nz: 0, along: { x: 0, z: 1 } };
    case 'right':
    default:
      return { x: hw, z: e.offset, nx: -1, nz: 0, along: { x: 0, z: 1 } };
  }
};

export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
