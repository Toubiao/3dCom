import * as THREE from 'three';
import { store, type Store } from '../state/store';
import { getDef } from '../data/catalog';
import { TEMPLATES } from '../data/templates';
import type { PlacedItem, Room, TemplateId, ViewMode, WallSide } from '../types';
import { Materials } from './materials';
import { buildItem } from './furniture';
import { buildRoom, wallFacesCamera, WALL_T, type RoomRig } from './room';
import { EgressLayer } from './egressLayer';
import { applyPose, blendPose, easeInOut, PERSP_FOV, PLAN_FOV, perspExtent, planExtent, type Pose } from './cameraRig';
import { clampToRoom, footprint } from '../logic/geometry';
import { getEgress } from '../logic/analysis';
import { money } from '../logic/cost';
import { inkFor } from '../logic/color';

interface ItemView {
  id: string;
  type: string;
  group: THREE.Group;
  x: number;
  z: number;
  rot: number;
  scale: number;
  born: number; // seconds; pop animation start
  removing: number | null;
}

type Pane = 'plan' | 'main';

interface DragState {
  kind: 'move' | 'rotate' | 'orbit' | 'pan';
  pane: Pane;
  id?: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  grabDX: number;
  grabDZ: number;
  moved: boolean;
  pointerId: number;
}

const VIEW_TARGET: Record<ViewMode, { r: number; t: number }> = {
  plan: { r: 0, t: 0 },
  split: { r: 0.5, t: 1 },
  '3d': { r: 0, t: 1 },
};

const DEFAULT_AZ = -0.62;
const DEFAULT_POLAR = 0.98;

