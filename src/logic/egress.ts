import type { PlacedItem, Room } from '../types';
import { getDef } from '../data/catalog';
import { exitGeometry, footprint, pointInItem, type Vec2 } from './geometry';

/**
 * Egress analysis on a coarse walking grid.
 *
 * Solid items are inflated by half a body width so a route only squeezes through gaps a person can use.
 * A Dijkstra flood from every exit gives the walking distance from each cell to its nearest exit;
 * routes are traced by descending that field.
 */

const CELL = 0.2;
const BODY = 0.28; // half shoulder width plus a little clearance
const EXIT_ZONE_DEPTH = 1.1;

export interface EgressRoute {
  points: Vec2[];
  length: number;
  exitId: string;
}

export interface EgressResult {
  routes: EgressRoute[];
  /** Longest walk from any reachable occupied spot to its nearest exit, metres. */
  maxTravel: number;
  maxTravelRoute: EgressRoute | null;
  /** Exits whose clear landing zone is overlapped by a solid item. */
  obstructedExits: string[];
  /** Seats with no walkable route to any exit. */
  unreachableSeats: Vec2[];
  seatPoints: Vec2[];
  exitSeparation: number;
}

interface Grid {
  nx: number;
  nz: number;
  x0: number;
  z0: number;
  blocked: Uint8Array;
  distance: Float64Array;
  nearestExit: Int16Array;
}

const idx = (g: Grid, i: number, j: number) => j * g.nx + i;
const cellCenter = (g: Grid, i: number, j: number): Vec2 => ({ x: g.x0 + (i + 0.5) * CELL, z: g.z0 + (j + 0.5) * CELL });
const toCell = (g: Grid, p: Vec2) => ({
  i: Math.max(0, Math.min(g.nx - 1, Math.floor((p.x - g.x0) / CELL))),
  j: Math.max(0, Math.min(g.nz - 1, Math.floor((p.z - g.z0) / CELL))),
});

/** Small binary heap keyed on distance. */
class Heap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(v: number, k: number) {
    const keys = this.keys;
    const vals = this.vals;
    let i = keys.length;
    keys.push(k);
    vals.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= k) break;
      keys[i] = keys[p];
      vals[i] = vals[p];
      i = p;
    }
    keys[i] = k;
    vals[i] = v;
  }
  pop(): [number, number] {
    const keys = this.keys;
    const vals = this.vals;
    const topV = vals[0];
    const topK = keys[0];
    const lastK = keys.pop()!;
    const lastV = vals.pop()!;
    if (keys.length) {
      let i = 0;
      const n = keys.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        let mk = lastK;
        if (l < n && keys[l] < mk) {
          m = l;
          mk = keys[l];
        }
        if (r < n && keys[r] < mk) m = r;
        if (m === i) break;
        keys[i] = keys[m];
        vals[i] = vals[m];
        i = m;
      }
      keys[i] = lastK;
      vals[i] = lastV;
    }
    return [topV, topK];
  }
}

