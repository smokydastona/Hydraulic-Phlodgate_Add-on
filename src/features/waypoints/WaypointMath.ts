/** Pure waypoint/compass helpers: arrow glyph selection and dimension matching. Testable without the runtime. */

const ARROWS = ["\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199", "\u2190", "\u2196"]; // N, NE, E, SE, S, SW, W, NW (8-way)

/** `delta` is the signed angle (degrees, -180..180) from the player's facing to the target bearing. */
export function arrowForDelta(delta: number): string {
  const normalized = ((delta % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return ARROWS[index];
}

export function formatDistance(blocks: number): string {
  if (blocks >= 1000) return `${(blocks / 1000).toFixed(1)}k blocks`;
  return `${Math.round(blocks)} blocks`;
}

export interface WaypointRecord {
  id: string;
  name: string;
  dimensionId: string;
  x: number;
  y: number;
  z: number;
}

export function isSameDimension(waypoint: WaypointRecord, playerDimensionId: string): boolean {
  return waypoint.dimensionId === playerDimensionId;
}

export function findWaypoint(waypoints: WaypointRecord[], id: string): WaypointRecord | undefined {
  return waypoints.find((w) => w.id === id);
}
