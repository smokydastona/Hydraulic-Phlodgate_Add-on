import { ActionFormData } from "@minecraft/server-ui";
import { Player, system } from "@minecraft/server";
import { getPlayerSettings, updatePlayerSettings } from "../../settings/SettingsStore";
import { angularDelta, bearingDegrees, distanceXZ } from "../../util/Vector";
import { listWaypoints } from "../../features/waypoints/WaypointManager";
import { arrowForDelta, formatDistance, isSameDimension } from "../../features/waypoints/WaypointMath";
import { buildRadarStrip, cardinalEntriesForYaw, nearestEntries, withinRadius } from "../../features/minimap/MinimapMath";
import { formatTerrainGrid } from "../../features/minimap/TerrainMap";
import { sampleTerrainGrid } from "../../features/minimap/TerrainSampler";
import { openAddWaypointForm, openWaypointMenu } from "./WaypointForms";
import { log } from "../../util/Logger";
import { showFormWithRetry } from "../FormRuntime";

const FIELD_MAP_LISTED = 10;

export async function openFieldMapMenu(player: Player): Promise<void> {
  try {
    const settings = getPlayerSettings(player);
    const from = player.location;
    const yaw360 = ((player.getRotation().y % 360) + 360) % 360;

    const entries = listWaypoints(player)
      .filter((w) => isSameDimension(w, player.dimension.id))
      .map((w) => {
        const to = { x: w.x, y: w.y, z: w.z };
        const bearing = bearingDegrees(from, to);
        return {
          name: w.name,
          delta: angularDelta(yaw360, bearing),
          distance: distanceXZ(from, to),
        };
      })
      .filter((e) => withinRadius(e.distance, settings.minimapRadius));

    const cardinals = cardinalEntriesForYaw(yaw360, angularDelta);
    const strip = buildRadarStrip(
      entries.map((e) => ({ glyph: e.name.trim().charAt(0).toUpperCase() || "?", delta: e.delta, distance: e.distance })),
      cardinals
    );

    const listBody =
      entries.length === 0
        ? `§7No waypoints within ${settings.minimapRadius} blocks.`
        : nearestEntries(entries, FIELD_MAP_LISTED)
            .map((e) => `${arrowForDelta(e.delta)} ${e.name} §7— §f${formatDistance(e.distance)}`)
            .join("\n");

    let terrainBody = "§8Terrain unavailable in this area.";
    try {
      const terrainGrid = sampleTerrainGrid(player.dimension, Math.floor(from.x), Math.floor(from.z), system.currentTick);
      terrainBody = ["§7Terrain", ...formatTerrainGrid(terrainGrid).map((line) => `§e${line}`), "§8X = player, # = solid, . = vegetation, ~ = water, ^ = lava"].join("\n");
    } catch (err) {
      log(`Field Map terrain sampling failed: ${String(err)}`);
    }

    const body = [`§7[${strip}§7]`, "", terrainBody, "", listBody].join("\n");

    const form = new ActionFormData()
      .title("Phlodgate Field Map")
      .body(body)
      .button("+ Add waypoint here")
      .button(settings.minimapEnabled ? "Turn off Minimap HUD" : "Turn on Minimap HUD")
      .button("Manage Waypoints");

    const response = await showFormWithRetry(player, () => form, { context: "Field Map menu" });
    if (!response || response.canceled || response.selection === undefined) return;

    switch (response.selection) {
      case 0:
        await openAddWaypointForm(player);
        break;
      case 1: {
        const next = updatePlayerSettings(player, { minimapEnabled: !settings.minimapEnabled });
        player.sendMessage(next.minimapEnabled ? "§aMinimap HUD enabled." : "§7Minimap HUD disabled.");
        break;
      }
      case 2:
        await openWaypointMenu(player);
        break;
    }
  } catch (err) {
    log(`Field Map menu failed: ${String(err)}`);
  }
}
