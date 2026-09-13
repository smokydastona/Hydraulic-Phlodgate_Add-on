import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { Player, world } from "@minecraft/server";
import {
  addWaypoint,
  getActiveWaypointId,
  listWaypoints,
  removeWaypoint,
  renameWaypoint,
  setActiveWaypointId,
} from "../../features/waypoints/WaypointManager";
import { log } from "../../util/Logger";

export async function openWaypointMenu(player: Player): Promise<void> {
  const waypoints = listWaypoints(player);
  const activeId = getActiveWaypointId(player);

  const form = new ActionFormData()
    .title("Waypoint Manager")
    .body(`You have ${waypoints.length} waypoint(s).`)
    .button("+ Add waypoint here");

  for (const w of waypoints) {
    const marker = w.id === activeId ? "\u2605 " : "";
    form.button(`${marker}${w.name}\n§7${w.dimensionId.replace("minecraft:", "")}`);
  }

  try {
    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return;

    if (response.selection === 0) {
      await openAddWaypointForm(player);
      return;
    }

    const waypoint = waypoints[response.selection - 1];
    if (waypoint) await openWaypointDetailMenu(player, waypoint.id);
  } catch (err) {
    log(`Waypoint menu failed: ${String(err)}`);
  }
}

export async function openAddWaypointForm(player: Player): Promise<void> {
  const form = new ModalFormData().title("Add Waypoint").textField("Waypoint name", "e.g. Base, Nether Portal");
  const response = await form.show(player);
  if (response.canceled || !response.formValues) return;

  const name = String(response.formValues[0] ?? "");
  const result = addWaypoint(player, name);
  if (result.ok) {
    player.sendMessage(`§aWaypoint "${result.waypoint.name}" added.`);
  } else {
    player.sendMessage(`§c${result.reason}`);
  }
}

async function openWaypointDetailMenu(player: Player, waypointId: string): Promise<void> {
  const waypoints = listWaypoints(player);
  const waypoint = waypoints.find((w) => w.id === waypointId);
  if (!waypoint) return;

  const isActive = getActiveWaypointId(player) === waypointId;

  const form = new ActionFormData()
    .title(waypoint.name)
    .body(`Dimension: ${waypoint.dimensionId.replace("minecraft:", "")}\nCoordinates: ${waypoint.x}, ${waypoint.y}, ${waypoint.z}`)
    .button(isActive ? "\u2605 Active (click to clear)" : "Set as active waypoint")
    .button("Teleport here")
    .button("Rename")
    .button("Remove");

  const response = await form.show(player);
  if (response.canceled || response.selection === undefined) return;

  switch (response.selection) {
    case 0:
      setActiveWaypointId(player, isActive ? undefined : waypoint.id);
      player.sendMessage(isActive ? "§7Active waypoint cleared." : `§aActive waypoint set to "${waypoint.name}".`);
      break;
    case 1:
      await teleportToWaypoint(player, waypoint);
      break;
    case 2: {
      const renameForm = new ModalFormData()
        .title("Rename Waypoint")
        .textField("New name", waypoint.name, { defaultValue: waypoint.name });
      const renameResponse = await renameForm.show(player);
      if (!renameResponse.canceled && renameResponse.formValues) {
        renameWaypoint(player, waypoint.id, String(renameResponse.formValues[0] ?? waypoint.name));
        player.sendMessage("§aWaypoint renamed.");
      }
      break;
    }
    case 3: {
      const confirm = new MessageFormData()
        .title("Remove Waypoint")
        .body(`Remove "${waypoint.name}"? This cannot be undone.`)
        .button1("Remove")
        .button2("Cancel");
      const confirmResponse = await confirm.show(player);
      if (!confirmResponse.canceled && confirmResponse.selection === 0) {
        removeWaypoint(player, waypoint.id);
        player.sendMessage("§7Waypoint removed.");
      }
      break;
    }
  }
}

async function teleportToWaypoint(
  player: Player,
  waypoint: { dimensionId: string; x: number; y: number; z: number }
): Promise<void> {
  try {
    const dimension = world.getDimension(waypoint.dimensionId);
    player.teleport({ x: waypoint.x, y: waypoint.y, z: waypoint.z }, { dimension });
    player.sendMessage("§aTeleported.");
  } catch (err) {
    log(`Waypoint teleport denied/failed for ${player.name}: ${String(err)}`);
    player.sendMessage("§cTeleport was denied by the server/world permissions.");
  }
}
