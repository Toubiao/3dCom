import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import { menuTexture } from './textures';

/*
 * Procedural furniture. Each builder returns a group whose origin sits at the centre of the
 * footprint on the floor, with the "front" (customer side, seat facing) pointing to +Z.
 * Geometry is shared through small caches; meshes are scaled unit primitives.
 */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const cylCache = new Map<string, THREE.CylinderGeometry>();
const rbCache = new Map<string, RoundedBoxGeometry>();
const torusCache = new Map<string, THREE.TorusGeometry>();
const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
const leafGeo = new THREE.IcosahedronGeometry(1, 1);

const unitCyl = (taper = 1, seg = 24) => {
  const k = `${taper.toFixed(3)}:${seg}`;
  let g = cylCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(taper, 1, 1, seg);
    cylCache.set(k, g);
  }
  return g;
};

const roundedGeo = (w: number, h: number, d: number, r: number) => {
  const k = [w, h, d, r].map((v) => v.toFixed(3)).join(':');
  let g = rbCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    rbCache.set(k, g);
  }
  return g;
};

const finish = (m: THREE.Mesh) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

class Kit {
  readonly g = new THREE.Group();

  /** Box with its base at y. */
  box(mat: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0) {
    const m = finish(new THREE.Mesh(UNIT_BOX, mat));
    m.scale.set(w, h, d);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = ry;
    this.g.add(m);
    return m;
  }

  /** Rounded box with its base at y. */
  soft(mat: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, r = 0.04, rx = 0) {
    const m = finish(new THREE.Mesh(roundedGeo(w, h, d, r), mat));
    m.position.set(x, y + h / 2, z);
    m.rotation.x = rx;
    this.g.add(m);
    return m;
  }

  /** Vertical cylinder with its base at y. taper = top radius / bottom radius. */
  cyl(mat: THREE.Material, r: number, h: number, x = 0, y = 0, z = 0, taper = 1, seg = 24) {
    const m = finish(new THREE.Mesh(unitCyl(taper, seg), mat));
    m.scale.set(r, h, r);
    m.position.set(x, y + h / 2, z);
    this.g.add(m);
    return m;
  }

  /** Horizontal rod along X, centred at (x, y, z). */
  rodX(mat: THREE.Material, r: number, len: number, x = 0, y = 0, z = 0) {
    const m = finish(new THREE.Mesh(unitCyl(1, 12), mat));
    m.scale.set(r, len, r);
    m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z);
    this.g.add(m);
    return m;
  }

  ring(mat: THREE.Material, R: number, tube: number, y: number, x = 0, z = 0) {
    const k = `${R}:${tube}`;
    let geo = torusCache.get(k);
    if (!geo) {
      geo = new THREE.TorusGeometry(R, tube, 8, 32);
      torusCache.set(k, geo);
    }
    const m = finish(new THREE.Mesh(geo, mat));
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    this.g.add(m);
    return m;
  }

  sphere(mat: THREE.Material, r: number, x: number, y: number, z: number, sy = 1) {
    const m = finish(new THREE.Mesh(sphereGeo, mat));
    m.scale.set(r, r * sy, r);
    m.position.set(x, y, z);
    this.g.add(m);
    return m;
  }

  /** Four legs inset from a w × d rectangle. */
  legs(mat: THREE.Material, w: number, d: number, h: number, inset = 0.04, t = 0.035, round = false) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - inset);
        const z = sz * (d / 2 - inset);
        if (round) this.cyl(mat, t / 2, h, x, 0, z, 1, 10);
        else this.box(mat, t, h, t, x, 0, z);
      }
    }
  }
}

/** Deterministic pseudo-random for decorative goods. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

let menuMat: THREE.MeshStandardMaterial | null = null;

type Builder = (m: Materials, k: Kit) => void;

const table = (top: THREE.Material, leg: THREE.Material, w: number, d: number, h = 0.74, t = 0.035): Builder => (_m, k) => {
  k.box(top, w, t, d, 0, h - t);
  k.legs(leg, w, d, h - t, 0.06, 0.04);
};

const roundTable = (top: THREE.Material, base: THREE.Material, r: number, h: number): Builder => (_m, k) => {
  k.cyl(top, r, 0.03, 0, h - 0.03, 0, 1, 40);
  k.cyl(base, 0.03, h - 0.03, 0, 0, 0, 1, 12);
  k.cyl(base, Math.min(0.24, r * 0.75), 0.03, 0, 0, 0, 0.92, 32);
};

/** Counter carcass with a slatted brand front, top and plinth. */
const counter = (m: Materials, k: Kit, w: number, d: number, h: number, top: THREE.Material, slats = true) => {
  k.box(m.black, w - 0.06, 0.1, d - 0.12, 0, 0, -0.02);
  k.box(m.paint, w - 0.04, h - 0.14, d - 0.1, 0, 0.1, -0.03);
  if (slats) {
    k.box(m.brandDark, w - 0.04, h - 0.14, 0.02, 0, 0.1, d / 2 - 0.06);
    const n = Math.max(4, Math.round(w / 0.11));
    const sw = (w - 0.06) / n;
    for (let i = 0; i < n; i++) k.soft(m.brand, sw * 0.78, h - 0.16, 0.035, -w / 2 + 0.03 + sw * (i + 0.5), 0.11, d / 2 - 0.03, 0.012);
  } else {
    k.box(m.brand, w - 0.02, h - 0.14, 0.04, 0, 0.1, d / 2 - 0.04);
  }
  k.box(top, w + 0.04, 0.04, d + 0.03, 0, h - 0.04, 0);
};

