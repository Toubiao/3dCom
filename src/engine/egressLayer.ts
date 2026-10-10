import * as THREE from 'three';
import type { Room } from '../types';
import type { EgressResult } from '../logic/egress';
import { exitGeometry, type Vec2 } from '../logic/geometry';
import { chevronTexture } from './textures';

const TILE = 0.5; // metres of route per chevron

/** Triangle strip along a polyline, with U measured in chevron tiles from the start. */
const ribbonGeometry = (pts: Vec2[], width: number, y: number) => {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const nx = -tz;
    const nz = tx;
    if (i > 0) u += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) / TILE;
    const hw = width / 2;
    pos.push(p.x + nx * hw, y, p.z + nz * hw, p.x - nx * hw, y, p.z - nz * hw);
    uv.push(u, 1, u, 0);
    if (i < pts.length - 1) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
};

const stripeTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(194,65,45,0.25)';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(194,65,45,0.85)';
  ctx.lineWidth = 8;
  for (let i = -64; i < 128; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i, 64);
    ctx.lineTo(i + 64, 0);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export class EgressLayer {
  readonly group = new THREE.Group();
  private chevrons = chevronTexture();
  private ribbonMat = new THREE.MeshBasicMaterial({
    map: this.chevrons,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  private longMat = new THREE.MeshBasicMaterial({
    map: this.chevrons,
    color: '#FFFFFF',
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  private exitMat = new THREE.MeshBasicMaterial({ color: '#0E8C52', transparent: true, opacity: 0.35, depthWrite: false });
  private blockedMat: THREE.MeshBasicMaterial;
  private dotMat = new THREE.MeshBasicMaterial({ color: '#C2412D', transparent: true, opacity: 0.9, depthWrite: false });
  private content = new THREE.Group();
  private reveal = 0;
  private visible = false;
  private opacity = 0;
  private time = 0;
  private ribbons: { mesh: THREE.Mesh; count: number }[] = [];
  private pulses: THREE.Mesh[] = [];
  /** World anchor for the "max travel" label, or null. */
  labelAnchor: THREE.Vector3 | null = null;
  labelText = '';

  constructor() {
    const stripes = stripeTexture();
    this.blockedMat = new THREE.MeshBasicMaterial({ map: stripes, transparent: true, depthWrite: false });
    this.group.add(this.content);
    this.group.visible = false;
  }

  setVisible(on: boolean) {
    if (on && !this.visible) this.reveal = 0;
    this.visible = on;
    if (on) this.group.visible = true;
  }

  update(room: Room, result: EgressResult, replay = false) {
    this.content.children.forEach((c) => {
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    });
    this.content.clear();
    this.ribbons = [];
    this.pulses = [];
    if (replay) this.reveal = 0;

    const longest = result.maxTravelRoute;
    result.routes.forEach((r, i) => {
      if (r.points.length < 2) return;
      const g = ribbonGeometry(r.points, 0.26, 0.022 + i * 0.0004);
      const mesh = new THREE.Mesh(g, this.ribbonMat);
      mesh.renderOrder = 5;
      this.content.add(mesh);
      this.ribbons.push({ mesh, count: g.index!.count });
    });
    if (longest && longest.points.length > 1) {
      const g = ribbonGeometry(longest.points, 0.34, 0.03);
      const mesh = new THREE.Mesh(g, this.longMat);
      mesh.renderOrder = 6;
      this.content.add(mesh);
      this.ribbons.push({ mesh, count: g.index!.count });
      const p0 = longest.points[0];
      this.labelAnchor = new THREE.Vector3(p0.x, 0.05, p0.z);
      this.labelText = `${longest.length.toFixed(1)} m to exit`;
    } else {
      this.labelAnchor = null;
    }

    for (const e of room.exits) {
      const eg = exitGeometry(room, e);
      const blocked = result.obstructedExits.includes(e.id);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(e.width, 1.1), blocked ? this.blockedMat : this.exitMat);
      plane.rotation.x = -Math.PI / 2;
      const ang = Math.atan2(eg.nx, eg.nz);
      plane.rotation.z = ang;
      plane.position.set(eg.x + eg.nx * 0.55, 0.018, eg.z + eg.nz * 0.55);
      plane.renderOrder = 4;
      this.content.add(plane);
      if (!blocked) this.pulses.push(plane);
    }
    for (const p of result.unreachableSeats) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 24), this.dotMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.9, p.z);
      ring.renderOrder = 7;
      this.content.add(ring);
    }
  }

  /** Returns true while something is moving (always, when shown). */
  tick(dt: number): boolean {
    const target = this.visible ? 1 : 0;
    this.opacity += (target - this.opacity) * Math.min(1, dt * 8);
    if (!this.visible && this.opacity < 0.01) {
      this.group.visible = false;
      this.opacity = 0;
      return false;
    }
    this.time += dt;
    this.reveal = Math.min(1, this.reveal + dt / 1.1);
    const ease = 1 - Math.pow(1 - this.reveal, 3);
    this.chevrons.offset.x -= dt * 1.6;
    this.ribbonMat.opacity = 0.8 * this.opacity;
    this.longMat.opacity = this.opacity;
    for (const r of this.ribbons) {
      const n = Math.floor((r.count / 6) * ease) * 6;
      r.mesh.geometry.setDrawRange(0, n);
    }
    const pulse = 0.25 + 0.2 * (0.5 + 0.5 * Math.sin(this.time * 4));
    this.exitMat.opacity = pulse * this.opacity;
    this.blockedMat.opacity = this.opacity;
    this.dotMat.opacity = 0.9 * this.opacity;
    return true;
  }
}
