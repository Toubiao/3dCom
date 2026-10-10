import * as THREE from 'three';
import type { FloorFinish } from '../types';

/** Seeded PRNG so procedural textures look the same on every load. */
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const canvas = (w: number, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Metres of floor covered by one tile of each finish's texture. */
export const FLOOR_TILE_M: Record<FloorFinish, number> = {
  oak: 2.4,
  herringbone: 1.6,
  concrete: 4,
  terrazzo: 2,
};

const woodTones = ['#C9A57B', '#C29C70', '#D1AE84', '#BC9468', '#CDA77C', '#B88F63'];

const drawGrain = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: () => number, horizontal: boolean) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = '#5B3E22';
  const n = 6 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    ctx.lineWidth = 0.6 + r() * 1.4;
    ctx.beginPath();
    if (horizontal) {
      const yy = y + r() * h;
      ctx.moveTo(x, yy);
      ctx.bezierCurveTo(x + w * 0.3, yy + (r() - 0.5) * 6, x + w * 0.7, yy + (r() - 0.5) * 6, x + w, yy + (r() - 0.5) * 4);
    } else {
      const xx = x + r() * w;
      ctx.moveTo(xx, y);
      ctx.bezierCurveTo(xx + (r() - 0.5) * 6, y + h * 0.3, xx + (r() - 0.5) * 6, y + h * 0.7, xx + (r() - 0.5) * 4, y + h);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const floorCanvas = (finish: FloorFinish): HTMLCanvasElement => {
  const S = 1024;
  const c = canvas(S);
  const ctx = c.getContext('2d')!;
  const r = rng(finish.length * 977 + 13);
  /** Draw fn at (x, y) plus wrapped copies so the tile repeats seamlessly. */
  const wrapped = (x: number, y: number, reach: number, fn: (x: number, y: number) => void) => {
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const xx = x + ox;
        const yy = y + oy;
        if (xx + reach < 0 || yy + reach < 0 || xx - reach > S || yy - reach > S) continue;
        fn(xx, yy);
      }
    }
  };

  if (finish === 'oak') {
    // 2.4 m tile, 0.2 m planks with staggered joints
    const plankW = S / 12;
    for (let row = 0; row < 12; row++) {
      const offset = r() * S;
      let pos = 0;
      while (pos < S - 1) {
        let len = Math.min(S * (0.3 + r() * 0.35), S - pos);
        if (S - pos - len < S * 0.15) len = S - pos;
        const tone = woodTones[Math.floor(r() * woodTones.length)];
        const seed = r() * 1e6;
        const x = (offset + pos) % S;
        for (const ox of [0, -S]) {
          const xx = x + ox;
          if (xx + len < 0) continue;
          ctx.fillStyle = tone;
          ctx.fillRect(xx, row * plankW, len, plankW);
          drawGrain(ctx, xx, row * plankW, len, plankW, rng(Math.floor(seed) + 7), true);
          ctx.fillStyle = 'rgba(70,45,25,0.35)';
          ctx.fillRect(xx, row * plankW, 1.5, plankW);
        }
        pos += len;
      }
      ctx.fillStyle = 'rgba(70,45,25,0.3)';
      ctx.fillRect(0, row * plankW, S, 1.5);
    }
  } else if (finish === 'herringbone') {
    // 0.4 × 0.1 m blocks on a 1.6 m tile. Lattice vectors (u,u) and (L,-L); the
    // horizontal block H and vertical block V repeat on that lattice.
    const u = S / 16;
    const L = u * 4;
    const tone = (k: number, m: number) => {
      const t = Math.floor(k / 8);
      const kk = k - 8 * t;
      const mm = (((m - 2 * t) % 4) + 4) % 4;
      const h = Math.sin((kk * 12.9898 + mm * 78.233) * 43.7585) * 43758.5453;
      return woodTones[Math.floor((h - Math.floor(h)) * woodTones.length)];
    };
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(80,52,28,0.4)';
    for (let k = -48; k < 48; k++) {
      for (let m = -12; m < 12; m++) {
        const bx = k * u + m * L;
        const by = k * u - m * L;
        if (bx > S + L || by > S + L || bx < -2 * L || by < -2 * L) continue;
        ctx.fillStyle = tone(k, m);
        ctx.fillRect(bx, by, L, u);
        drawGrain(ctx, bx, by, L, u, rng(((k + 99) * 131 + m * 7) & 0xffff), true);
        ctx.strokeRect(bx, by, L, u);
        const vx = bx + L;
        const vy = by + u - L;
        ctx.fillStyle = tone(k + 3, m + 1);
        ctx.fillRect(vx, vy, u, L);
        drawGrain(ctx, vx, vy, u, L, rng(((k + 51) * 97 + m * 13) & 0xffff), false);
        ctx.strokeRect(vx, vy, u, L);
      }
    }
  } else if (finish === 'concrete') {
    ctx.fillStyle = '#CBC6BD';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 320; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = 30 + r() * 140;
      const light = r() > 0.5;
      const a = 0.03 + r() * 0.05;
      wrapped(x, y, rad, (xx, yy) => {
        const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, rad);
        const tone = light ? '255,252,246' : '120,114,104';
        g.addColorStop(0, `rgba(${tone},${a})`);
        g.addColorStop(1, `rgba(${tone},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(xx - rad, yy - rad, rad * 2, rad * 2);
      });
    }
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(90,85,78,${r() * 0.18})`;
      ctx.fillRect(r() * S, r() * S, 1.3, 1.3);
    }
    // saw cuts on a 2 m grid
    ctx.fillStyle = 'rgba(96,90,82,0.4)';
    for (const p of [0, S / 2]) {
      ctx.fillRect(p - 1, 0, 2, S);
      ctx.fillRect(0, p - 1, S, 2);
    }
  } else {
    ctx.fillStyle = '#ECE6DB';
    ctx.fillRect(0, 0, S, S);
    const chips = ['#C8BDAA', '#9C9384', '#D7A98F', '#6F6A62', '#B8C0B6', '#E3D6C0', '#A9876B'];
    for (let i = 0; i < 7000; i++) {
      const col = chips[Math.floor(r() * chips.length)];
      const x = r() * S;
      const y = r() * S;
      const s = 1.5 + r() * r() * 9;
      const e = 0.5 + r() * 0.5;
      const rot = r() * Math.PI;
      wrapped(x, y, s, (xx, yy) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(xx, yy, s, s * e, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // brass divider strips on a 2 m grid
    ctx.fillStyle = 'rgba(176,142,88,0.7)';
    ctx.fillRect(0, 0, S, 3);
    ctx.fillRect(0, 0, 3, S);
  }
  return c;
};

const floorCache = new Map<FloorFinish, THREE.CanvasTexture>();

export const floorTexture = (finish: FloorFinish, anisotropy: number): THREE.CanvasTexture => {
  let tex = floorCache.get(finish);
  if (!tex) {
    tex = new THREE.CanvasTexture(floorCanvas(finish));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    floorCache.set(finish, tex);
  }
  return tex;
};

/** Small swatch for UI pickers. */
export const floorSwatch = (finish: FloorFinish): string => {
  const src = floorCanvas(finish);
  const c = canvas(96);
  c.getContext('2d')!.drawImage(src, 0, 0, 384, 384, 0, 0, 96, 96);
  return c.toDataURL();
};

/** Chevrons for the animated egress ribbons. U runs along the route; one tile = 0.5 m. */
export const chevronTexture = (): THREE.CanvasTexture => {
  const c = canvas(128, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(14,140,82,0.9)';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#F4FFF8';
  ctx.beginPath();
  ctx.moveTo(40, 10);
  ctx.lineTo(70, 32);
  ctx.lineTo(40, 54);
  ctx.lineTo(56, 54);
  ctx.lineTo(86, 32);
  ctx.lineTo(56, 10);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/** Storefront fascia sign with the project name, in the brand colour. */
export const signTexture = (text: string, brand: string, ink: string): THREE.CanvasTexture => {
  const c = canvas(2048, 256);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = brand;
  ctx.fillRect(0, 0, 2048, 256);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 132;
  ctx.font = `600 ${size}px Jost, "Jost Variable", Futura, "Century Gothic", sans-serif`;
  const label = text.toUpperCase();
  while (ctx.measureText(label).width > 1800 && size > 40) {
    size -= 6;
    ctx.font = `600 ${size}px Jost, "Jost Variable", Futura, "Century Gothic", sans-serif`;
  }
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '14px';
  ctx.fillText(label, 1024, 136);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/** Chalk menu for the menu board. */
export const menuTexture = (): THREE.CanvasTexture => {
  const c = canvas(512, 288);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#23231F';
  ctx.fillRect(0, 0, 512, 288);
  ctx.fillStyle = '#F2EDE3';
  ctx.font = '600 30px Jost, "Jost Variable", sans-serif';
  ctx.fillText('MENU', 28, 50);
  ctx.font = '400 19px "IBM Plex Sans", sans-serif';
  const rows = [
    ['Espresso', '3.20'],
    ['Flat white', '4.40'],
    ['Filter, batch', '3.80'],
    ['Oat latte', '4.90'],
    ['Croissant', '3.60'],
    ['Cardamom bun', '4.20'],
  ];
  rows.forEach(([a, b], i) => {
    const y = 92 + i * 32;
    ctx.globalAlpha = 0.92;
    ctx.fillText(a, 28, y);
    ctx.textAlign = 'right';
    ctx.fillText(b, 484, y);
    ctx.textAlign = 'left';
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/** Soft radial blob used as a cheap contact shadow under the room slab. */
export const blobTexture = (): THREE.CanvasTexture => {
  const c = canvas(256);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(40,34,26,0.28)');
  g.addColorStop(0.6, 'rgba(40,34,26,0.1)');
  g.addColorStop(1, 'rgba(40,34,26,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};