const easeOutBack = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const lightRig = () => {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight('#FFF8EC', '#CDBFA8', 1.15);
  g.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF3E0', 2.3);
  sun.position.set(-7, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  g.add(sun);
  g.add(sun.target);
  const fill = new THREE.DirectionalLight('#E6EEFF', 0.45);
  fill.position.set(8, 6, -6);
  g.add(fill);
  return { group: g, sun };
};

const fitShadow = (sun: THREE.DirectionalLight, room: Room) => {
  const s = Math.max(room.width, room.depth) / 2 + 4;
  const cam = sun.shadow.camera;
  cam.left = -s;
  cam.right = s;
  cam.top = s;
  cam.bottom = -s;
  cam.near = 1;
  cam.far = 50;
  cam.updateProjectionMatrix();
};

export interface CaptureOptions {
  width: number;
  height: number;
  shot: 'aerial' | 'storefront' | 'photo';
  templateId?: TemplateId;
  jpeg?: boolean;
}

export class Planner {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly materials = new Materials();
  private container: HTMLElement;
  private overlay: HTMLDivElement;
  private planBg: HTMLDivElement;
  private els: Record<string, HTMLDivElement> = {};
  private planCam = new THREE.PerspectiveCamera();
  private mainCam = new THREE.PerspectiveCamera();
  private room!: RoomRig;
  private roomData: Room;
  private itemsGroup = new THREE.Group();
  private views = new Map<string, ItemView>();
  private egress = new EgressLayer();
  private sun: THREE.DirectionalLight;
  private selection = new THREE.Group();
  private hoverOutline: THREE.LineLoop;
  private selOutline: THREE.LineLoop;
  private selFill: THREE.Mesh;
  private handle = new THREE.Group();
  private ghost: THREE.Group;
  private dims = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private lastFrame = performance.now();
  private time = 0;
  private raf = 0;
  private unsub: () => void;
  private resizeObs: ResizeObserver;
  private width = 1;
  private height = 1;
  private needsRender = true;
  private shadowsDirty = true;
  private egressDirty = true;
  private signTimer = 0;
  private disposed = false;

  // view state
  private r = 0.5;
  private t = 1;
  private tween: { r0: number; t0: number; r1: number; t1: number; start: number; dur: number } | null = null;
  private persp = { az: DEFAULT_AZ, polar: DEFAULT_POLAR, zoom: 1, panX: 0, panZ: 0 };
  private plan = { zoom: 1, panX: 0, panZ: 0 };
  private fitW: number;
  private fitD: number;
  private wallScale: Record<WallSide, number> = { front: 1, back: 1, left: 1, right: 1 };

  // interaction
  private drag: DragState | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number } | null = null;
  private hoverId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const s = store.getState();
    this.roomData = s.room;
    this.fitW = s.room.width;
    this.fitD = s.room.depth;
    this.r = VIEW_TARGET[s.view].r;
    this.t = VIEW_TARGET[s.view].t;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'planner-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Floor plan and 3D view of the layout');
    this.renderer.domElement.setAttribute('role', 'img');

    this.planBg = document.createElement('div');
    this.planBg.className = 'plan-bg';
    container.appendChild(this.planBg);
    container.appendChild(this.renderer.domElement);
    this.overlay = document.createElement('div');
    this.overlay.className = 'planner-overlay';
    container.appendChild(this.overlay);
    for (const k of ['dimW', 'dimD', 'travel', 'tooltip', 'divider', 'tagPlan', 'tagMain', 'scale']) {
      const el = document.createElement('div');
      el.className = `ov ov-${k}`;
      this.overlay.appendChild(el);
      this.els[k] = el;
    }
    this.els.divider.innerHTML = '<span></span>';
    this.els.tagPlan.textContent = 'Plan';
    this.els.scale.innerHTML = '<div class="bar"><i></i><i></i></div><div class="lbl"><span>0</span><span class="mid"></span><span class="end"></span></div>';

    const lights = lightRig();
    this.sun = lights.sun;
    this.scene.add(lights.group);
    this.scene.add(this.itemsGroup);
    this.scene.add(this.egress.group);
    this.scene.add(this.selection);
    this.scene.add(this.dims);

    // selection visuals
    const lineMat = (color: string, opacity: number) =>
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
    this.selOutline = new THREE.LineLoop(new THREE.BufferGeometry(), lineMat('#1F1E1C', 0.95));
    this.selOutline.renderOrder = 20;
    this.hoverOutline = new THREE.LineLoop(new THREE.BufferGeometry(), lineMat('#1F1E1C', 0.35));
    this.hoverOutline.renderOrder = 19;
    this.selFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.materials.brandGlow);
    this.selFill.rotation.x = -Math.PI / 2;
    this.selFill.renderOrder = 3;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.16, 32),
      new THREE.MeshBasicMaterial({ color: '#1F1E1C', depthTest: false, transparent: true }),
    );
    ring.rotation.x = -Math.PI / 2;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), new THREE.MeshBasicMaterial({ color: '#FFFDF8', depthTest: false, transparent: true }));
    dot.rotation.x = -Math.PI / 2;
    const arrow = new THREE.Mesh(
      new THREE.RingGeometry(0.045, 0.07, 24, 1, 0.3, Math.PI * 1.4),
      new THREE.MeshBasicMaterial({ color: '#1F1E1C', depthTest: false, transparent: true }),
    );
    arrow.rotation.x = -Math.PI / 2;
    ring.renderOrder = dot.renderOrder = 21;
    arrow.renderOrder = 22;
    const stem = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -0.3)]),
      lineMat('#1F1E1C', 0.6),
    );
    stem.renderOrder = 20;
    this.handle.add(dot, ring, arrow, stem);
    this.handle.userData.handle = true;
    this.selection.add(this.selFill, this.selOutline, this.hoverOutline, this.handle);
    this.selection.visible = true;
    this.handle.visible = false;
    this.selOutline.visible = false;
    this.selFill.visible = false;
    this.hoverOutline.visible = false;

    this.ghost = new THREE.Group();
    const ghostFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#1F1E1C', transparent: true, opacity: 0.12, depthWrite: false }));
    ghostFill.rotation.x = -Math.PI / 2;
    const ghostLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.5, 0, -0.5),
        new THREE.Vector3(0.5, 0, -0.5),
        new THREE.Vector3(0.5, 0, 0.5),
        new THREE.Vector3(-0.5, 0, 0.5),
      ]),
      lineMat('#1F1E1C', 0.9),
    );
    this.ghost.add(ghostFill, ghostLine);
    this.ghost.position.y = 0.02;
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    this.materials.setBrand(s.brand, false);
    this.buildRoom(s);
    this.syncItems(s.items, false);
    this.updateSelection();
    this.egress.setVisible(s.showEgress);

    this.unsub = store.subscribe((next, prev) => this.onState(next, prev));
    // the fascia sign is drawn on a canvas; redraw it once the web fonts are in
    document.fonts?.ready.then(() => this.queueSign());
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.bindInput();
    this.loop();
  }

  // ───────────────────────── state sync ─────────────────────────

  private onState(s: Store, p: Store) {
    if (s.room !== p.room) {
      this.buildRoom(s);
      this.egressDirty = true;
    }
    if (s.items !== p.items) {
      this.syncItems(s.items, s.layoutEpoch !== p.layoutEpoch);
      this.egressDirty = true;
    }
    if (s.brand !== p.brand) {
      this.materials.setBrand(s.brand, true);
      this.queueSign();
    }
    if (s.projectName !== p.projectName) this.queueSign();
    if (s.view !== p.view) this.setView(s.view);
    if (s.showEgress !== p.showEgress) {
      this.egress.setVisible(s.showEgress);
      if (s.showEgress) this.egressDirty = true;
    }
    if (s.selectedId !== p.selectedId || s.items !== p.items) this.updateSelection();
    this.needsRender = true;
  }

  private queueSign() {
    window.clearTimeout(this.signTimer);
    this.signTimer = window.setTimeout(() => {
      if (this.disposed) return;
      const s = store.getState();
      this.room.setSign(s.projectName || 'Your shop', s.brand, inkFor(s.brand));
      this.needsRender = true;
    }, 120);
  }

  private buildRoom(s: Store) {
    if (this.room) {
      this.scene.remove(this.room.group);
      this.room.dispose();
    }
    this.roomData = s.room;
    this.room = buildRoom(s.room, this.materials, {
      sign: { text: s.projectName || 'Your shop', brand: s.brand, ink: inkFor(s.brand) },
      anisotropy: this.renderer.capabilities.getMaxAnisotropy(),
    });
    this.scene.add(this.room.group);
    this.applyWalls(true);
    fitShadow(this.sun, s.room);
    this.buildDims(s.room);
    this.shadowsDirty = true;
  }

  private buildDims(room: Room) {
    this.dims.children.forEach((c) => (c as THREE.LineSegments).geometry.dispose());
    this.dims.clear();
    const hw = room.width / 2;
    const hd = room.depth / 2;
    const off = WALL_T + 0.55;
    const pts: number[] = [];
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
    // width along the storefront
    const z = hd + off;
    seg([-hw, 0, z], [hw, 0, z]);
    for (const x of [-hw, hw]) {
      seg([x, 0, z - 0.18], [x, 0, z + 0.18]);
      seg([x - 0.1, 0, z + 0.1], [x + 0.1, 0, z - 0.1]);
    }
    // depth along the right wall
    const x = hw + off;
    seg([x, 0, -hd], [x, 0, hd]);
    for (const zz of [-hd, hd]) {
      seg([x - 0.18, 0, zz], [x + 0.18, 0, zz]);
      seg([x - 0.1, 0, zz + 0.1], [x + 0.1, 0, zz - 0.1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#2B2A28', transparent: true, opacity: 0.8 }));
    lines.position.y = -0.155;
    this.dims.add(lines);
  }

  private syncItems(items: PlacedItem[], stagger: boolean) {
    const seen = new Set<string>();
    const now = this.time;
    items.forEach((it, i) => {
      seen.add(it.id);
      let v = this.views.get(it.id);
      if (!v) {
        const group = buildItem(it.type, this.materials);
        group.userData.itemId = it.id;
        group.traverse((o) => (o.userData.itemId = it.id));
        this.itemsGroup.add(group);
        const delay = stagger ? 0.25 + Math.min(1.2, (Math.hypot(it.x, it.z) / 10) * 0.9 + (i % 5) * 0.015) : 0;
        v = { id: it.id, type: it.type, group, x: it.x, z: it.z, rot: it.rot, scale: 0, born: now + delay, removing: null };
        group.position.set(it.x, 0, it.z);
        group.rotation.y = it.rot;
        group.scale.setScalar(0.001);
        this.views.set(it.id, v);
      }
      v.x = it.x;
      v.z = it.z;
      v.rot = it.rot;
      v.removing = null;
    });
    for (const v of this.views.values()) {
      if (!seen.has(v.id) && v.removing === null) v.removing = now;
    }
    this.shadowsDirty = true;
  }

  private updateSelection() {
    const s = store.getState();
    const it = s.items.find((x) => x.id === s.selectedId);
    if (!it) {
      this.selOutline.visible = this.selFill.visible = this.handle.visible = false;
      this.needsRender = true;
      return;
    }
    const def = getDef(it.type);
    this.setOutline(this.selOutline, it, def.w, def.d, def.round, 0.06);
    this.selFill.visible = true;
    this.selFill.scale.set(def.w + 0.12, def.d + 0.12, 1);
    this.selFill.position.set(it.x, 0.012, it.z);
    this.selFill.rotation.z = it.rot;
    this.handle.visible = true;
    const reach = def.d / 2 + 0.45;
    this.handle.position.set(it.x + Math.sin(it.rot) * reach, 0.03, it.z + Math.cos(it.rot) * reach);
    this.handle.rotation.y = it.rot;
    this.needsRender = true;
  }

  private setOutline(line: THREE.LineLoop, it: PlacedItem, w: number, d: number, round = false, pad = 0.04) {
    let pts: THREE.Vector3[];
    if (round) {
      pts = [];
      const r = w / 2 + pad;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push(new THREE.Vector3(it.x + Math.cos(a) * r, 0.015, it.z + Math.sin(a) * r));
      }
    } else {
      pts = footprint(it, w, d, pad).map((p) => new THREE.Vector3(p.x, 0.015, p.z));
    }
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    line.visible = true;
  }

  // ───────────────────────── view & camera ─────────────────────────

  setView(v: ViewMode) {
    const target = VIEW_TARGET[v];
    this.tween = { r0: this.r, t0: this.t, r1: target.r, t1: target.t, start: this.time, dur: 1.15 };
    this.needsRender = true;
  }

  resetCamera() {
    this.persp = { az: DEFAULT_AZ, polar: DEFAULT_POLAR, zoom: 1, panX: 0, panZ: 0 };
    this.plan = { zoom: 1, panX: 0, panZ: 0 };
    this.needsRender = true;
  }

  private planPose(aspect: number): Pose {
    const extent = planExtent(this.fitW, this.fitD, aspect) / this.plan.zoom;
    return {
      tx: this.plan.panX,
      // nudge the room down a little so it clears the floating toolbars
      tz: this.plan.panZ - extent * 0.035,
      az: 0,
      polar: 0.0008,
      extent,
      fov: PLAN_FOV,
    };
  }

  private perspPose(aspect: number): Pose {
    return {
      tx: this.persp.panX,
      tz: this.persp.panZ + 0.4,
      az: this.persp.az,
      polar: this.persp.polar,
      extent: perspExtent(this.fitW, this.fitD, aspect) / this.persp.zoom,
      fov: PERSP_FOV,
    };
  }

  private panes() {
    const planW = Math.round(this.width * this.r);
    return {
      plan: { x: 0, w: planW, h: this.height },
      main: { x: planW, w: this.width - planW, h: this.height },
    };
  }

  private mainPose(aspect: number) {
    return blendPose(this.planPose(aspect), this.perspPose(aspect), easeInOut(this.t));
  }

  private updateCameras() {
    const p = this.panes();
    if (p.plan.w > 1) applyPose(this.planCam, this.planPose(p.plan.w / p.plan.h), p.plan.w / p.plan.h);
    if (p.main.w > 1) applyPose(this.mainCam, this.mainPose(p.main.w / p.main.h), p.main.w / p.main.h);
  }

  private resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.domElement.style.width = `${this.width}px`;
    this.renderer.domElement.style.height = `${this.height}px`;
    this.needsRender = true;
  }

  // ───────────────────────── frame loop ─────────────────────────

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    let animating = false;

    if (this.tween) {
      const k = Math.min(1, (this.time - this.tween.start) / this.tween.dur);
      const e = easeInOut(k);
      this.r = this.tween.r0 + (this.tween.r1 - this.tween.r0) * e;
      // t eases inside blendPose, so advance it linearly here
      this.t = this.tween.t0 + (this.tween.t1 - this.tween.t0) * k;
      if (k >= 1) this.tween = null;
      animating = true;
    }

    // ease the framing when the room is resized or a template loads
    const room = this.roomData;
    if (Math.abs(this.fitW - room.width) > 0.001 || Math.abs(this.fitD - room.depth) > 0.001) {
      const a = 1 - Math.exp(-dt * 6);
      this.fitW += (room.width - this.fitW) * a;
      this.fitD += (room.depth - this.fitD) * a;
      if (Math.abs(this.fitW - room.width) < 0.005) this.fitW = room.width;
      if (Math.abs(this.fitD - room.depth) < 0.005) this.fitD = room.depth;
      animating = true;
    }

    this.updateCameras();

    // cut away walls that stand between the 3D camera and the room
    const camPos = this.mainCam.position;
    for (const side of Object.keys(this.wallScale) as WallSide[]) {
      const target = this.width - this.panes().plan.w > 1 && wallFacesCamera(side, room, camPos) ? 0.07 : 1;
      const cur = this.wallScale[side];
      if (Math.abs(cur - target) > 0.002) {
        this.wallScale[side] = Math.abs(target - cur) < 0.004 ? target : cur + (target - cur) * (1 - Math.exp(-dt * 9));
        this.shadowsDirty = true;
        animating = true;
      }
    }

    if (this.animateItems(dt)) animating = true;
    if (this.materials.tick(dt)) animating = true;

    const s = store.getState();
    if (this.egressDirty && s.showEgress) {
      this.egress.update(s.room, getEgress(s.room, s.items));
      this.egressDirty = false;
    }
    if (this.egress.tick(dt)) animating = true;
    const glow = s.showEgress ? 1.4 + Math.sin(this.time * 4) * 0.4 : 0.6;
    if (Math.abs(this.materials.exitGreen.emissiveIntensity - glow) > 0.01) {
      this.materials.exitGreen.emissiveIntensity = glow;
      animating = true;
    }

    if (animating || this.needsRender) {
      this.render();
      this.updateOverlay();
      this.needsRender = false;
    }
  };

  private animateItems(dt: number): boolean {
    let moving = false;
    const follow = 1 - Math.exp(-dt * 22);
    for (const v of [...this.views.values()]) {
      const g = v.group;
      if (v.removing !== null) {
        const k = (this.time - v.removing) / 0.2;
        if (k >= 1) {
          this.itemsGroup.remove(g);
          this.views.delete(v.id);
        } else g.scale.setScalar(Math.max(0.001, 1 - k));
        moving = true;
        continue;
      }
      if (v.scale < 1) {
        const k = (this.time - v.born) / 0.5;
        if (k <= 0) {
          g.scale.setScalar(0.001);
          g.visible = false;
        } else {
          g.visible = true;
          v.scale = Math.min(1, k);
          const e = easeOutBack(v.scale);
          g.scale.setScalar(Math.max(0.001, e));
          g.position.y = (1 - Math.min(1, k * 1.4)) * 0.5;
        }
        moving = true;
      }
      const dragging = this.drag?.kind === 'move' && this.drag.id === v.id;
      const dx = v.x - g.position.x;
      const dz = v.z - g.position.z;
      let dr = (v.rot - g.rotation.y) % (Math.PI * 2);
      if (dr > Math.PI) dr -= Math.PI * 2;
      if (dr < -Math.PI) dr += Math.PI * 2;
      if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4 || Math.abs(dr) > 1e-4) {
        const a = dragging ? 1 : follow;
        g.position.x += dx * a;
        g.position.z += dz * a;
        g.rotation.y += dr * (this.drag?.kind === 'rotate' && this.drag.id === v.id ? 1 : follow);
        moving = true;
      }
    }
    if (moving) this.shadowsDirty = true;
    return moving;
  }

  /** Cut walls for the 3D camera, or stand them all up for a plan pane. */
  private applyWalls(cut: boolean) {
    for (const side of Object.keys(this.wallScale) as WallSide[]) {
      const k = cut ? this.wallScale[side] : 1;
      this.room.walls[side].scale.setY(Math.max(0.001, k));
      this.room.uppers[side].visible = k > 0.55;
    }
  }

  private setPlanness(p: number) {
    this.room.floorMat.emissive.setRGB(0.3 * p, 0.29 * p, 0.27 * p);
    this.sun.shadow.intensity = 1 - 0.6 * p;
    this.room.gridMat.opacity = 0.16 * p;
    this.room.gridMat.visible = p > 0.02;
    this.dims.visible = p > 0.3;
    (this.dims.children[0] as THREE.LineSegments | undefined)?.material &&
      (((this.dims.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = 0.8 * Math.max(0, (p - 0.3) / 0.7));
  }

  private render() {
    const r = this.renderer;
    if (this.shadowsDirty) {
      r.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    const p = this.panes();
    r.setScissorTest(true);
    if (p.main.w < this.width) {
      // clear the whole canvas once when panes are split
      r.setScissor(0, 0, this.width, this.height);
      r.setViewport(0, 0, this.width, this.height);
      r.clear();
    }
    // main pane first so the shadow map is computed for the cut-away walls it shows
    if (p.main.w > 1) {
      r.setViewport(p.main.x, 0, p.main.w, p.main.h);
      r.setScissor(p.main.x, 0, p.main.w, p.main.h);
      this.applyWalls(true);
      this.setPlanness(1 - easeInOut(this.t));
      r.render(this.scene, this.mainCam);
      r.shadowMap.needsUpdate = false;
    }
    if (p.plan.w > 1) {
      r.setViewport(p.plan.x, 0, p.plan.w, p.plan.h);
      r.setScissor(p.plan.x, 0, p.plan.w, p.plan.h);
      this.applyWalls(false);
      this.setPlanness(1);
      r.render(this.scene, this.planCam);
      this.applyWalls(true);
    }
    r.setScissorTest(false);
    this.planBg.style.width = `${p.plan.w}px`;
  }

  /** Project a world point into container pixels using a pane's camera. */
  private project(v: THREE.Vector3, pane: Pane) {
    const p = this.panes()[pane];
    const cam = pane === 'plan' ? this.planCam : this.mainCam;
    const q = v.clone().project(cam);
    return { x: p.x + ((q.x + 1) / 2) * p.w, y: ((1 - q.y) / 2) * p.h, visible: q.z < 1 && p.w > 1 };
  }

  private updateOverlay() {
    const p = this.panes();
    const room = this.roomData;
    const planPane: Pane | null = p.plan.w > 40 ? 'plan' : this.t < 0.35 ? 'main' : null;
    const show = (el: HTMLDivElement, on: boolean) => el.classList.toggle('on', on);

    if (planPane) {
      const off = WALL_T + 0.55;
      const a = this.project(new THREE.Vector3(0, 0, room.depth / 2 + off), planPane);
      const b = this.project(new THREE.Vector3(room.width / 2 + off, 0, 0), planPane);
      this.els.dimW.textContent = `${room.width.toFixed(2)} m`;
      this.els.dimD.textContent = `${room.depth.toFixed(2)} m`;
      this.els.dimW.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -50%)`;
      this.els.dimD.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%) rotate(-90deg)`;
      // scale bar: pick a round length that spans ~90px
      const o = this.project(new THREE.Vector3(0, 0, 0), planPane);
      const one = this.project(new THREE.Vector3(1, 0, 0), planPane);
      const pxPerM = Math.max(1, one.x - o.x);
      const len = [1, 2, 5, 10].find((m) => m * pxPerM >= 70) ?? 10;
      const bar = this.els.scale;
      (bar.querySelector('.bar') as HTMLElement).style.width = `${len * pxPerM}px`;
      (bar.querySelector('.mid') as HTMLElement).textContent = `${len / 2}`;
      (bar.querySelector('.end') as HTMLElement).textContent = `${len} m`;
      const pane = p[planPane];
      bar.style.transform = `translate(${pane.x + 16}px, ${pane.h - 44}px)`;
    }
    show(this.els.dimW, !!planPane);
    show(this.els.dimD, !!planPane);
    show(this.els.scale, !!planPane);

    // split divider & pane tags
    const split = p.plan.w > 2 && p.main.w > 2;
    show(this.els.divider, split);
    this.els.divider.style.transform = `translateX(${p.plan.w}px)`;
    show(this.els.tagPlan, split);
    this.els.tagPlan.style.transform = `translate(${p.plan.w - 16}px, ${p.plan.h - 30}px) translateX(-100%)`;
    this.els.tagMain.textContent = this.t > 0.5 ? '3D view' : 'Plan';
    show(this.els.tagMain, split);
    this.els.tagMain.style.transform = `translate(${p.main.x + 16}px, ${p.main.h - 30}px)`;

    // egress label
    const s = store.getState();
    const anchor = this.egress.labelAnchor;
    if (s.showEgress && anchor) {
      const pane: Pane = p.main.w > 1 ? 'main' : 'plan';
      const q = this.project(anchor, pane);
      this.els.travel.textContent = this.egress.labelText;
      this.els.travel.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -140%)`;
      show(this.els.travel, q.visible);
    } else show(this.els.travel, false);
  }

  // ───────────────────────── input ─────────────────────────

  private paneAt(x: number): Pane {
    const p = this.panes();
    return p.plan.w > 1 && x < p.plan.w ? 'plan' : 'main';
  }

  private rayFor(x: number, y: number, pane: Pane) {
    const p = this.panes()[pane];
    const cam = pane === 'plan' ? this.planCam : this.mainCam;
    const ndc = new THREE.Vector2(((x - p.x) / p.w) * 2 - 1, -(y / p.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, cam);
    return this.raycaster.ray;
  }

  private floorAt(x: number, y: number, pane: Pane): THREE.Vector3 | null {
    const ray = this.rayFor(x, y, pane);
    const hit = new THREE.Vector3();
    return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? hit : null;
  }

  /** Floor point under a client-space position, for drops from the library. */
  floorPointAt(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const p = this.floorAt(x, y, this.paneAt(x));
    if (!p) return null;
    const room = this.roomData;
    if (Math.abs(p.x) > room.width / 2 + 0.5 || Math.abs(p.z) > room.depth / 2 + 0.5) return null;
    return { x: p.x, z: p.z };
  }

  showGhost(type: string | null, at: { x: number; z: number } | null) {
    if (!type || !at) {
      if (this.ghost.visible) {
        this.ghost.visible = false;
        this.needsRender = true;
      }
      return;
    }
    const def = getDef(type);
    const p = clampToRoom(this.roomData, def, at.x, at.z, 0);
    this.ghost.visible = true;
    this.ghost.position.set(p.x, 0.02, p.z);
    this.ghost.scale.set(Math.max(0.3, def.w), 1, Math.max(0.3, def.d));
    this.needsRender = true;
  }

  private pickItem(x: number, y: number, pane: Pane): { id: string | null; handle: boolean } {
    this.rayFor(x, y, pane);
    if (this.handle.visible) {
      const hh = this.raycaster.intersectObject(this.handle, true);
      if (hh.length) return { id: store.getState().selectedId, handle: true };
      // generous hit area for the handle in screen space
      const hp = this.project(this.handle.position, pane);
      if (Math.hypot(hp.x - x, hp.y - y) < 16) return { id: store.getState().selectedId, handle: true };
    }
    const hits = this.raycaster.intersectObjects(this.itemsGroup.children, true);
    for (const h of hits) {
      const id = h.object.userData.itemId as string | undefined;
      if (id && this.views.get(id)?.removing === null) return { id, handle: false };
    }
    return { id: null, handle: false };
  }

  private bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private local(e: PointerEvent | WheelEvent) {
    const rect = this.container.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onDown = (e: PointerEvent) => {
    const { x, y } = this.local(e);
    this.pointers.set(e.pointerId, { x, y });
    this.renderer.domElement.setPointerCapture(e.pointerId);
    if (this.pointers.size === 2) {
      // second finger: switch to pinch, abandon any drag
      if (this.drag?.kind === 'move' || this.drag?.kind === 'rotate') store.getState().commitEdit();
      this.drag = null;
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    const pane = this.paneAt(x);
    const pick = this.pickItem(x, y, pane);
    const base = { pane, startX: x, startY: y, lastX: x, lastY: y, grabDX: 0, grabDZ: 0, moved: false, pointerId: e.pointerId };
    const st = store.getState();
    if (pick.handle && pick.id) {
      st.beginEdit();
      this.drag = { ...base, kind: 'rotate', id: pick.id };
    } else if (pick.id && e.button === 0) {
      const it = st.items.find((i) => i.id === pick.id)!;
      const f = this.floorAt(x, y, pane);
      st.select(pick.id);
      st.beginEdit();
      this.drag = { ...base, kind: 'move', id: pick.id, grabDX: f ? f.x - it.x : 0, grabDZ: f ? f.z - it.z : 0 };
    } else {
      const planLike = pane === 'plan' || this.t < 0.5;
      const pan = planLike || e.button === 2 || e.shiftKey;
      this.drag = { ...base, kind: pan ? 'pan' : 'orbit' };
    }
    this.container.classList.add('is-dragging');
  };

  private onMove = (e: PointerEvent) => {
    const { x, y } = this.local(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x, y });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = d / Math.max(1, this.pinch.dist);
      this.pinch.dist = d;
      this.zoomBy(f, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const drag = this.drag;
    if (!drag) {
      this.updateHover(x, y);
      return;
    }
    const dx = x - drag.lastX;
    const dy = y - drag.lastY;
    if (Math.hypot(x - drag.startX, y - drag.startY) > 3) drag.moved = true;
    drag.lastX = x;
    drag.lastY = y;
    const st = store.getState();
    if (drag.kind === 'move' && drag.id) {
      const f = this.floorAt(x, y, drag.pane);
      const it = st.items.find((i) => i.id === drag.id);
      if (!f || !it) return;
      const def = getDef(it.type);
      const step = st.snap && !e.altKey ? 0.1 : 0.01;
      const nx = Math.round((f.x - drag.grabDX) / step) * step;
      const nz = Math.round((f.z - drag.grabDZ) / step) * step;
      const p = clampToRoom(st.room, def, nx, nz, it.rot);
      if (p.x !== it.x || p.z !== it.z) st.moveItem(it.id, +p.x.toFixed(3), +p.z.toFixed(3));
      this.setTooltip(null);
    } else if (drag.kind === 'rotate' && drag.id) {
      const f = this.floorAt(x, y, drag.pane);
      const it = st.items.find((i) => i.id === drag.id);
      if (!f || !it) return;
      let a = Math.atan2(f.x - it.x, f.z - it.z);
      const step = e.shiftKey ? Math.PI / 180 : Math.PI / 12;
      a = Math.round(a / step) * step;
      if (Math.abs(a - it.rot) > 1e-4) st.setRotation(it.id, a);
    } else if (drag.kind === 'orbit') {
      this.persp.az -= dx * 0.006;
      this.persp.polar = Math.max(0.3, Math.min(1.38, this.persp.polar - dy * 0.005));
      this.needsRender = true;
    } else if (drag.kind === 'pan') {
      const p = this.panes()[drag.pane];
      if (drag.pane === 'plan' || this.t < 0.5) {
        const extent = planExtent(this.fitW, this.fitD, p.w / p.h) / this.plan.zoom;
        const wpp = extent / p.h;
        this.plan.panX -= dx * wpp;
        this.plan.panZ -= dy * wpp;
      } else {
        const extent = perspExtent(this.fitW, this.fitD, p.w / p.h) / this.persp.zoom;
        const wpp = (extent / p.h) * 1.2;
        const az = this.persp.az;
        // screen right and screen-up projected onto the floor
        const rx = Math.cos(az);
        const rz = -Math.sin(az);
        const fx = -Math.sin(az);
        const fz = -Math.cos(az);
        this.persp.panX -= (dx * rx - dy * fx) * wpp;
        this.persp.panZ -= (dx * rz - dy * fz) * wpp;
      }
      this.clampPan();
      this.needsRender = true;
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const drag = this.drag;
    this.container.classList.remove('is-dragging');
    if (!drag || drag.pointerId !== e.pointerId) return;
    this.drag = null;
    const st = store.getState();
    if (drag.kind === 'move' || drag.kind === 'rotate') {
      if (drag.kind === 'rotate' && drag.id) {
        // keep the rotated footprint inside the room
        const it = st.items.find((i) => i.id === drag.id);
        if (it) {
          const p = clampToRoom(st.room, getDef(it.type), it.x, it.z, it.rot);
          if (p.x !== it.x || p.z !== it.z) st.moveItem(it.id, p.x, p.z);
        }
      }
      st.commitEdit();
    } else if (!drag.moved) {
      st.select(null);
    }
    this.needsRender = true;
  };

  private onLeave = () => {
    if (!this.drag) {
      this.hoverId = null;
      this.hoverOutline.visible = false;
      this.setTooltip(null);
      this.needsRender = true;
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { x, y } = this.local(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.zoomBy(Math.exp(-delta * 0.0015), x, y);
  };

  private zoomBy(f: number, x: number, y: number) {
    const pane = this.paneAt(x);
    const planLike = pane === 'plan' || this.t < 0.5;
    const before = this.floorAt(x, y, pane);
    if (planLike) this.plan.zoom = Math.max(0.5, Math.min(6, this.plan.zoom * f));
    else this.persp.zoom = Math.max(0.5, Math.min(5, this.persp.zoom * f));
    this.updateCameras();
    const after = this.floorAt(x, y, pane);
    if (before && after) {
      const target = planLike ? this.plan : this.persp;
      target.panX += before.x - after.x;
      target.panZ += before.z - after.z;
      this.clampPan();
    }
    this.needsRender = true;
  }

  private clampPan() {
    const lx = this.roomData.width / 2 + 2;
    const lz = this.roomData.depth / 2 + 2;
    for (const t of [this.plan, this.persp]) {
      t.panX = Math.max(-lx, Math.min(lx, t.panX));
      t.panZ = Math.max(-lz, Math.min(lz, t.panZ));
    }
  }

  private updateHover(x: number, y: number) {
    const pick = this.pickItem(x, y, this.paneAt(x));
    const id = pick.handle ? null : pick.id;
    this.renderer.domElement.style.cursor = pick.handle ? 'grab' : id ? 'move' : this.paneAt(x) === 'plan' || this.t < 0.5 ? 'default' : 'grab';
    if (id === this.hoverId) {
      if (id) this.positionTooltip(x, y);
      return;
    }
    this.hoverId = id;
    const it = id ? store.getState().items.find((i) => i.id === id) : null;
    if (it && it.id !== store.getState().selectedId) {
      const def = getDef(it.type);
      this.setOutline(this.hoverOutline, it, def.w, def.d, def.round, 0.04);
    } else this.hoverOutline.visible = false;
    this.setTooltip(it ?? null);
    if (it) this.positionTooltip(x, y);
    this.needsRender = true;
  }

  private setTooltip(it: PlacedItem | null) {
    const el = this.els.tooltip;
    if (!it) {
      el.classList.remove('on');
      return;
    }
    const def = getDef(it.type);
    const tier = store.getState().costTier;
    const mult = tier === 'budget' ? 0.62 : tier === 'premium' ? 1.8 : 1;
    el.innerHTML = `<strong>${def.name}</strong><span>${Math.round(def.w * 100)}×${Math.round(def.d * 100)} cm${def.seats ? ` · ${def.seats} seat${def.seats > 1 ? 's' : ''}` : ''} · ${money(Math.round((def.price * mult) / 5) * 5)}</span>`;
    el.classList.add('on');
  }

  private positionTooltip(x: number, y: number) {
    this.els.tooltip.style.transform = `translate(${x + 14}px, ${y + 18}px)`;
  }

  // ───────────────────────── capture ─────────────────────────

  private captureRenderer: THREE.WebGLRenderer | null = null;

  /**
   * Render a still of the current project or a template, offscreen, without touching the live view.
   * Returns a data URL.
   */
  capture(opts: CaptureOptions): string {
    if (!this.captureRenderer) {
      this.captureRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.captureRenderer.outputColorSpace = THREE.SRGBColorSpace;
      this.captureRenderer.toneMapping = THREE.NeutralToneMapping;
      this.captureRenderer.shadowMap.enabled = true;
      this.captureRenderer.shadowMap.type = THREE.PCFShadowMap;
    }
    const cr = this.captureRenderer;
    cr.setPixelRatio(1);
    cr.setSize(opts.width, opts.height, false);

    const s = store.getState();
    const tpl = opts.templateId ? TEMPLATES[opts.templateId] : null;
    const room = tpl ? tpl.room : s.room;
    const items = tpl ? tpl.items : s.items;
    const brand = tpl ? tpl.brand : s.brand;
    const name = tpl ? tpl.project : s.projectName || 'Your shop';
    this.materials.setBrand(brand, false);

    const scene = new THREE.Scene();
    const lights = lightRig();
    fitShadow(lights.sun, room);
    scene.add(lights.group);
    const rig = buildRoom(room, this.materials, {
      sign: { text: name, brand, ink: inkFor(brand) },
      anisotropy: cr.capabilities.getMaxAnisotropy(),
      ceiling: opts.shot === 'photo',
      avoid: tpl ? { x: tpl.photo.cam[0], z: tpl.photo.cam[2] } : undefined,
      street: opts.shot === 'storefront',
    });
    scene.add(rig.group);
    for (const it of items) {
      const g = buildItem(it.type, this.materials);
      g.position.set(it.x, 0, it.z);
      g.rotation.y = it.rot;
      scene.add(g);
    }

    const cam = new THREE.PerspectiveCamera();
    const aspect = opts.width / opts.height;
    if (opts.shot === 'photo' && tpl) {
      cam.fov = 52;
      cam.aspect = aspect;
      cam.near = 0.1;
      cam.far = 80;
      cam.position.set(...tpl.photo.cam);
      cam.lookAt(...tpl.photo.look);
      cam.updateProjectionMatrix();
      scene.background = new THREE.Color('#EFE8DC');
      lights.sun.intensity = 1.6;
    } else if (opts.shot === 'storefront') {
      cam.fov = 40;
      cam.aspect = aspect;
      cam.near = 0.1;
      cam.far = 100;
      const dist = Math.max(8, room.width * 0.95);
      cam.position.set(-room.width * 0.18, 1.9, room.depth / 2 + dist);
      cam.lookAt(0, 1.55, room.depth / 2 - 1);
      cam.updateProjectionMatrix();
      scene.background = new THREE.Color('#E9E2D5');
    } else {
      applyPose(
        cam,
        { tx: 0, tz: 0.3, az: DEFAULT_AZ, polar: 0.92, extent: perspExtent(room.width, room.depth, aspect) * 0.95, fov: PERSP_FOV },
        aspect,
      );
    }
    for (const side of ['front', 'back', 'left', 'right'] as WallSide[]) {
      const cut = opts.shot === 'aerial' && wallFacesCamera(side, room, cam.position);
      rig.walls[side].scale.setY(cut ? 0.07 : 1);
      rig.uppers[side].visible = !cut;
    }
    cr.setClearColor(0x000000, 0);
    cr.render(scene, cam);
    const url = cr.domElement.toDataURL(opts.jpeg ? 'image/jpeg' : 'image/png', 0.9);
    rig.dispose();
    this.materials.setBrand(store.getState().brand, false);
    this.needsRender = true;
    return url;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unsub();
    this.resizeObs.disconnect();
    window.clearTimeout(this.signTimer);
    this.room.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.captureRenderer?.dispose();
    this.captureRenderer?.forceContextLoss();
    this.container.innerHTML = '';
  }
}

let current: Planner | null = null;
export const setPlanner = (p: Planner | null) => {
  current = p;
};
export const getPlanner = () => current;
