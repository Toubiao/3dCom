import * as THREE from 'three';

export interface Pose {
  tx: number;
  tz: number;
  az: number;
  polar: number;
  /** Visible height of the frame at the target, in metres. Distance is derived from it and the fov. */
  extent: number;
  fov: number;
}

export const PLAN_FOV = 12;
export const PERSP_FOV = 36;

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpAngle = (a: number, b: number, t: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/** Blend two poses. Extent blends geometrically so the dolly-zoom feels even. */
export const blendPose = (a: Pose, b: Pose, t: number): Pose => ({
  tx: lerp(a.tx, b.tx, t),
  tz: lerp(a.tz, b.tz, t),
  az: lerpAngle(a.az, b.az, t),
  polar: lerp(a.polar, b.polar, t),
  extent: Math.exp(lerp(Math.log(a.extent), Math.log(b.extent), t)),
  fov: lerp(a.fov, b.fov, t),
});

/** Place a perspective camera according to a pose. */
export const applyPose = (cam: THREE.PerspectiveCamera, p: Pose, aspect: number) => {
  const fovRad = THREE.MathUtils.degToRad(p.fov);
  const dist = p.extent / (2 * Math.tan(fovRad / 2));
  const polar = Math.max(0.0008, p.polar);
  const sinP = Math.sin(polar);
  cam.fov = p.fov;
  cam.aspect = aspect;
  cam.near = Math.max(0.05, dist * 0.02);
  cam.far = dist * 4 + 60;
  cam.position.set(p.tx + dist * sinP * Math.sin(p.az), dist * Math.cos(polar), p.tz + dist * sinP * Math.cos(p.az));
  cam.up.set(0, 1, 0);
  cam.lookAt(p.tx, 0, p.tz);
  cam.updateProjectionMatrix();
  return dist;
};

/** Frame extent that fits a room in plan, given the pane aspect. */
export const planExtent = (w: number, d: number, aspect: number) => Math.max(d + 4.2, (w + 3) / aspect);

/** Frame extent that fits a room in a three-quarter view. */
export const perspExtent = (w: number, d: number, aspect: number) => {
  const r = Math.hypot(w, d) / 2 + 0.8;
  return aspect >= 1.15 ? r * 1.55 : (r * 2.1) / Math.max(0.55, aspect);
};
