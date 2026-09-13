/** Pure geometry helpers used by waypoints, compass, and optimization distance checks. No @minecraft/server imports so this stays unit-testable. */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function distance3D(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Bearing in degrees [0, 360) from `from` to `to`, where 0 = south (+Z, matches Minecraft yaw convention: yaw 0 faces south). */
export function bearingDegrees(from: Vec3, to: Vec3): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let deg = (Math.atan2(-dx, dz) * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

/** Signed shortest angular delta (-180, 180] from `currentYaw` to `targetBearing`, both in degrees. */
export function angularDelta(currentYaw: number, targetBearing: number): number {
  let delta = targetBearing - currentYaw;
  delta = ((delta + 180) % 360 + 360) % 360 - 180;
  return delta;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}
