import type { PlacedItem, Room } from '../types';
import { getDef } from '../data/catalog';
import { exitGeometry } from './geometry';

/*
 * Architectural plan symbols. Each item type draws in its own local frame (metres, origin at the
 * footprint centre, +y towards the item's front). Shapes are flattened to world-space polygons so
 * the same drawing feeds SVG on screen and vector PDF output.
 */

export type Fill = 'none' | 'paper' | 'oat' | 'wood' | 'brand' | 'brandSoft' | 'ink' | 'glass' | 'steel' | 'leaf';
export type Stroke = 'ink' | 'soft' | 'brand' | 'exit' | 'none';

type Prim =
  | { k: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill: Fill; stroke?: Stroke; sw?: number; dash?: boolean }
  | { k: 'circle'; x: number; y: number; r: number; fill: Fill; stroke?: Stroke; sw?: number }
  | { k: 'line'; pts: [number, number][]; stroke?: Stroke; sw?: number; dash?: boolean };

export type Shape =
  | { k: 'poly'; pts: [number, number][]; fill: Fill; stroke: Stroke; sw: number; dash?: boolean }
  | { k: 'circle'; cx: number; cy: number; r: number; fill: Fill; stroke: Stroke; sw: number }
  | { k: 'line'; pts: [number, number][]; stroke: Stroke; sw: number; dash?: boolean };

const R = (x: number, y: number, w: number, h: number, fill: Fill, extra: Partial<Extract<Prim, { k: 'rect' }>> = {}): Prim => ({
  k: 'rect',
  x,
  y,
  w,
  h,
  fill,
  ...extra,
});
const C = (x: number, y: number, r: number, fill: Fill, extra: Partial<Extract<Prim, { k: 'circle' }>> = {}): Prim => ({ k: 'circle', x, y, r, fill, ...extra });
const L = (pts: [number, number][], extra: Partial<Extract<Prim, { k: 'line' }>> = {}): Prim => ({ k: 'line', pts, ...extra });

const chair = (w: number, d: number): Prim[] => [
  R(0, 0.03, w * 0.86, d * 0.78, 'brand', { r: 0.05 }),
  R(0, -d / 2 + 0.035, w * 0.9, 0.07, 'ink', { r: 0.02, stroke: 'none' }),
];

const table = (w: number, d: number, fill: Fill = 'wood'): Prim[] => [R(0, 0, w, d, fill, { r: 0.02 })];

const counter = (w: number, d: number, top: Fill = 'paper'): Prim[] => [
  R(0, 0, w, d, top),
  R(0, d / 2 - 0.05, w, 0.1, 'brand', { stroke: 'none' }),
  L([
    [-w / 2 + 0.06, -d / 2 + 0.06],
    [w / 2 - 0.06, -d / 2 + 0.06],
  ], { stroke: 'soft', sw: 0.5 }),
];

