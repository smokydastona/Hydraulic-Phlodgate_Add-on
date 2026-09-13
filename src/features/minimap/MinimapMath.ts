/** Pure minimap/radar helpers: builds a rotating text radar strip from bearings/distances. No @minecraft/server imports so this stays unit-testable. */

export interface RadarWaypointEntry {
  /** Single glyph drawn on the strip (typically the first letter of the waypoint name, uppercased). */
  glyph: string;
  /** Signed angle (degrees, -180..180) from the player's facing to this point. */
  delta: number;
  distance: number;
}

export interface RadarCardinalEntry {
  glyph: "N" | "S" | "E" | "W";
  delta: number;
}

export const DEFAULT_RADAR_WIDTH = 21;
export const RADAR_TRACK_CHAR = "\u00b7"; // ·
export const RADAR_CENTER_CHAR = "\u25b2"; // ▲

/** Maps a signed delta (-180..180) to a track index in [0, width - 1], where the middle index is directly ahead. */
export function radarIndexForDelta(delta: number, width: number): number {
  const clamped = Math.min(180, Math.max(-180, delta));
  const normalized = clamped + 180; // 0..360
  const index = Math.round((normalized / 360) * (width - 1));
  return Math.min(width - 1, Math.max(0, index));
}

/** Builds the plain (uncolored) radar strip characters. Waypoints are drawn nearest-last so the closest one wins ties. */
export function buildRadarStrip(
  waypoints: RadarWaypointEntry[],
  cardinals: RadarCardinalEntry[],
  width: number = DEFAULT_RADAR_WIDTH
): string {
  const track = new Array<string>(Math.max(1, width)).fill(RADAR_TRACK_CHAR);

  for (const cardinal of cardinals) {
    track[radarIndexForDelta(cardinal.delta, width)] = cardinal.glyph;
  }

  const byFarthestFirst = [...waypoints].sort((a, b) => b.distance - a.distance);
  for (const waypoint of byFarthestFirst) {
    const glyph = waypoint.glyph.trim().charAt(0) || "?";
    track[radarIndexForDelta(waypoint.delta, width)] = glyph;
  }

  const centerIndex = Math.floor((width - 1) / 2);
  if (track[centerIndex] === RADAR_TRACK_CHAR) {
    track[centerIndex] = RADAR_CENTER_CHAR;
  }

  return track.join("");
}

/** Standard cardinal bearings for this project's bearing convention (0 = south, matches Minecraft yaw). */
export const CARDINAL_BEARINGS: Record<RadarCardinalEntry["glyph"], number> = {
  S: 0,
  W: 90,
  N: 180,
  E: 270,
};

export function cardinalEntriesForYaw(yaw360: number, angularDeltaFn: (currentYaw: number, targetBearing: number) => number): RadarCardinalEntry[] {
  return (Object.keys(CARDINAL_BEARINGS) as RadarCardinalEntry["glyph"][]).map((glyph) => ({
    glyph,
    delta: angularDeltaFn(yaw360, CARDINAL_BEARINGS[glyph]),
  }));
}

export function withinRadius(distance: number, radius: number): boolean {
  return distance <= radius;
}

export interface NearestEntry {
  name: string;
  delta: number;
  distance: number;
}

export function nearestEntries<T extends NearestEntry>(entries: T[], limit: number): T[] {
  return [...entries].sort((a, b) => a.distance - b.distance).slice(0, Math.max(0, limit));
}