const buildGrid = (room: Room, items: PlacedItem[]): Grid => {
  const nx = Math.ceil(room.width / CELL);
  const nz = Math.ceil(room.depth / CELL);
  const g: Grid = {
    nx,
    nz,
    x0: -room.width / 2,
    z0: -room.depth / 2,
    blocked: new Uint8Array(nx * nz),
    distance: new Float64Array(nx * nz).fill(Infinity),
    nearestExit: new Int16Array(nx * nz).fill(-1),
  };
  // Walls: block the ring of cells that hugs each wall by less than a body width.
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const c = cellCenter(g, i, j);
      if (
        c.x < g.x0 + BODY * 0.8 ||
        c.x > -g.x0 - BODY * 0.8 ||
        c.z < g.z0 + BODY * 0.8 ||
        c.z > -g.z0 - BODY * 0.8
      ) {
        g.blocked[idx(g, i, j)] = 1;
      }
    }
  }
  for (const it of items) {
    const def = getDef(it.type);
    if (!def.solid || def.wallMounted) continue;
    const pts = footprint(it, def.w, def.d, BODY);
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minZ = Math.min(...pts.map((p) => p.z));
    const maxZ = Math.max(...pts.map((p) => p.z));
    const a = toCell(g, { x: minX, z: minZ });
    const b = toCell(g, { x: maxX, z: maxZ });
    for (let j = a.j; j <= b.j; j++) {
      for (let i = a.i; i <= b.i; i++) {
        if (pointInItem(cellCenter(g, i, j), it, def, BODY)) g.blocked[idx(g, i, j)] = 1;
      }
    }
  }
  // Re-open each doorway so exits are reachable through the wall band.
  room.exits.forEach((e) => {
    const eg = exitGeometry(room, e);
    for (let t = -e.width / 2 + 0.15; t <= e.width / 2 - 0.15; t += CELL / 2) {
      for (let dpt = 0; dpt <= BODY * 1.2; dpt += CELL / 2) {
        const p = { x: eg.x + eg.along.x * t + eg.nx * dpt, z: eg.z + eg.along.z * t + eg.nz * dpt };
        const c = toCell(g, p);
        const k = idx(g, c.i, c.j);
        if (!isInsideSolid(p, items)) g.blocked[k] = 0;
      }
    }
  });
  return g;
};

const isInsideSolid = (p: Vec2, items: PlacedItem[]) =>
  items.some((it) => {
    const def = getDef(it.type);
    return def.solid && !def.wallMounted && pointInItem(p, it, def, 0.05);
  });

const flood = (g: Grid, room: Room) => {
  const heap = new Heap();
  room.exits.forEach((e, ei) => {
    const eg = exitGeometry(room, e);
    for (let t = -e.width / 2 + 0.15; t <= e.width / 2 - 0.15; t += CELL / 2) {
      const p = { x: eg.x + eg.along.x * t + eg.nx * 0.05, z: eg.z + eg.along.z * t + eg.nz * 0.05 };
      const c = toCell(g, p);
      const k = idx(g, c.i, c.j);
      if (g.blocked[k]) continue;
      if (g.distance[k] > 0) {
        g.distance[k] = 0;
        g.nearestExit[k] = ei;
        heap.push(k, 0);
      }
    }
  });
  const D = Math.SQRT2 * CELL;
  const nbr = [
    [1, 0, CELL],
    [-1, 0, CELL],
    [0, 1, CELL],
    [0, -1, CELL],
    [1, 1, D],
    [1, -1, D],
    [-1, 1, D],
    [-1, -1, D],
  ] as const;
  while (heap.size) {
    const [k, dk] = heap.pop();
    if (dk > g.distance[k]) continue;
    const i = k % g.nx;
    const j = (k / g.nx) | 0;
    for (const [di, dj, w] of nbr) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue;
      const nk = idx(g, ni, nj);
      if (g.blocked[nk]) continue;
      // no corner cutting past blocked cells
      if (di && dj && (g.blocked[idx(g, i + di, j)] || g.blocked[idx(g, i, j + dj)])) continue;
      const nd = dk + w;
      if (nd < g.distance[nk]) {
        g.distance[nk] = nd;
        g.nearestExit[nk] = g.nearestExit[k];
        heap.push(nk, nd);
      }
    }
  }
};

/** Nearest reachable cell to p (breadth-first through blocked cells). */
const nearestOpen = (g: Grid, p: Vec2): number => {
  const start = toCell(g, p);
  const k0 = idx(g, start.i, start.j);
  if (!g.blocked[k0] && Number.isFinite(g.distance[k0])) return k0;
  let best = -1;
  let bestD = Infinity;
  const R = Math.ceil(1.8 / CELL);
  for (let dj = -R; dj <= R; dj++) {
    for (let di = -R; di <= R; di++) {
      const i = start.i + di;
      const j = start.j + dj;
      if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) continue;
      const k = idx(g, i, j);
      if (g.blocked[k] || !Number.isFinite(g.distance[k])) continue;
      const d = di * di + dj * dj;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
  }
  return best;
};