const builders: Record<string, Builder> = {
  cafe_chair: (m, k) => {
    for (const [x, z] of [
      [-0.19, 0.19],
      [0.19, 0.19],
    ])
      k.cyl(m.charcoal, 0.014, 0.45, x, 0, z, 0.8, 10);
    for (const x of [-0.18, 0.18]) k.cyl(m.charcoal, 0.014, 0.82, x, 0, -0.2, 0.8, 10);
    k.box(m.walnut, 0.42, 0.03, 0.4, 0, 0.43, 0);
    k.soft(m.brandFabric, 0.4, 0.05, 0.38, 0, 0.46, 0.01, 0.02);
    k.soft(m.walnut, 0.4, 0.07, 0.025, 0, 0.7, -0.2, 0.01);
    k.box(m.charcoal, 0.36, 0.015, 0.015, 0, 0.22, 0.19);
  },
  bar_stool: (m, k) => {
    for (const [x, z] of [
      [-0.14, -0.14],
      [0.14, -0.14],
      [-0.14, 0.14],
      [0.14, 0.14],
    ])
      k.cyl(m.charcoal, 0.013, 0.68, x, 0, z, 0.8, 10);
    k.ring(m.charcoal, 0.155, 0.01, 0.28);
    k.cyl(m.walnut, 0.19, 0.03, 0, 0.66, 0, 1, 32);
    k.cyl(m.brandFabric, 0.18, 0.06, 0, 0.69, 0, 0.92, 32);
  },
  task_chair: (m, k) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = k.box(m.charcoal, 0.04, 0.03, 0.28, Math.sin(a) * 0.14, 0.05, Math.cos(a) * 0.14);
      leg.rotation.y = a;
      k.sphere(m.black, 0.03, Math.sin(a) * 0.27, 0.03, Math.cos(a) * 0.27);
    }
    k.cyl(m.steel, 0.025, 0.36, 0, 0.06, 0, 1, 12);
    k.soft(m.brandFabric, 0.5, 0.08, 0.48, 0, 0.42, 0.02, 0.035);
    const back = k.soft(m.brandFabric, 0.46, 0.46, 0.06, 0, 0.52, -0.24, 0.03);
    back.rotation.x = -0.12;
    k.box(m.charcoal, 0.04, 0.32, 0.03, 0, 0.42, -0.26);
    for (const x of [-0.25, 0.25]) {
      k.box(m.charcoal, 0.03, 0.18, 0.03, x, 0.46, -0.02);
      k.soft(m.black, 0.05, 0.03, 0.24, x, 0.64, -0.02, 0.012);
    }
  },
  lounge_chair: (m, k) => {
    for (const [x, z] of [
      [-0.32, -0.3],
      [0.32, -0.3],
      [-0.32, 0.3],
      [0.32, 0.3],
    ])
      k.cyl(m.walnut, 0.02, 0.12, x, 0, z, 0.7, 10);
    k.soft(m.brandFabric, 0.78, 0.22, 0.74, 0, 0.12, 0, 0.06);
    k.soft(m.oatFabric, 0.56, 0.1, 0.58, 0, 0.32, 0.06, 0.04);
    k.soft(m.brandFabric, 0.78, 0.44, 0.16, 0, 0.32, -0.3, 0.06);
    for (const x of [-0.33, 0.33]) k.soft(m.brandFabric, 0.12, 0.26, 0.7, x, 0.32, 0.02, 0.05);
  },
  sofa: (m, k) => {
    for (const x of [-0.72, 0.72]) for (const z of [-0.34, 0.34]) k.cyl(m.walnut, 0.022, 0.12, x, 0, z, 0.7, 10);
    k.soft(m.brandFabric, 1.6, 0.24, 0.84, 0, 0.12, 0, 0.06);
    for (const x of [-0.34, 0.34]) k.soft(m.brandFabric, 0.66, 0.12, 0.6, x, 0.34, 0.08, 0.05);
    k.soft(m.brandFabric, 1.6, 0.44, 0.2, 0, 0.34, -0.32, 0.07);
    for (const x of [-0.72, 0.72]) k.soft(m.brandFabric, 0.16, 0.24, 0.84, x, 0.34, 0, 0.06);
    k.soft(m.oatFabric, 0.38, 0.32, 0.1, -0.42, 0.44, -0.18, 0.05, -0.25);
  },
  banquette: (m, k) => {
    k.box(m.oak, 2.4, 0.36, 0.62, 0, 0, 0.0);
    k.box(m.black, 2.36, 0.08, 0.56, 0, 0, 0.02);
    k.soft(m.brandFabric, 2.38, 0.1, 0.5, 0, 0.36, 0.06, 0.04);
    const n = 6;
    for (let i = 0; i < n; i++) k.soft(m.brandFabric, 2.38 / n - 0.012, 0.5, 0.11, -1.19 + (2.38 / n) * (i + 0.5), 0.47, -0.25, 0.045);
    k.box(m.oak, 2.4, 0.04, 0.14, 0, 0.97, -0.26);
  },
  booth: (m, k) => {
    for (const s of [-1, 1]) {
      const z = s * 0.78;
      k.box(m.oak, 1.3, 0.34, 0.5, 0, 0, z);
      k.soft(m.brandFabric, 1.28, 0.1, 0.46, 0, 0.34, z - s * 0.02, 0.04);
      k.soft(m.brandFabric, 1.28, 0.7, 0.14, 0, 0.44, z + s * 0.2, 0.05);
      k.box(m.oak, 1.3, 0.05, 0.16, 0, 1.12, z + s * 0.2);
    }
    k.box(m.walnut, 1.2, 0.035, 0.66, 0, 0.705);
    k.cyl(m.charcoal, 0.04, 0.7, 0, 0, 0, 1, 12);
    k.box(m.charcoal, 0.6, 0.03, 0.4, 0, 0, 0);
  },
  bench: (m, k) => {
    k.box(m.oak, 1.6, 0.05, 0.4, 0, 0.4);
    for (const x of [-0.68, 0.68]) k.box(m.oak, 0.05, 0.4, 0.34, x, 0, 0);
  },
  bistro_table: (m, k) => roundTable(m.stone, m.charcoal, 0.3, 0.74)(m, k),
  table_2: (m, k) => table(m.oak, m.charcoal, 0.7, 0.7)(m, k),
  table_4: (m, k) => table(m.oak, m.charcoal, 1.2, 0.8)(m, k),
  table_6: (m, k) => table(m.oak, m.charcoal, 1.8, 0.9)(m, k),
  communal_table: (m, k) => {
    k.box(m.oak, 3.0, 0.05, 1.0, 0, 0.69);
    for (const x of [-1.15, 1.15]) {
      k.box(m.charcoal, 0.05, 0.69, 0.05, x, 0, -0.38);
      k.box(m.charcoal, 0.05, 0.69, 0.05, x, 0, 0.38);
      k.box(m.charcoal, 0.05, 0.05, 0.8, x, 0.62, 0);
      k.box(m.charcoal, 0.05, 0.04, 0.8, x, 0.08, 0);
    }
    k.box(m.charcoal, 2.3, 0.04, 0.04, 0, 0.3, 0);
  },
  high_top: (m, k) => roundTable(m.walnut, m.charcoal, 0.35, 1.05)(m, k),
  coffee_table: (m, k) => {
    k.soft(m.walnut, 0.9, 0.04, 0.5, 0, 0.36, 0, 0.015);
    k.legs(m.walnut, 0.9, 0.5, 0.36, 0.07, 0.035, true);
    k.box(m.oak, 0.22, 0.03, 0.16, 0.18, 0.4, 0.04);
  },

  espresso_bar: (m, k) => {
    counter(m, k, 3.6, 0.8, 1.05, m.stone);
    // espresso machine
    k.soft(m.steel, 0.82, 0.42, 0.5, -0.65, 1.05, -0.08, 0.04);
    k.box(m.brand, 0.84, 0.06, 0.52, -0.65, 1.47, -0.08);
    for (const x of [-0.92, -0.65, -0.38]) k.cyl(m.black, 0.03, 0.08, x, 1.13, -0.36, 1, 12);
    // grinders
    for (const x of [0.25, 0.55]) {
      k.box(m.charcoal, 0.18, 0.36, 0.24, x, 1.05, -0.12);
      k.cyl(m.glass, 0.08, 0.2, x, 1.41, -0.12, 1.3, 16);
    }
    // register and cups
    k.box(m.charcoal, 0.3, 0.06, 0.24, 1.25, 1.05, -0.05);
    const screen = k.box(m.screen, 0.26, 0.18, 0.02, 1.25, 1.11, 0.0);
    screen.rotation.x = -0.4;
    for (let i = 0; i < 4; i++) k.cyl(m.cream, 0.04, 0.09, 0.9 + (i % 2) * 0.09, 1.05, -0.25 + Math.floor(i / 2) * 0.09, 0.85, 12);
  },
  pastry_case: (m, k) => {
    k.box(m.black, 1.44, 0.08, 0.62, 0, 0, -0.03);
    k.box(m.paint, 1.48, 0.76, 0.66, 0, 0.08, -0.03);
    k.box(m.brand, 1.5, 0.76, 0.04, 0, 0.08, 0.35);
    k.box(m.stone, 1.52, 0.03, 0.75, 0, 0.84, 0);
    const glass = k.box(m.glass, 1.46, 0.36, 0.05, 0, 0.87, 0.3);
    glass.rotation.x = -0.35;
    k.box(m.glass, 0.03, 0.38, 0.6, -0.72, 0.87, 0.02);
    k.box(m.glass, 0.03, 0.38, 0.6, 0.72, 0.87, 0.02);
    k.box(m.stone, 1.5, 0.03, 0.5, 0, 1.22, -0.08);
    k.box(m.glass, 1.4, 0.01, 0.5, 0, 1.04, 0.0);
    for (let i = 0; i < 10; i++) {
      const x = -0.6 + (i % 5) * 0.3;
      const y = i < 5 ? 0.9 : 1.06;
      k.sphere(i % 3 ? m.oak : m.cream, 0.06, x, y + 0.03, -0.02 + (i % 2) * 0.08, 0.55);
    }
  },
  back_counter: (m, k) => {
    k.box(m.black, 2.96, 0.08, 0.52, 0, 0, 0.0);
    k.box(m.paint, 3.0, 0.8, 0.58, 0, 0.08, -0.01);
    for (let i = 0; i < 5; i++) {
      const x = -1.2 + i * 0.6;
      k.box(m.wallTop, 0.004, 0.78, 0.01, x + 0.3, 0.09, 0.285);
      k.box(m.charcoal, 0.16, 0.015, 0.02, x, 0.78, 0.3);
    }
    k.box(m.stone, 3.04, 0.04, 0.6, 0, 0.88, 0);
    for (let i = 0; i < 6; i++) k.cyl(i % 2 ? m.brand : m.cream, 0.035, 0.24, -1.2 + i * 0.12, 0.92, -0.12, 0.6, 10);
    k.box(m.steel, 0.5, 0.35, 0.4, 0.9, 0.92, -0.05);
  },
  window_counter: (m, k) => {
    k.box(m.oak, 3.0, 0.05, 0.45, 0, 1.0);
    for (const x of [-1.35, 0, 1.35]) {
      k.box(m.charcoal, 0.04, 1.0, 0.04, x, 0, -0.12);
      k.box(m.charcoal, 0.04, 0.04, 0.36, x, 0.96, 0);
    }
    k.rodX(m.brass, 0.014, 2.9, 0, 0.22, -0.1);
  },
  condiment: (m, k) => {
    k.box(m.oak, 0.9, 0.88, 0.5, 0, 0, 0);
    k.box(m.stone, 0.92, 0.04, 0.52, 0, 0.88, 0);
    k.box(m.black, 0.22, 0.02, 0.05, 0.22, 0.6, 0.255);
    k.cyl(m.steel, 0.06, 0.2, -0.25, 0.92, 0, 1, 16);
    k.cyl(m.cream, 0.05, 0.12, 0, 0.92, 0, 1, 16);
    k.box(m.oak, 0.2, 0.1, 0.16, 0.25, 0.92, 0);
  },
  bar_counter: (m, k) => {
    counter(m, k, 4.0, 0.7, 1.1, m.walnut, false);
    k.rodX(m.brass, 0.022, 3.9, 0, 0.22, 0.42);
    for (let i = 0; i < 4; i++) {
      const x = -0.6 + i * 0.22;
      k.cyl(m.brass, 0.02, 0.36, x, 1.1, -0.15, 1, 12);
      k.box(m.black, 0.03, 0.12, 0.03, x, 1.34, -0.12);
    }
    for (let i = 0; i < 6; i++) k.cyl(m.glass, 0.035, 0.14, 0.8 + (i % 3) * 0.12, 1.1, -0.1 + Math.floor(i / 3) * 0.12, 1.1, 12);
  },
  host_stand: (m, k) => {
    k.box(m.black, 0.5, 0.06, 0.36, 0, 0, 0);
    k.box(m.brand, 0.56, 0.98, 0.42, 0, 0.06, 0);
    const top = k.box(m.walnut, 0.62, 0.04, 0.48, 0, 1.04, 0);
    top.rotation.x = 0.15;
    k.cyl(m.brass, 0.012, 0.3, 0.2, 1.08, -0.12, 1, 8);
    k.sphere(m.cream, 0.05, 0.2, 1.4, -0.12);
  },
  kitchen_line: (m, k) => {
    k.box(m.steel, 3.6, 0.9, 0.9, 0, 0, 0);
    for (let i = 0; i < 6; i++) k.box(m.black, 0.012, 0.6, 0.01, -1.5 + i * 0.6, 0.12, 0.455);
    k.box(m.steel, 3.62, 0.04, 0.92, 0, 0.9, 0);
    for (let i = 0; i < 4; i++) {
      k.box(m.black, 0.5, 0.03, 0.5, -1.25 + i * 0.6, 0.94, 0.05);
      k.ring(m.charcoal, 0.12, 0.012, 0.98, -1.25 + i * 0.6, 0.05);
    }
    k.box(m.black, 0.6, 0.12, 0.5, 1.2, 0.94, 0.05);
    k.cyl(m.steel, 0.12, 0.18, 1.25, 0.98, 0.1, 1, 16);
    k.box(m.steel, 3.6, 0.5, 0.9, 0, 2.1, -0.05);
    k.box(m.steel, 0.4, 0.5, 0.3, 0, 2.6, -0.2);
  },
  menu_board: (m, k) => {
    if (!menuMat) menuMat = new THREE.MeshStandardMaterial({ map: menuTexture(), roughness: 0.85 });
    k.box(m.brand, 1.84, 1.0, 0.04, 0, 1.45, -0.01);
    const board = k.box(menuMat, 1.72, 0.88, 0.02, 0, 1.51, 0.02);
    board.castShadow = false;
  },

  desk: (m, k) => {
    k.box(m.oak, 1.4, 0.03, 0.7, 0, 0.71);
    for (const x of [-0.66, 0.66]) {
      k.box(m.charcoal, 0.04, 0.71, 0.6, x, 0, 0);
    }
    k.box(m.charcoal, 1.2, 0.08, 0.02, 0, 0.6, -0.28);
    k.box(m.charcoal, 0.2, 0.02, 0.16, 0, 0.74, -0.18);
    k.box(m.charcoal, 0.04, 0.24, 0.04, 0, 0.75, -0.2);
    const s = k.box(m.screen, 0.6, 0.36, 0.025, 0, 0.92, -0.2);
    s.castShadow = true;
    k.box(m.cream, 0.42, 0.015, 0.14, 0, 0.74, 0.08);
  },
  desk_pod: (m, k) => {
    k.box(m.oak, 2.8, 0.03, 1.4, 0, 0.71);
    for (const x of [-1.36, 0, 1.36]) k.box(m.charcoal, 0.04, 0.71, 1.24, x, 0, 0);
    k.soft(m.brandFabric, 2.76, 0.42, 0.035, 0, 0.74, 0, 0.012);
    for (const x of [-0.7, 0.7]) {
      for (const s of [-1, 1]) {
        k.box(m.charcoal, 0.18, 0.02, 0.14, x, 0.74, s * 0.18);
        k.box(m.charcoal, 0.035, 0.2, 0.035, x, 0.75, s * 0.2);
        const scr = k.box(m.screen, 0.56, 0.34, 0.025, x, 0.88, s * 0.21);
        scr.rotation.y = s > 0 ? Math.PI : 0;
        k.box(m.cream, 0.4, 0.015, 0.13, x, 0.74, s * 0.48);
      }
    }
  },
  meeting_table: (m, k) => {
    k.soft(m.walnut, 2.4, 0.04, 1.1, 0, 0.7, 0, 0.018);
    for (const x of [-0.8, 0.8]) {
      k.box(m.charcoal, 0.08, 0.7, 0.5, x, 0, 0);
      k.box(m.charcoal, 0.12, 0.03, 0.8, x, 0, 0);
    }
    k.box(m.charcoal, 0.3, 0.02, 0.12, 0, 0.74, 0);
  },
  phone_booth: (m, k) => {
    k.box(m.charcoal, 1.0, 0.06, 1.0, 0, 0, 0);
    k.box(m.brand, 1.0, 2.1, 0.06, 0, 0.06, -0.47);
    for (const x of [-0.47, 0.47]) k.box(m.brand, 0.06, 2.1, 1.0, x, 0.06, 0);
    k.box(m.paint, 1.0, 0.08, 1.0, 0, 2.12, 0);
    k.box(m.glass, 0.88, 2.06, 0.02, 0, 0.06, 0.48);
    for (const x of [-0.44, 0.44]) k.box(m.charcoal, 0.03, 2.06, 0.03, x, 0.06, 0.48);
    k.box(m.charcoal, 0.03, 0.4, 0.04, 0.32, 0.9, 0.5);
    k.box(m.oak, 0.6, 0.03, 0.3, 0, 0.95, -0.28);
    k.soft(m.oatFabric, 0.4, 0.1, 0.36, 0, 0.42, 0.05, 0.03);
    k.cyl(m.charcoal, 0.03, 0.42, 0, 0.06, 0.05, 1, 10);
    k.sphere(m.cream, 0.06, 0, 1.98, -0.1, 0.5);
  },
  reception: (m, k) => {
    k.box(m.black, 2.14, 0.08, 0.7, 0, 0, -0.02);
    k.box(m.paint, 2.2, 0.66, 0.6, 0, 0.08, -0.08);
    k.box(m.brand, 2.2, 0.98, 0.06, 0, 0.08, 0.37);
    for (const x of [-1.07, 1.07]) k.box(m.brand, 0.06, 0.98, 0.4, x, 0.08, 0.18);
    k.box(m.stone, 2.26, 0.04, 0.3, 0, 1.06, 0.26);
    k.box(m.oak, 2.16, 0.03, 0.62, 0, 0.74, -0.08);
    const s = k.box(m.screen, 0.5, 0.3, 0.02, 0.4, 0.8, -0.1);
    s.rotation.y = Math.PI;
    k.cyl(m.oak, 0.08, 0.28, -0.7, 1.1, 0.25, 0.7, 14);
    k.sphere(m.leaf, 0.12, -0.7, 1.45, 0.25, 0.9);
  },
  lockers: (m, k) => {
    k.box(m.black, 1.96, 0.08, 0.44, 0, 0, 0);
    k.box(m.paint, 2.0, 1.82, 0.48, 0, 0.08, -0.01);
    k.box(m.brand, 1.98, 1.78, 0.02, 0, 0.1, 0.24);
    for (let i = 1; i < 5; i++) k.box(m.paint, 0.012, 1.78, 0.025, -1 + i * 0.4, 0.1, 0.25);
    for (let j = 1; j < 4; j++) k.box(m.paint, 1.98, 0.012, 0.025, 0, 0.1 + j * 0.445, 0.25);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) k.box(m.cream, 0.05, 0.02, 0.02, -0.8 + i * 0.4 + 0.1, 0.4 + j * 0.445, 0.26);
  },
  storage: (m, k) => {
    k.box(m.oak, 1.6, 0.68, 0.45, 0, 0.07, 0);
    for (const x of [-0.4, 0.4]) k.box(m.walnut, 0.78, 0.6, 0.02, x, 0.11, 0.23);
    k.legs(m.charcoal, 1.6, 0.45, 0.07, 0.06, 0.03);
    k.cyl(m.pot, 0.07, 0.22, -0.5, 0.75, 0, 0.8, 16);
    k.box(m.goods[3], 0.3, 0.04, 0.22, 0.3, 0.75, 0);
  },
  kitchenette: (m, k) => {
    k.box(m.black, 2.36, 0.08, 0.56, 0, 0, 0);
    k.box(m.paint, 2.4, 0.8, 0.62, 0, 0.08, -0.01);
    for (let i = 0; i < 4; i++) k.box(m.charcoal, 0.14, 0.015, 0.02, -0.9 + i * 0.6, 0.78, 0.31);
    k.box(m.stone, 2.42, 0.04, 0.65, 0, 0.88, 0);
    k.box(m.steel, 0.5, 0.02, 0.38, -0.5, 0.92, 0);
    k.cyl(m.steel, 0.012, 0.28, -0.5, 0.92, -0.22, 1, 8);
    k.box(m.black, 0.32, 0.4, 0.36, 0.45, 0.92, -0.06);
    k.box(m.steel, 0.6, 1.95, 0.64, 0.92, 0, 0.0);
  },
  whiteboard: (m, k) => {
    for (const x of [-0.72, 0.72]) {
      k.box(m.charcoal, 0.04, 1.9, 0.04, x, 0, 0);
      k.box(m.charcoal, 0.06, 0.03, 0.46, x, 0.06, 0);
      for (const z of [-0.2, 0.2]) k.sphere(m.black, 0.03, x, 0.03, z);
    }
    k.box(m.cream, 1.42, 1.0, 0.025, 0, 0.82, 0);
    k.box(m.brand, 0.3, 0.02, 0.05, 0.4, 0.8, 0.02);
  },

  wall_shelf: (m, k) => {
    k.box(m.brand, 2.4, 2.2, 0.03, 0, 0, -0.2);
    for (const x of [-1.18, 0, 1.18]) k.box(m.charcoal, 0.04, 2.2, 0.42, x, 0, 0);
    for (let j = 0; j < 5; j++) {
      const y = 0.12 + j * 0.46;
      k.box(m.oak, 2.36, 0.03, 0.4, 0, y, 0.01);
      if (j === 0) continue;
      for (let i = 0; i < 6; i++) {
        const h = hash(j * 13 + i);
        const x = -1.0 + i * 0.4 + (h - 0.5) * 0.06;
        const goods = m.goods[Math.floor(h * m.goods.length)];
        const hh = 0.12 + hash(i * 7 + j) * 0.18;
        k.box(goods, 0.26 + h * 0.06, hh, 0.26, x, y + 0.03, 0.02);
      }
    }
  },
  gondola: (m, k) => {
    k.box(m.charcoal, 1.8, 0.12, 0.86, 0, 0, 0);
    k.box(m.paint, 1.8, 1.28, 0.06, 0, 0.12, 0);
    for (let j = 0; j < 3; j++) {
      const y = 0.12 + j * 0.42;
      for (const s of [-1, 1]) {
        k.box(m.oak, 1.76, 0.025, 0.38, 0, y, s * 0.22);
        for (let i = 0; i < 5; i++) {
          const h = hash(j * 31 + i * 3 + s);
          k.box(m.goods[Math.floor(h * m.goods.length)], 0.26, 0.1 + h * 0.18, 0.26, -0.7 + i * 0.35, y + 0.025, s * 0.22);
        }
      }
    }
  },
  display_table: (m, k) => {
    k.box(m.oak, 1.6, 0.04, 0.9, 0, 0.81);
    k.legs(m.charcoal, 1.6, 0.9, 0.81, 0.05, 0.04);
    k.box(m.walnut, 1.3, 0.035, 0.7, 0, 0.42);
    for (let i = 0; i < 4; i++) {
      const h = hash(i + 5);
      for (let s = 0; s < 3; s++) k.box(m.goods[(i + s) % m.goods.length], 0.3, 0.035, 0.24, -0.55 + i * 0.37, 0.85 + s * 0.035, -0.12 + (i % 2) * 0.24);
      k.box(m.goods[Math.floor(h * 5)], 0.26, 0.05, 0.22, -0.45 + i * 0.3, 0.455, 0);
    }
  },
  clothing_rail: (m, k) => {
    for (const x of [-0.72, 0.72]) {
      k.box(m.charcoal, 0.03, 1.6, 0.03, x, 0, 0);
      k.box(m.charcoal, 0.04, 0.03, 0.48, x, 0, 0);
    }
    k.rodX(m.charcoal, 0.012, 1.46, 0, 1.58, 0);
    for (let i = 0; i < 11; i++) {
      const h = hash(i * 3 + 1);
      const gm = k.box(m.goods[Math.floor(h * m.goods.length)], 0.035, 0.7 + h * 0.3, 0.42, -0.6 + i * 0.12, 1.5 - (0.7 + h * 0.3), 0);
      gm.rotation.y = (h - 0.5) * 0.2;
    }
  },
  cash_wrap: (m, k) => {
    counter(m, k, 2.0, 0.8, 1.0, m.stone, false);
    k.box(m.charcoal, 0.3, 0.06, 0.24, 0.5, 1.0, -0.1);
    const s = k.box(m.screen, 0.26, 0.18, 0.02, 0.5, 1.06, -0.05);
    s.rotation.x = -0.4;
    k.box(m.cream, 0.5, 0.02, 0.4, -0.4, 1.0, -0.05);
    k.box(m.brandSoft, 0.24, 0.18, 0.12, -0.45, 1.02, -0.05);
  },
  plinth: (m, k) => {
    k.box(m.brand, 0.6, 0.86, 0.6, 0, 0, 0);
    k.box(m.stone, 0.62, 0.04, 0.62, 0, 0.86, 0);
    k.box(m.goods[2], 0.26, 0.2, 0.12, 0, 0.9, 0);
    k.rodX(m.charcoal, 0.008, 0.18, 0, 1.13, 0);
  },
  mannequin: (m, k) => {
    k.cyl(m.charcoal, 0.2, 0.03, 0, 0, 0, 0.95, 32);
    k.cyl(m.steel, 0.012, 0.8, 0, 0.03, 0, 1, 8);
    k.cyl(m.goods[1], 0.24, 0.72, 0, 0.66, 0, 0.55, 28);
    k.cyl(m.skin, 0.13, 0.32, 0, 1.36, 0, 0.75, 20);
    k.cyl(m.skin, 0.04, 0.08, 0, 1.68, 0, 1, 10);
    k.sphere(m.skin, 0.095, 0, 1.84, 0, 1.2);
    for (const x of [-0.15, 0.15]) {
      const arm = k.cyl(m.skin, 0.03, 0.55, x, 1.08, 0, 0.8, 10);
      arm.rotation.z = x > 0 ? 0.1 : -0.1;
    }
  },
  fitting_room: (m, k) => {
    k.box(m.oak, 1.2, 0.02, 1.2, 0, 0, 0);
    k.box(m.paint, 1.2, 2.2, 0.05, 0, 0, -0.575);
    for (const x of [-0.575, 0.575]) k.box(m.paint, 0.05, 2.2, 1.2, x, 0, 0);
    k.box(m.mirror, 0.5, 1.4, 0.01, 0, 0.4, -0.545);
    k.box(m.charcoal, 1.2, 0.04, 0.04, 0, 2.16, 0.58);
    for (let i = 0; i < 8; i++) {
      const c = k.soft(m.brandFabric, 0.17, 1.92, 0.05, -0.52 + i * 0.12, 0.2, 0.56 + (i % 2) * 0.03, 0.02);
      c.rotation.y = (i % 2 ? 1 : -1) * 0.35;
      if (i > 5) c.position.x += 0.08;
    }
    k.cyl(m.oak, 0.16, 0.45, 0.3, 0.02, -0.2, 1, 20);
    k.cyl(m.brass, 0.01, 0.12, -0.45, 1.6, -0.5, 1, 8);
  },

  planter: (m, k) => {
    k.cyl(m.pot, 0.27, 0.5, 0, 0, 0, 1.15, 28);
    k.cyl(m.walnut, 0.29, 0.03, 0, 0.47, 0, 1, 28);
    k.cyl(m.walnut, 0.025, 0.55, 0.02, 0.48, 0, 0.7, 8);
    const blobs = [
      [0, 1.32, 0, 0.3],
      [0.18, 1.18, 0.08, 0.22],
      [-0.16, 1.22, -0.06, 0.24],
      [0.05, 1.5, -0.1, 0.2],
      [-0.08, 1.12, 0.16, 0.18],
      [0.12, 1.42, 0.14, 0.17],
    ];
    blobs.forEach(([x, y, z, r], i) => {
      const leaf = finish(new THREE.Mesh(leafGeo, i % 2 ? m.leafDark : m.leaf));
      leaf.scale.set(r, r * 0.85, r);
      leaf.position.set(x, y, z);
      leaf.rotation.set(i, i * 2, 0);
      k.g.add(leaf);
    });
  },
  rug: (m, k) => {
    const a = k.box(m.brand, 3.0, 0.008, 2.0, 0, 0.002, 0);
    const b = k.box(m.brandSoft, 2.7, 0.009, 1.7, 0, 0.003, 0);
    const c = k.box(m.brand, 0.05, 0.01, 1.4, -0.9, 0.004, 0);
    const d = k.box(m.brand, 0.05, 0.01, 1.4, 0.9, 0.004, 0);
    for (const mesh of [a, b, c, d]) mesh.castShadow = false;
  },
  partition: (m, k) => {
    k.box(m.charcoal, 2.0, 0.06, 0.12, 0, 0, 0);
    k.box(m.brandPaint, 1.96, 1.04, 0.08, 0, 0.06, 0);
    k.box(m.glass, 1.92, 1.24, 0.02, 0, 1.1, 0);
    for (const x of [-0.98, 0.98]) k.box(m.charcoal, 0.04, 2.4, 0.1, x, 0, 0);
    k.box(m.charcoal, 2.0, 0.04, 0.1, 0, 2.36, 0);
    k.box(m.charcoal, 2.0, 0.03, 0.1, 0, 1.08, 0);
  },
};

export const buildItem = (type: string, m: Materials): THREE.Group => {
  const k = new Kit();
  const b = builders[type];
  if (b) b(m, k);
  else k.box(m.oat, 0.5, 0.5, 0.5);
  return k.g;
};