const SYMBOLS: Record<string, (w: number, d: number) => Prim[]> = {
  cafe_chair: chair,
  task_chair: (w, d) => [C(0, 0.02, w * 0.42, 'brand'), R(0, -d / 2 + 0.06, w * 0.78, 0.09, 'ink', { r: 0.04, stroke: 'none' })],
  bar_stool: (w) => [C(0, 0, w * 0.45, 'brand')],
  lounge_chair: (w, d) => [
    R(0, 0, w, d, 'brand', { r: 0.1 }),
    R(0, 0.07, w * 0.62, d * 0.66, 'brandSoft', { r: 0.06 }),
  ],
  sofa: (w, d) => [
    R(0, 0, w, d, 'brand', { r: 0.08 }),
    R(-w * 0.22, 0.08, w * 0.4, d * 0.66, 'brandSoft', { r: 0.05 }),
    R(w * 0.22, 0.08, w * 0.4, d * 0.66, 'brandSoft', { r: 0.05 }),
  ],
  banquette: (w, d) => [
    R(0, 0, w, d, 'brandSoft', { r: 0.04 }),
    R(0, -d / 2 + 0.08, w, 0.16, 'brand', { stroke: 'none' }),
  ],
  booth: (w, d) => [
    R(0, -d / 2 + 0.28, w, 0.56, 'brandSoft', { r: 0.04 }),
    R(0, -d / 2 + 0.07, w, 0.14, 'brand', { stroke: 'none' }),
    R(0, d / 2 - 0.28, w, 0.56, 'brandSoft', { r: 0.04 }),
    R(0, d / 2 - 0.07, w, 0.14, 'brand', { stroke: 'none' }),
    R(0, 0, w * 0.92, 0.66, 'wood'),
  ],
  bench: (w, d) => table(w, d),
  bistro_table: (w) => [C(0, 0, w / 2, 'paper')],
  table_2: (w, d) => table(w, d),
  table_4: (w, d) => table(w, d),
  table_6: (w, d) => table(w, d),
  communal_table: (w, d) => table(w, d),
  high_top: (w) => [C(0, 0, w / 2, 'wood'), C(0, 0, w * 0.12, 'none', { stroke: 'soft' })],
  coffee_table: (w, d) => [R(0, 0, w, d, 'wood', { r: 0.04 })],
  espresso_bar: (w, d) => [...counter(w, d), R(-0.65, -0.08, 0.82, 0.5, 'steel'), C(0.25, -0.12, 0.09, 'ink'), C(0.55, -0.12, 0.09, 'ink')],
  pastry_case: (w, d) => [...counter(w, d, 'glass')],
  back_counter: (w, d) => [R(0, 0, w, d, 'paper'), L([[-w / 2, -d / 2], [w / 2, d / 2]], { stroke: 'soft', sw: 0.5 }), L([[-w / 2, d / 2], [w / 2, -d / 2]], { stroke: 'soft', sw: 0.5 })],
  window_counter: (w, d) => [R(0, 0, w, d, 'wood')],
  condiment: (w, d) => [R(0, 0, w, d, 'wood'), C(-0.25, 0, 0.07, 'steel')],
  bar_counter: (w, d) => counter(w, d, 'wood'),
  host_stand: (w, d) => [R(0, 0, w, d, 'brand', { r: 0.03 })],
  kitchen_line: (w, d) => [
    R(0, 0, w, d, 'steel'),
    ...[0, 1, 2, 3].map((i) => C(-1.25 + i * 0.6, 0.05, 0.13, 'none', { stroke: 'ink', sw: 0.6 })),
    R(0, -0.05, w, d * 0.56, 'none', { dash: true, stroke: 'soft' }),
  ],
  menu_board: (w, d) => [R(0, 0, w, Math.max(d, 0.06), 'brand', { dash: true })],
  desk: (w, d) => [R(0, 0, w, d, 'wood'), R(0, -d / 2 + 0.18, 0.6, 0.04, 'ink', { stroke: 'none' })],
  desk_pod: (w, d) => [
    R(0, 0, w, d, 'wood'),
    R(0, 0, w, 0.05, 'brand', { stroke: 'none' }),
    L([[0, -d / 2], [0, d / 2]], { stroke: 'soft', sw: 0.6 }),
    ...[-0.7, 0.7].flatMap((x) => [R(x, -0.2, 0.56, 0.04, 'ink', { stroke: 'none' }), R(x, 0.2, 0.56, 0.04, 'ink', { stroke: 'none' })]),
  ],
  meeting_table: (w, d) => [R(0, 0, w, d, 'wood', { r: 0.2 })],
  phone_booth: (w, d) => [
    R(0, 0, w, d, 'brandSoft'),
    R(0, -d / 2 + 0.03, w, 0.06, 'brand', { stroke: 'none' }),
    R(-w / 2 + 0.03, 0, 0.06, d, 'brand', { stroke: 'none' }),
    R(w / 2 - 0.03, 0, 0.06, d, 'brand', { stroke: 'none' }),
    L([[-w / 2, d / 2 - 0.02], [w / 2, d / 2 - 0.02]], { stroke: 'ink', sw: 0.5 }),
  ],
  reception: (w, d) => counter(w, d, 'paper'),
  lockers: (w, d) => [R(0, 0, w, d, 'paper'), R(0, d / 2 - 0.04, w, 0.08, 'brand', { stroke: 'none' }), ...[1, 2, 3, 4].map((i) => L([[-w / 2 + i * (w / 5), -d / 2], [-w / 2 + i * (w / 5), d / 2]], { stroke: 'soft', sw: 0.5 }))],
  storage: (w, d) => [R(0, 0, w, d, 'wood'), L([[0, -d / 2], [0, d / 2]], { stroke: 'soft', sw: 0.5 })],
  kitchenette: (w, d) => [R(0, 0, w, d, 'paper'), R(-0.5, 0, 0.5, 0.38, 'steel'), R(0.92, 0, 0.6, d, 'steel')],
  whiteboard: (w, d) => [R(0, 0, w, 0.06, 'paper'), R(-w / 2 + 0.02, 0, 0.04, d, 'ink', { stroke: 'none' }), R(w / 2 - 0.02, 0, 0.04, d, 'ink', { stroke: 'none' })],
  wall_shelf: (w, d) => [R(0, 0, w, d, 'paper'), R(0, -d / 2 + 0.03, w, 0.06, 'brand', { stroke: 'none' }), L([[-w / 2, 0.02], [w / 2, 0.02]], { stroke: 'soft', sw: 0.5, dash: true })],
  gondola: (w, d) => [R(0, 0, w, d, 'paper'), R(0, 0, w, 0.06, 'ink', { stroke: 'none' })],
  display_table: (w, d) => [R(0, 0, w, d, 'wood'), R(0, 0, w * 0.78, d * 0.74, 'none', { dash: true, stroke: 'soft' })],
  clothing_rail: (w) => [
    L([[-w / 2 + 0.05, 0], [w / 2 - 0.05, 0]], { stroke: 'ink', sw: 1.2 }),
    ...Array.from({ length: 9 }, (_, i) => L([[-w / 2 + 0.15 + i * ((w - 0.3) / 8), -0.18], [-w / 2 + 0.15 + i * ((w - 0.3) / 8), 0.18]], { stroke: 'soft', sw: 0.6 })),
  ],
  cash_wrap: (w, d) => counter(w, d, 'paper'),
  plinth: (w, d) => [R(0, 0, w, d, 'brand')],
  mannequin: (w) => [C(0, 0, w * 0.4, 'paper'), R(0, 0, w * 0.7, w * 0.26, 'oat', { r: 0.06 }), C(0, 0, w * 0.13, 'ink')],
  fitting_room: (w, d) => [
    R(0, 0, w, d, 'paper'),
    R(0, -d / 2 + 0.025, w, 0.05, 'ink', { stroke: 'none' }),
    R(-w / 2 + 0.025, 0, 0.05, d, 'ink', { stroke: 'none' }),
    R(w / 2 - 0.025, 0, 0.05, d, 'ink', { stroke: 'none' }),
    L(Array.from({ length: 13 }, (_, i) => [-w / 2 + (w / 12) * i, d / 2 - 0.04 + (i % 2 ? 0.04 : -0.01)] as [number, number]), { stroke: 'brand', sw: 1.4 }),
  ],
  planter: (w) => [C(0, 0, w / 2, 'oat'), C(-0.08, -0.05, w * 0.3, 'leaf', { stroke: 'none' }), C(0.1, 0.06, w * 0.26, 'leaf', { stroke: 'none' }), C(0.02, -0.14, w * 0.18, 'leaf', { stroke: 'none' })],
  rug: (w, d) => [R(0, 0, w, d, 'brand', { stroke: 'none' }), R(0, 0, w - 0.3, d - 0.3, 'brandSoft', { stroke: 'none' })],
  partition: (w, d) => [R(0, 0, w, Math.max(d, 0.1), 'brand')],
};

