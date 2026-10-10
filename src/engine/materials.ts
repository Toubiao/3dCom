import * as THREE from 'three';

const std = (color: string, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

/**
 * Every material in the scene is shared, so recolouring the brand is a handful of uniform updates
 * rather than a walk over thousands of meshes.
 */
export class Materials {
  // brand family
  readonly brand = std('#C4572F', 0.55);
  readonly brandFabric = std('#C4572F', 0.95);
  readonly brandDark = std('#8A3A1E', 0.6);
  readonly brandSoft = std('#E9C2B1', 0.95);
  readonly brandPaint = std('#E9C2B1', 0.9);
  readonly brandGlow = new THREE.MeshBasicMaterial({ color: '#C4572F', transparent: true, opacity: 0.18, depthWrite: false });

  // neutrals
  readonly oak = std('#C7A47A', 0.62);
  readonly walnut = std('#6A4A33', 0.55);
  readonly charcoal = std('#2D2C2A', 0.5, 0.25);
  readonly black = std('#1E1D1B', 0.6);
  readonly steel = std('#C2C5C6', 0.32, 0.85);
  readonly brass = std('#B8955A', 0.35, 0.8);
  readonly stone = std('#EFEBE3', 0.35);
  readonly oatFabric = std('#D9CCB7', 0.95);
  readonly oat = std('#E3D8C6', 0.85);
  readonly paint = std('#F6F2EA', 0.92);
  readonly wallTop = std('#2A2927', 0.9);
  readonly cream = std('#FBF7EF', 0.6);
  readonly leaf = std('#5F7D4D', 0.85, 0, { side: THREE.DoubleSide });
  readonly leafDark = std('#46613A', 0.85, 0, { side: THREE.DoubleSide });
  readonly pot = std('#B9AE9C', 0.9);
  readonly screen = std('#1C1F22', 0.25, 0.1);
  readonly mirror = std('#DCE3E4', 0.08, 0.95);
  readonly skin = std('#E6DDD0', 0.6);
  readonly goods = [std('#E9E2D6', 0.85), std('#9AA79A', 0.85), std('#C9B8A0', 0.85), std('#4F5A66', 0.85), std('#D7C2A2', 0.85)];
  readonly glass = new THREE.MeshPhysicalMaterial({
    color: '#E8F0F0',
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  readonly exitGreen = new THREE.MeshStandardMaterial({ color: '#0E8C52', emissive: '#0E8C52', emissiveIntensity: 0.6, roughness: 0.4 });
  readonly exitSign = new THREE.MeshStandardMaterial({ color: '#F4FFF8', emissive: '#C9F5DC', emissiveIntensity: 0.25, roughness: 0.5 });

  private from = new THREE.Color('#C4572F');
  private to = new THREE.Color('#C4572F');
  private t = 1;

  /** Set the brand colour. With animate, colours ease over ~350 ms via tick(). */
  setBrand(hex: string, animate: boolean) {
    this.from.copy(this.brand.color);
    this.to.set(hex);
    this.t = animate ? 0 : 1;
    if (!animate) this.applyBrand(this.to);
  }

  /** Advance the brand transition. Returns true while still animating. */
  tick(dt: number): boolean {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / 0.35);
    const e = 1 - Math.pow(1 - this.t, 3);
    this.applyBrand(this.from.clone().lerp(this.to, e));
    return true;
  }

  private applyBrand(c: THREE.Color) {
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    this.brand.color.copy(c);
    this.brandFabric.color.copy(c);
    this.brandGlow.color.copy(c);
    this.brandDark.color.setHSL(hsl.h, hsl.s * 0.9, Math.max(0.08, hsl.l * 0.62));
    this.brandSoft.color.copy(c).lerp(new THREE.Color('#F4EDE2'), 0.45);
    this.brandPaint.color.copy(c).lerp(new THREE.Color('#F6F1E8'), 0.62);
  }
}
