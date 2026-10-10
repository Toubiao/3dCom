import * as THREE from 'three';
import type { Room, WallSide } from '../types';
import type { Materials } from './materials';
import { blobTexture, FLOOR_TILE_M, floorTexture, signTexture } from './textures';
import { exitGeometry } from '../logic/geometry';

export const WALL_H = 3.0;
export const WALL_T = 0.15;
const DOOR_H = 2.2;
const SLAB = 0.16;

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

export interface RoomRig {
  group: THREE.Group;
  walls: Record<WallSide, THREE.Group>;
  /** Parts of each wall hidden when it is cut away: glazing, signage, awnings, door leaves. */
  uppers: Record<WallSide, THREE.Group>;
  floorMat: THREE.MeshStandardMaterial;
  grid: THREE.LineSegments;
  gridMat: THREE.LineBasicMaterial;
  exitSigns: THREE.Mesh[];
  setSign: (text: string, brand: string, ink: string) => void;
  dispose: () => void;
}

const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], cast = true) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

/** Axis-aligned box from min corner (x0, y0, z0) to max corner. */
const boxBetween = (mat: THREE.Material | THREE.Material[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
  const m = mesh(UNIT_BOX, mat);
  m.scale.set(Math.max(0.001, x1 - x0), Math.max(0.001, y1 - y0), Math.max(0.001, z1 - z0));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
};

export interface RoomOptions {
  sign: { text: string; brand: string; ink: string };
  anisotropy: number;
  /** Add a ceiling with pendant lights, for eye-level photographs. */
  ceiling?: boolean;
  /** Keep pendants away from this plan point (the photographer). */
  avoid?: { x: number; z: number };
  /** Add pavement in front of the storefront, for street-level photographs. */
  street?: boolean;
}

export const buildRoom = (room: Room, m: Materials, opts: RoomOptions): RoomRig => {
  const W = room.width;
  const D = room.depth;
  const hw = W / 2;
  const hd = D / 2;
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  // Model base slab, like a presentation model sitting on the drafting table.
  const slab = boxBetween(m.oat, -hw - WALL_T - 0.12, -SLAB, -hd - WALL_T - 0.12, hw + WALL_T + 0.12, 0, hd + WALL_T + 0.12);
  slab.castShadow = false;
  group.add(slab);

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry((W + 4) * 1.25, (D + 4) * 1.25),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -SLAB - 0.002;
  blob.renderOrder = -1;
  group.add(blob);
  disposables.push(blob.geometry, blob.material as THREE.Material, (blob.material as THREE.MeshBasicMaterial).map!);

  // Floor finish
  const base = floorTexture(room.floor, opts.anisotropy);
  const tex = base.clone();
  tex.needsUpdate = true;
  const tile = FLOOR_TILE_M[room.floor];
  tex.repeat.set(W / tile, D / tile);
  const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: room.floor === 'concrete' ? 0.55 : room.floor === 'terrazzo' ? 0.35 : 0.6 });
  const floor = mesh(new THREE.PlaneGeometry(W, D), floorMat, false);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  group.add(floor);
  disposables.push(tex, floorMat, floor.geometry);

  // Metre grid, faded in for plan view.
  const gridPts: number[] = [];
  for (let x = -Math.floor(hw); x <= hw; x++) gridPts.push(x, 0, -hd, x, 0, hd);
  for (let z = -Math.floor(hd); z <= hd; z++) gridPts.push(-hw, 0, z, hw, 0, z);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: '#3B5B86', transparent: true, opacity: 0, depthWrite: false });
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  grid.position.y = 0.006;
  grid.renderOrder = 2;
  group.add(grid);
  disposables.push(gridGeo, gridMat);

  // Walls
  const walls = {
    front: new THREE.Group(),
    back: new THREE.Group(),
    left: new THREE.Group(),
    right: new THREE.Group(),
  } as Record<WallSide, THREE.Group>;
  Object.values(walls).forEach((g) => group.add(g));
  const uppers = {
    front: new THREE.Group(),
    back: new THREE.Group(),
    left: new THREE.Group(),
    right: new THREE.Group(),
  } as Record<WallSide, THREE.Group>;
  (Object.keys(walls) as WallSide[]).forEach((k) => walls[k].add(uppers[k]));

  // Material order for BoxGeometry faces: +x, -x, +y, -y, +z, -z
  const inner = room.featureWall ? m.brandPaint : m.paint;
  const wallMats = (side: WallSide): THREE.Material[] => {
    const mats = [m.paint, m.paint, m.wallTop, m.paint, m.paint, m.paint];
    if (side === 'back') mats[4] = inner;
    return mats;
  };

  const exitSigns: THREE.Mesh[] = [];

  /** Openings along a wall in wall-local coordinates (t runs along the wall). */
  const openings = (side: WallSide) =>
    room.exits
      .filter((e) => e.wall === side)
      .map((e) => ({ e, t0: e.offset - e.width / 2, t1: e.offset + e.width / 2 }))
      .sort((a, b) => a.t0 - b.t0);

  const solidWall = (side: WallSide) => {
    const g = walls[side];
    const horizontal = side === 'back' || side === 'front';
    const len = horizontal ? W + WALL_T * 2 : D;
    const mats = wallMats(side);
    const segs: [number, number, number, number][] = []; // t0, t1, y0, y1
    let t = -len / 2;
    for (const o of openings(side)) {
      segs.push([t, o.t0, 0, WALL_H]);
      segs.push([o.t0, o.t1, DOOR_H, WALL_H]);
      t = o.t1;
    }
    segs.push([t, len / 2, 0, WALL_H]);
    for (const [t0, t1, y0, y1] of segs) {
      if (t1 - t0 < 0.001) continue;
      let b: THREE.Mesh;
      if (side === 'back') b = boxBetween(mats, t0, y0, -hd - WALL_T, t1, y1, -hd);
      else if (side === 'front') b = boxBetween(mats, t0, y0, hd, t1, y1, hd + WALL_T);
      else if (side === 'left') b = boxBetween(mats, -hw - WALL_T, y0, t0, -hw, y1, t1);
      else b = boxBetween(mats, hw, y0, t0, hw + WALL_T, y1, t1);
      g.add(b);
    }
  };

  const doorDetails = (side: WallSide) => {
    for (const { e } of openings(side)) {
      const eg = exitGeometry(room, e);
      const g = uppers[side];
      const frame = new THREE.Group();
      // frame posts and head, on the inner face
      const along = eg.along;
      const nx = eg.nx;
      const nz = eg.nz;
      // Local +X runs along the wall; inward tells us which way local +Z faces.
      const theta = Math.atan2(-along.z, along.x);
      const inward = Math.sign(Math.sin(theta) * nx + Math.cos(theta) * nz) || 1;
      const place = (obj: THREE.Object3D, t: number, y: number, depth: number) => {
        obj.position.set(eg.x + along.x * t - nx * depth, y, eg.z + along.z * t - nz * depth);
        obj.rotation.y = theta;
        frame.add(obj);
      };
      const post = (t: number) => {
        const p = mesh(UNIT_BOX, m.charcoal);
        p.scale.set(0.05, DOOR_H, WALL_T + 0.02);
        place(p, t, DOOR_H / 2, WALL_T / 2);
      };
      post(-e.width / 2 + 0.025);
      post(e.width / 2 - 0.025);
      const head = mesh(UNIT_BOX, m.charcoal);
      head.scale.set(e.width, 0.05, WALL_T + 0.02);
      place(head, 0, DOOR_H - 0.025, WALL_T / 2);
      const sill = mesh(UNIT_BOX, m.charcoal, false);
      sill.scale.set(e.width, 0.01, WALL_T);
      place(sill, 0, 0.005, WALL_T / 2);
      // Door leaves stand open outward, in the direction of escape, with swing arcs drawn outside.
      const leaves = e.width >= 1.5 ? 2 : 1;
      const leafW = e.width / leaves - 0.03;
      for (let i = 0; i < leaves; i++) {
        const dir = leaves === 2 && i === 1 ? -1 : 1;
        const hingeT = dir > 0 ? -e.width / 2 + 0.04 : e.width / 2 - 0.04;
        const pivot = new THREE.Group();
        const glassy = side === 'front';
        const leaf = mesh(UNIT_BOX, glassy ? m.glass : m.oak);
        leaf.scale.set(leafW, DOOR_H - 0.06, 0.04);
        leaf.position.set((dir * leafW) / 2, (DOOR_H - 0.06) / 2, 0);
        pivot.add(leaf);
        if (glassy) {
          for (const y of [0.03, DOOR_H - 0.09]) {
            const rail = mesh(UNIT_BOX, m.charcoal);
            rail.scale.set(leafW, 0.06, 0.05);
            rail.position.set((dir * leafW) / 2, y, 0);
            pivot.add(rail);
          }
        }
        place(pivot, hingeT, 0, WALL_T + 0.03);
        pivot.rotation.y = theta + 1.25 * dir * inward;
        const arcGeo = new THREE.RingGeometry(leafW - 0.012, leafW, 32, 1, 0, Math.PI / 2);
        const arcMat = new THREE.MeshBasicMaterial({ color: '#2A2927', transparent: true, opacity: 0.45, depthWrite: false });
        const arc = new THREE.Mesh(arcGeo, arcMat);
        arc.rotation.x = -Math.PI / 2;
        arc.rotation.z = dir > 0 ? (inward > 0 ? 0 : -Math.PI / 2) : inward > 0 ? Math.PI / 2 : Math.PI;
        const arcHolder = new THREE.Group();
        arcHolder.add(arc);
        place(arcHolder, hingeT, -SLAB + 0.004, WALL_T + 0.03);
        disposables.push(arcGeo, arcMat);
      }
      // illuminated exit sign above the opening, inside
      const sign = mesh(UNIT_BOX, [m.exitGreen, m.exitGreen, m.exitGreen, m.exitGreen, m.exitSign, m.exitSign], false);
      sign.scale.set(0.38, 0.16, 0.05);
      place(sign, 0, DOOR_H + 0.22, -0.03);
      exitSigns.push(sign);
      g.add(frame);
    }
  };

  solidWall('back');
  solidWall('left');
  solidWall('right');
  doorDetails('back');
  doorDetails('left');
  doorDetails('right');

  // Storefront: bulkhead, glazing between mullions, signage fascia and awning.
  const front = walls.front;
  const frontUp = uppers.front;
  const z0 = hd;
  const z1 = hd + WALL_T;
  const ops = openings('front');
  const bays: [number, number][] = [];
  let t = -hw - WALL_T;
  for (const o of ops) {
    bays.push([t, o.t0]);
    t = o.t1;
  }
  bays.push([t, hw + WALL_T]);
  const glassTop = 2.55;
  for (const [a, b] of bays) {
    if (b - a < 0.01) continue;
    front.add(boxBetween([m.charcoal, m.charcoal, m.charcoal, m.charcoal, m.paint, m.paint], a, 0, z0, b, 0.42, z1));
    const g = boxBetween(m.glass, a, 0.42, z0 + 0.06, b, glassTop, z0 + 0.08);
    g.castShadow = false;
    frontUp.add(g);
    const nMull = Math.max(1, Math.round((b - a) / 1.6));
    for (let i = 0; i <= nMull; i++) {
      const x = a + ((b - a) * i) / nMull;
      frontUp.add(boxBetween(m.charcoal, x - 0.03, 0.42, z0, x + 0.03, glassTop, z1));
    }
  }
  // transom + fascia across the whole frontage
  frontUp.add(boxBetween(m.charcoal, -hw - WALL_T, glassTop, z0, hw + WALL_T, glassTop + 0.06, z1));
  const signTex = signTexture(opts.sign.text, opts.sign.brand, opts.sign.ink);
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 });
  disposables.push(signMat);
  let currentSignTex = signTex;
  const fasciaMats = [m.brandDark, m.brandDark, m.wallTop, m.brandDark, signMat, m.paint];
  frontUp.add(boxBetween(fasciaMats, -hw - WALL_T, glassTop + 0.06, z0, hw + WALL_T, WALL_H, z1 + 0.04));
  // awning over the glazing, clear of the doors
  for (const [a, b] of bays) {
    if (b - a < 0.8) continue;
    const aw = new THREE.Group();
    const len = b - a - 0.2;
    const depth = 0.85;
    const cloth = mesh(UNIT_BOX, m.brandFabric);
    cloth.scale.set(len, 0.03, depth);
    cloth.position.set(0, 0, depth / 2);
    cloth.rotation.x = 0;
    const tilt = new THREE.Group();
    tilt.add(cloth);
    tilt.rotation.x = 0.38;
    aw.add(tilt);
    const valance = mesh(UNIT_BOX, m.brandFabric);
    valance.scale.set(len, 0.16, 0.02);
    valance.position.set(0, -Math.sin(0.38) * depth - 0.08, Math.cos(0.38) * depth);
    aw.add(valance);
    aw.position.set((a + b) / 2, glassTop - 0.02, z1 + 0.04);
    frontUp.add(aw);
  }
  doorDetails('front');

  if (opts.ceiling) {
    const ceilMat = new THREE.MeshStandardMaterial({ color: '#F4EFE7', emissive: '#7E776C', roughness: 0.95 });
    disposables.push(ceilMat);
    const ceil = boxBetween(ceilMat, -hw - WALL_T, WALL_H, -hd - WALL_T, hw + WALL_T, WALL_H + 0.05, hd + WALL_T);
    ceil.castShadow = false;
    group.add(ceil);
    const shade = new THREE.CylinderGeometry(0.1, 0.22, 0.2, 24, 1, true);
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#FFE8B8' });
    disposables.push(shade, bulbMat);
    for (let x = -hw + 1.8; x < hw - 1; x += 2.6) {
      for (let z = -hd + 1.8; z < hd - 1; z += 2.6) {
        if (opts.avoid && Math.hypot(x - opts.avoid.x, z - opts.avoid.z) < 2.6) continue;
        const cord = mesh(UNIT_BOX, m.black, false);
        cord.scale.set(0.01, 0.8, 0.01);
        cord.position.set(x, WALL_H - 0.4, z);
        group.add(cord);
        const s = new THREE.Mesh(shade, m.charcoal);
        s.position.set(x, WALL_H - 0.9, z);
        group.add(s);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), bulbMat);
        bulb.position.set(x, WALL_H - 0.96, z);
        group.add(bulb);
        disposables.push(bulb.geometry);
      }
    }
  }

  if (opts.street) {
    const pave = boxBetween(m.oat, -hw - 8, -SLAB - 0.02, hd + WALL_T, hw + 8, -0.02, hd + 9);
    pave.castShadow = false;
    group.add(pave);
    const kerb = boxBetween(m.paint, -hw - 8, -SLAB - 0.02, hd + 4.5, hw + 8, 0.0, hd + 4.7);
    group.add(kerb);
  }

  return {
    group,
    walls,
    uppers,
    floorMat,
    grid,
    gridMat,
    exitSigns,
    setSign: (text, brand, ink) => {
      const next = signTexture(text, brand, ink);
      signMat.map = next;
      signMat.needsUpdate = true;
      currentSignTex.dispose();
      currentSignTex = next;
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      currentSignTex.dispose();
    },
  };
};

/** Should this wall be cut down to let the camera see in? Uses the camera's plan position. */
export const wallFacesCamera = (side: WallSide, room: Room, cam: THREE.Vector3) => {
  const m = 0.4;
  switch (side) {
    case 'front':
      return cam.z > room.depth / 2 + m;
    case 'back':
      return cam.z < -room.depth / 2 - m;
    case 'left':
      return cam.x < -room.width / 2 - m;
    case 'right':
      return cam.x > room.width / 2 + m;
  }
};