export const symbolPrims = (type: string): Prim[] => {
  const def = getDef(type);
  const fn = SYMBOLS[type];
  return fn ? fn(def.w, def.d) : [R(0, 0, def.w, def.d, 'paper')];
};

const roundedRect = (x: number, y: number, w: number, h: number, r: number): [number, number][] => {
  const rr = Math.min(r, w / 2, h / 2);
  if (rr < 0.005) {
    return [
      [x - w / 2, y - h / 2],
      [x + w / 2, y - h / 2],
      [x + w / 2, y + h / 2],
      [x - w / 2, y + h / 2],
    ];
  }
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [x + w / 2 - rr, y - h / 2 + rr, -Math.PI / 2],
    [x + w / 2 - rr, y + h / 2 - rr, 0],
    [x - w / 2 + rr, y + h / 2 - rr, Math.PI / 2],
    [x - w / 2 + rr, y - h / 2 + rr, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= 5; i++) {
      const a = a0 + (i / 5) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  }
  return pts;
};

/** Flatten primitives through a placement transform into world-space shapes. */
export const flattenPrims = (prims: Prim[], tx: number, ty: number, rot: number): Shape[] => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const T = ([x, y]: [number, number]): [number, number] => [tx + x * c + y * s, ty - x * s + y * c];
  return prims.map((p): Shape => {
    if (p.k === 'rect') {
      return { k: 'poly', pts: roundedRect(p.x, p.y, p.w, p.h, p.r ?? 0).map(T), fill: p.fill, stroke: p.stroke ?? 'ink', sw: p.sw ?? 0.7, dash: p.dash };
    }
    if (p.k === 'circle') {
      const [cx, cy] = T([p.x, p.y]);
      return { k: 'circle', cx, cy, r: p.r, fill: p.fill, stroke: p.stroke ?? 'ink', sw: p.sw ?? 0.7 };
    }
    return { k: 'line', pts: p.pts.map(T), stroke: p.stroke ?? 'ink', sw: p.sw ?? 0.7, dash: p.dash };
  });
};