const trace = (g: Grid, room: Room, k0: number, from: Vec2): EgressRoute => {
  const pts: Vec2[] = [from];
  let k = k0;
  let guard = g.nx * g.nz;
  while (g.distance[k] > 0 && guard-- > 0) {
    const i = k % g.nx;
    const j = (k / g.nx) | 0;
    let best = k;
    let bd = g.distance[k];
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue;
        const nk = idx(g, ni, nj);
        if (g.distance[nk] < bd) {
          bd = g.distance[nk];
          best = nk;
        }
      }
    }
    if (best === k) break;
    k = best;
    pts.push(cellCenter(g, k % g.nx, (k / g.nx) | 0));
  }
  const exitIdx = Math.max(0, g.nearestExit[k0]);
  const exit = room.exits[exitIdx];
  const eg = exitGeometry(room, exit);
  // finish just beyond the door line so arrows run out through the opening
  const last = pts[pts.length - 1];
  const along = (last.x - eg.x) * eg.along.x + (last.z - eg.z) * eg.along.z;
  const clampAlong = Math.max(-exit.width / 2 + 0.2, Math.min(exit.width / 2 - 0.2, along));
  pts.push({ x: eg.x + eg.along.x * clampAlong, z: eg.z + eg.along.z * clampAlong });
  pts.push({ x: eg.x + eg.along.x * clampAlong - eg.nx * 0.6, z: eg.z + eg.along.z * clampAlong - eg.nz * 0.6 });
  return { points: smooth(simplify(pts, 0.12)), length: g.distance[k0], exitId: exit.id };
};

/** Ramer–Douglas–Peucker polyline simplification. */
const simplify = (pts: Vec2[], eps: number): Vec2[] => {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  let maxD = 0;
  let index = 0;
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / L;
    if (d > maxD) {
      maxD = d;
      index = i;
    }
  }
  if (maxD > eps) {
    const left = simplify(pts.slice(0, index + 1), eps);
    const right = simplify(pts.slice(index), eps);
    return [...left.slice(0, -1), ...right];
  }
  return [a, b];
};

