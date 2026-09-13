import { Player } from "@minecraft/server";
import { getPlayerSettings } from "../../settings/SettingsStore";
import { bearingDegrees, distanceXZ } from "../../util/Vector";
import { getActiveWaypoint } from "./WaypointManager";
import { arrowForDelta, formatDistance, isSameDimension } from "./WaypointMath";
import { angularDelta } from "../../util/Vector";

/** Returns a HUD line for the compass, or undefined if disabled/no reachable active waypoint. */
export function buildCompassLines(player: Player): string[] | undefined {
  const settings = getPlayerSettings(player);
  if (!settings.compassEnabled) return undefined;

  const waypoint = getActiveWaypoint(player);
  if (!waypoint) return undefined;

  if (!isSameDimension(waypoint, player.dimension.id)) {
    return [`\u00a76\u2708 ${waypoint.name}: \u00a7cdifferent dimension`];
  }

  const from = player.location;
  const to = { x: waypoint.x, y: waypoint.y, z: waypoint.z };
  const bearing = bearingDegrees(from, to);
  const yaw = player.getRotation().y;
  const yaw360 = ((yaw % 360) + 360) % 360;
  const delta = angularDelta(yaw360, bearing);
  const arrow = arrowForDelta(delta);
  const distance = formatDistance(distanceXZ(from, to));

  return [`\u00a76${arrow} ${waypoint.name} \u00a7f${distance}`];
}