export const itemShapes = (it: PlacedItem): Shape[] => flattenPrims(symbolPrims(it.type), it.x, it.z, it.rot);

/** Items in drawing order: rugs first, wall-mounted last. */
export const drawOrder = (items: PlacedItem[]) =>
  [...items].sort((a, b) => {
    const rank = (t: string) => (t === 'rug' ? 0 : getDef(t).wallMounted ? 3 : getDef(t).solid ? 1 : 2);
    return rank(a.type) - rank(b.type);
  });

export interface WallShapes {
  poche: [number, number][][];
  glazing: [number, number][][];
  doors: { hinge: [number, number]; leaf: [number, number]; arc: [number, number][]; label: string; center: [number, number]; normal: [number, number]; width: number }[];
}

const WALL = 0.15;

/** Wall poché with openings, storefront glazing and door swings, in world plan coordinates. */
export const wallShapes = (room: Room): WallShapes => {
  const hw = room.width / 2;
  const hd = room.depth / 2;
  const poche: [number, number][][] = [];
  const glazing: [number, number][][] = [];
  const doors: WallShapes['doors'] = [];
  const box = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  const sides = [
    { side: 'back', len: room.width + WALL * 2, rect: (a: number, b: number) => box(a, -hd - WALL, b, -hd) },
    { side: 'left', len: room.depth, rect: (a: number, b: number) => box(-hw - WALL, a, -hw, b) },
    { side: 'right', len: room.depth, rect: (a: number, b: number) => box(hw, a, hw + WALL, b) },
  ] as const;
  for (const s of sides) {
    const ops = room.exits.filter((e) => e.wall === s.side).sort((a, b) => a.offset - b.offset);
    let t = -s.len / 2;
    for (const e of ops) {
      poche.push(s.rect(t, e.offset - e.width / 2));
      t = e.offset + e.width / 2;
    }
    poche.push(s.rect(t, s.len / 2));
  }
  // storefront: piers at the corners, glazing elsewhere
  const fops = room.exits.filter((e) => e.wall === 'front').sort((a, b) => a.offset - b.offset);
  poche.push(box(-hw - WALL, hd, -hw + 0.1, hd + WALL));
  poche.push(box(hw - 0.1, hd, hw + WALL, hd + WALL));
  let t = -hw + 0.1;
  for (const e of fops) {
    glazing.push(box(t, hd + 0.05, e.offset - e.width / 2, hd + 0.1));
    t = e.offset + e.width / 2;
  }
  glazing.push(box(t, hd + 0.05, hw - 0.1, hd + 0.1));

  for (const e of room.exits) {
    const eg = exitGeometry(room, e);
    const leaves = e.width >= 1.5 ? 2 : 1;
    const lw = e.width / leaves;
    for (let i = 0; i < leaves; i++) {
      const dir = leaves === 2 && i === 1 ? -1 : 1;
      const ht = dir > 0 ? -e.width / 2 : e.width / 2;
      // hinge on the outer face; leaf swings outward (against the inward normal)
      const hx = eg.x + eg.along.x * ht - eg.nx * WALL;
      const hz = eg.z + eg.along.z * ht - eg.nz * WALL;
      const leaf: [number, number] = [hx - eg.nx * lw, hz - eg.nz * lw];
      const arc: [number, number][] = [];
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * (Math.PI / 2);
        const ax = Math.cos(a) * dir;
        const an = Math.sin(a);
        arc.push([hx + (eg.along.x * ax - eg.nx * an) * lw, hz + (eg.along.z * ax - eg.nz * an) * lw]);
      }
      doors.push({ hinge: [hx, hz], leaf, arc, label: e.label, center: [eg.x, eg.z], normal: [eg.nx, eg.nz], width: e.width });
    }
  }
  return { poche, glazing, doors };
};