/** Chaikin corner cutting, keeping the endpoints. */
const smooth = (pts: Vec2[], iterations = 2): Vec2[] => {
  let out = pts;
  for (let n = 0; n < iterations; n++) {
    if (out.length < 3) return out;
    const next: Vec2[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const p = out[i];
      const q = out[i + 1];
      next.push({ x: p.x * 0.75 + q.x * 0.25, z: p.z * 0.75 + q.z * 0.25 });
      next.push({ x: p.x * 0.25 + q.x * 0.75, z: p.z * 0.25 + q.z * 0.75 });
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
};

/** Pick up to n well-spread points (farthest-point sampling, seeded with the most remote one). */
const spread = <T extends { p: Vec2; d: number }>(pts: T[], n: number): T[] => {
  if (pts.length <= n) return pts;
  const chosen: T[] = [];
  let first = pts[0];
  for (const q of pts) if (q.d > first.d) first = q;
  chosen.push(first);
  const minD = pts.map((q) => Math.hypot(q.p.x - first.p.x, q.p.z - first.p.z));
  while (chosen.length < n) {
    let bi = 0;
    for (let i = 1; i < pts.length; i++) if (minD[i] > minD[bi]) bi = i;
    const pick = pts[bi];
    chosen.push(pick);
    for (let i = 0; i < pts.length; i++) minD[i] = Math.min(minD[i], Math.hypot(pts[i].p.x - pick.p.x, pts[i].p.z - pick.p.z));
  }
  return chosen;
};

export const seatPositions = (items: PlacedItem[]): Vec2[] => {
  const out: Vec2[] = [];
  for (const it of items) {
    const def = getDef(it.type);
    if (!def.seats) continue;
    if (def.seats === 1) {
      out.push({ x: it.x, z: it.z });
      continue;
    }
    // multi-seat furniture: spread seats along the long axis, on the sitting side
    const c = Math.cos(it.rot);
    const s = Math.sin(it.rot);
    if (it.type === 'booth') {
      for (const lz of [-0.62, 0.62]) for (const lx of [-0.28, 0.28]) out.push({ x: it.x + lx * c + lz * s, z: it.z - lx * s + lz * c });
      continue;
    }
    for (let n = 0; n < def.seats; n++) {
      const lx = -def.w / 2 + (def.w / def.seats) * (n + 0.5);
      const lz = def.d * 0.15;
      out.push({ x: it.x + lx * c + lz * s, z: it.z - lx * s + lz * c });
    }
  }
  return out;
};

export const analyzeEgress = (room: Room, items: PlacedItem[]): EgressResult => {
  const g = buildGrid(room, items);
  flood(g, room);

  // Exit landing zones must stay clear.
  const obstructedExits: string[] = [];
  room.exits.forEach((e) => {
    const eg = exitGeometry(room, e);
    const samples: Vec2[] = [];
    for (let t = -e.width / 2; t <= e.width / 2 + 1e-6; t += 0.15) {
      for (let dpt = 0.1; dpt <= EXIT_ZONE_DEPTH; dpt += 0.15) {
        samples.push({ x: eg.x + eg.along.x * t + eg.nx * dpt, z: eg.z + eg.along.z * t + eg.nz * dpt });
      }
    }
    const hit = items.some((it) => {
      const def = getDef(it.type);
      if (!def.solid || def.wallMounted) return false;
      return samples.some((p) => pointInItem(p, it, def));
    });
    if (hit) obstructedExits.push(e.id);
  });

  const seatPoints = seatPositions(items);
  const unreachableSeats: Vec2[] = [];
  const origins: { p: Vec2; d: number; k: number }[] = [];
  for (const p of seatPoints) {
    const k = nearestOpen(g, p);
    if (k < 0) {
      unreachableSeats.push(p);
      continue;
    }
    origins.push({ p, d: g.distance[k], k });
  }

  // Travel distance is measured from the most remote occupiable point, not just seats.
  let maxTravel = 0;
  let maxK = -1;
  for (let k = 0; k < g.distance.length; k++) {
    const d = g.distance[k];
    if (Number.isFinite(d) && d > maxTravel) {
      maxTravel = d;
      maxK = k;
    }
  }
  for (const o of origins) {
    const d = o.d + 0.3;
    if (d > maxTravel) maxTravel = d;
  }

  const sample = spread(origins, Math.min(14, Math.max(4, Math.round(origins.length / 3))));
  const routes = sample.map((o) => trace(g, room, o.k, o.p));
  routes.forEach((r, i) => (r.length = sample[i].d + 0.3));

  let maxTravelRoute: EgressRoute | null = null;
  if (maxK >= 0) {
    const from = cellCenter(g, maxK % g.nx, (maxK / g.nx) | 0);
    maxTravelRoute = trace(g, room, maxK, from);
    maxTravelRoute.length = maxTravel;
  }

  let exitSeparation = 0;
  for (let a = 0; a < room.exits.length; a++) {
    for (let b = a + 1; b < room.exits.length; b++) {
      const ea = exitGeometry(room, room.exits[a]);
      const eb = exitGeometry(room, room.exits[b]);
      exitSeparation = Math.max(exitSeparation, Math.hypot(ea.x - eb.x, ea.z - eb.z));
    }
  }

  return { routes, maxTravel, maxTravelRoute, obstructedExits, unreachableSeats, seatPoints, exitSeparation };
};
