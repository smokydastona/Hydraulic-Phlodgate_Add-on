import { Player } from "@minecraft/server";
import { getPlayerSettings } from "../../settings/SettingsStore";
import { angularDelta, bearingDegrees, distanceXZ } from "../../util/Vector";
import { listWaypoints } from "../waypoints/WaypointManager";
import { arrowForDelta, formatDistance, isSameDimension } from "../waypoints/WaypointMath";
import { formatTerrainGridPixels, getCompanionTargetColor, isHiddenMapTarget, parseCompanionVectorPayload } from "./TerrainMap";
import { nearestEntries, withinRadius } from "./MinimapMath";
import { sampleTerrainGrid } from "./TerrainSampler";
import { system } from "@minecraft/server";

const RADAR_MAX_LISTED = 3;
const COMPANION_VECTOR_PROPERTY = "phlodgate:companion_vectors";
const MAX_COMPANION_TARGETS = 8;
// 17x17 grid at 16 blocks/cell gives a half-width radius of 128 blocks (8 * 16),
// satisfying the "see at least 128 blocks around the player" requirement while
// keeping enough cells for the terrain to look meaningfully detailed.
const HUD_GRID_WIDTH = 17;
const HUD_CELL_SIZE = 16;

function buildTerrainLines(player: Player, shape: "square" | "circle"): string[] {
  try {
    const location = player.location;
    const grid = sampleTerrainGrid(
      player.dimension,
      Math.floor(location.x),
      Math.floor(location.z),
      system.currentTick,
      HUD_CELL_SIZE,
      HUD_GRID_WIDTH
    );
    return formatTerrainGridPixels(grid, shape);
  } catch {
    return ["\u00a78Terrain map unavailable"];
  }
}

/** Returns map-only HUD lines plus nearby destination labels, or undefined if disabled. */
export function buildMinimapLines(player: Player): string[] | undefined {
  const settings = getPlayerSettings(player);
  if (!settings.minimapEnabled) return undefined;

  const from = player.location;
  const yaw360 = ((player.getRotation().y % 360) + 360) % 360;

  const companionTargets = parseCompanionVectorPayload(player.getDynamicProperty(COMPANION_VECTOR_PROPERTY) as string | undefined)
    .filter((target) => {
      if (isHiddenMapTarget(target.kind) || isHiddenMapTarget(target.category)) return false;
      const distance = Math.hypot(target.x, target.z);
      const range = target.range;
      if (range?.min !== undefined && distance < range.min) return false;
      if (range?.max !== undefined && distance > range.max) return false;
      return distance <= settings.minimapRadius;
    })
    .slice(0, MAX_COMPANION_TARGETS)
    .map((target) => {
      const to = { x: from.x + target.x, y: from.y, z: from.z + target.z };
      const bearing = bearingDegrees(from, to);
      const distance = distanceXZ(from, to);
      return {
        name: target.label ?? target.name,
        glyph: (target.glyph || target.name || "?").trim().charAt(0).toUpperCase() || "?",
        delta: angularDelta(yaw360, bearing),
        distance,
        kind: target.kind,
      };
    });

  const entries: Array<{ name: string; glyph?: string; delta: number; distance: number; kind?: string }> = [
    ...listWaypoints(player)
      .filter((w) => isSameDimension(w, player.dimension.id))
      .map((w) => {
        const to = { x: w.x, y: w.y, z: w.z };
        const bearing = bearingDegrees(from, to);
        return {
          name: w.name,
          glyph: w.name.trim().charAt(0).toUpperCase() || "?",
          delta: angularDelta(yaw360, bearing),
          distance: distanceXZ(from, to),
          kind: "waypoint",
        };
      }),
    ...companionTargets,
  ].filter((e) => withinRadius(e.distance, settings.minimapRadius));

  const lines = [`\u00a7fMAP \u00a77${settings.minimapRadius}m`, ...buildTerrainLines(player, settings.minimapShape)];

  if (entries.length === 0) {
    lines.push(`\u00a78No waypoints within ${settings.minimapRadius} blocks`);
  } else {
    for (const e of nearestEntries(entries, RADAR_MAX_LISTED)) {
      const kindPrefix = getCompanionTargetColor(e.kind);
      lines.push(`\u00a76${arrowForDelta(e.delta)} ${kindPrefix}${e.name} \u00a77${formatDistance(e.distance)}`);
    }
  }

  return lines;
}
